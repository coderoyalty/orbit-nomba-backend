import {
  Customer,
  Invoice,
  Plan,
  Price,
  Prisma,
  PrismaService,
  Subscription,
  SubscriptionStatus,
} from '@app/database';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentType, NombaResponse, NombaService } from '@orbit/nomba';
import { QueueNames, RenewalJobs } from '@queue/queue';
import { WebhookDispatcher } from '@queue/queue/webhook.dispatcher';
import { DateUtils } from 'apps/core-api/utils/date.util';
import { Job, Queue } from 'bullmq';
import { WebhookEventType } from '../webhook/webhook.type';
import { ConfigService } from '@nestjs/config';

interface TrialRenewalPayload {
  subscriptionId: string;
}

interface DunningRetryPayload {
  subscriptionId: string;
  invoiceId: string;
}

interface ChargeVerificationData {
  invoiceId: string;
  subscriptionId: string;
  orderReference: string;
  environment: EnvironmentType;
}

interface RetryDecision {
  attempts: number;
  exhausted: boolean;
  isTrial: boolean;
  dunningEnabled: boolean;
}

interface IChargeVerification<T = unknown> {
  response: NombaResponse<T>;
  failed: boolean;
}

const MAX_DUNNING_RETRIES = 3;

@Injectable()
export class RenewalsService {
  private readonly logger = new Logger(RenewalsService.name);

  constructor(
    private prisma: PrismaService,
    private nomba: NombaService,
    @InjectQueue(QueueNames.RENEWALS)
    private queue: Queue,
    private webhook: WebhookDispatcher,
    private configService: ConfigService,
  ) {}
  async processSubscriptionRenewal(job: Job<TrialRenewalPayload>) {
    const subscription = await this.prepareRenewal(
      job.data.subscriptionId,
      false,
    );

    if (!subscription) return;

    const invoice = await this.createInvoice(subscription);

    await this.chargeInvoice(subscription, invoice, false);
  }
  async processTrialSubscriptionRenewal(job: Job<TrialRenewalPayload>) {
    // prepare subscription.
    const subscription = await this.prepareRenewal(
      job.data.subscriptionId,
      true,
    );

    if (!subscription) return;

    const invoice = await this.createInvoice(subscription);

    await this.chargeInvoice(subscription, invoice, true);
  }

  async processDunningRetry(job: Job<DunningRetryPayload>) {
    const subscription = await this.prepareRenewal(
      job.data.subscriptionId,
      false,
    );

    if (!subscription) return;

    const invoice = await this.resetInvoiceForRetry(job.data.invoiceId);

    await this.chargeInvoice(subscription, invoice, false);
  }

  async processChargeStatus(job: Job<ChargeVerificationData>) {
    const invoice = await this.loadInvoiceForVerification(job.data.invoiceId);

    const verification = await this.verifyCharge(
      invoice,
      job.data.orderReference,
    );

    if (verification.failed) {
      await this.handleFailedVerification(invoice);
      return;
    }

    await this.handleSuccessfulVerification(invoice, verification);
  }

  private async prepareRenewal(subscriptionId: string, isTrial: boolean) {
    const subscription = await this.loadSubscription(subscriptionId);

    if (await this.cancelIfPeriodEnded(subscription)) {
      return null;
    }

    if (!(await this.ensurePaymentMethod(subscription, isTrial))) {
      return null;
    }

    return subscription;
  }
  private async loadSubscription(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUniqueOrThrow({
      where: {
        id: subscriptionId,
        status: {
          notIn: ['canceled'],
        },
      },
      include: {
        paymentMethod: { select: { provider_token: true } },
        price: true,
        customer: true,
      },
    });

    return subscription;
  }
  private async cancelIfPeriodEnded(subscription: Subscription) {
    const now = new Date();

    if (subscription.cancel_at_period_end) {
      this.logger.log(
        `Subscription ${subscription.id} is flagged for cancellation at period end. Cancelling now.`,
      );

      const payload = {
        ...subscription,
        paymentMethod: undefined, // contains card token for recurring debit.
      };

      const [_, event] = await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'canceled',
            canceled_at: now,
          },
        }),

        this.prisma.webhookEvent.create({
          data: {
            environment: subscription.environment,
            payload: payload,
            type: WebhookEventType.SUBSCRIPTION_CANCELED,
            status: 'pending',
            project_id: subscription.project_id,
          },
        }),
      ]);

      await this.webhook.dispatch({ webhookEventId: event.id });
      return true;
    }

    return false;
  }

  private async ensurePaymentMethod(
    subscription: Subscription & {
      price: Price;
      paymentMethod: { provider_token: string } | null;
    },
    isTrial: boolean,
  ) {
    const failedStatus = isTrial ? 'canceled' : 'past_due';
    const now = new Date();

    if (!subscription.paymentMethod) {
      const event = await this.prisma.$transaction(async (tx) => {
        const updateSubscription = await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: failedStatus,
            ...(isTrial && { canceled_at: now }), // Only set canceled_at if actually canceled
          },
        });

        const invoice = await tx.invoice.create({
          data: {
            amount: subscription.price.unit_amount,
            environment: subscription.environment,
            status: 'failed',
            project_id: subscription.project_id,
            customer_id: subscription.customer_id,
            subscription_id: subscription.id,
            period_start: now,
            period_end: now,
            due_at: now,
          },
        });

        await tx.paymentAttempt.create({
          data: {
            status: 'failed',
            error_message: `Could not process payment. No payment method found.`,
            invoice_id: invoice.id,
          },
        });

        const webhookPayload = { invoice, subscription: updateSubscription };

        return await tx.webhookEvent.create({
          data: {
            environment: subscription.environment,
            payload: webhookPayload,
            type: isTrial
              ? WebhookEventType.SUBSCRIPTION_CANCELED
              : WebhookEventType.SUBSCRIPTION_PAST_DUE,
            project_id: subscription.project_id,
          },
        });
      });

      await this.webhook.dispatch({ webhookEventId: event.id });
      return false;
    }

    return true;
  }

  private async resetInvoiceForRetry(invoiceId: string) {
    return this.prisma.invoice.update({
      where: {
        id: invoiceId,
      },
      data: {
        status: 'pending',
      },
    });
  }

  private async createInvoice(subscription: Subscription & { price: Price }) {
    const now = new Date();

    const invoice = await this.prisma.invoice.create({
      data: {
        amount: subscription.price.unit_amount,
        environment: subscription.environment,
        status: 'pending',
        project_id: subscription.project_id,
        customer_id: subscription.customer_id,
        subscription_id: subscription.id,
        period_start: now,
        period_end: now,
        due_at: now,
      },
    });

    return invoice;
  }

  private async chargeInvoice(
    subscription: Subscription & {
      customer: Customer;
      price: Price;
      paymentMethod: {
        provider_token: string;
      } | null;
    },
    invoice: Invoice,
    isTrial: boolean,
  ) {
    const failedStatus = isTrial ? 'canceled' : 'past_due';

    try {
      const res = await this.nomba.chargeCard<{
        status: boolean;
        message: string;
        orderId: string;
        orderReference: string;
      }>(
        {
          order: {
            customer_email: subscription.customer.email,
            transaction_reference: invoice.id,
            redirect_url:
              this.configService.getOrThrow<string>('DASHBOARD_URL'),
            amount: subscription.price.unit_amount / 100,
          },
          token: subscription.paymentMethod!.provider_token,
        },
        subscription.environment,
      );

      if (!res.status) {
        await this.handleFailedCharge(
          subscription.id,
          invoice.id,
          failedStatus,
          isTrial,
          res.description || 'Gateway rejected tokenized charge.',
        );
        return;
      }

      await this.queue.add(
        RenewalJobs.CHARGE_STATUS,
        {
          invoiceId: invoice.id,
          subscriptionId: subscription.id,
          orderReference: res.data.orderReference,
          environment: subscription.environment,
        },
        { delay: 10000 },
      );
    } catch (error) {
      this.logger.error(
        `Failed to reach payment gateway for sub ${subscription.id}`,
        error,
      );

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'failed' },
      });

      return;
    }
  }

  private async handleFailedCharge(
    subscriptionId: string,
    invoiceId: string,
    subStatus: SubscriptionStatus,
    isTrial: boolean,
    errorMessage: string,
  ) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: subStatus,
          ...(isTrial && { canceled_at: now }),
        },
      });

      const invoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'failed' },
      });

      await tx.paymentAttempt.create({
        data: {
          status: 'failed',
          error_message: errorMessage,
          invoice_id: invoiceId,
        },
      });

      const webhookPayload = { invoice, subscription };

      return await tx.webhookEvent.create({
        data: {
          environment: subscription.environment,
          payload: webhookPayload,
          type: isTrial
            ? WebhookEventType.SUBSCRIPTION_CANCELED
            : WebhookEventType.SUBSCRIPTION_PAST_DUE,
          project_id: subscription.project_id,
        },
      });
    });
  }

  private async loadInvoiceForVerification(invoiceId: string) {
    return await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: {
        subscription: {
          include: {
            price: {
              include: { plan: true },
            },
          },
        },
      },
    });
  }

  private async verifyCharge(invoice: Invoice, orderReference: string) {
    const response = await this.nomba.verifyTransaction<any>(
      { id: orderReference, type: 'orderReference' },
      invoice.environment,
    );

    return {
      response,
      failed: !response.status || response.data?.status === 'PAYMENT_FAILED',
    };
  }

  private async calculateRetry(
    invoice: Invoice & {
      subscription: Subscription & { price: Price & { plan: Plan } };
    },
  ) {
    const attempts = await this.prisma.paymentAttempt.count({
      where: {
        invoice_id: invoice.id,
      },
    });

    return {
      attempts,
      exhausted: attempts >= MAX_DUNNING_RETRIES,
      isTrial: invoice.subscription.status === 'trialing',
      dunningEnabled: invoice.subscription.price.plan.dunning_enabled,
    };
  }

  private async persistVerificationFailure(
    invoice: Invoice,

    retry: RetryDecision,
  ) {
    const now = new Date();
    const finalStatus = retry.isTrial
      ? 'canceled'
      : retry.dunningEnabled && !retry.exhausted
        ? 'canceled'
        : 'past_due';

    const event = await this.prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'failed' },
      });

      const updatedSubscription = await tx.subscription.update({
        where: { id: invoice.subscription_id },
        data: {
          status: finalStatus,
          canceled_at: finalStatus === 'canceled' ? now : undefined, // Removed canceled_at for past_due
        },
        include: { price: { include: { plan: true } } },
      });

      await tx.paymentAttempt.create({
        data: {
          status: 'failed',
          error_message: 'Could not process payment during verification.',
          invoice_id: invoice.id,
        },
      });

      const price = updatedSubscription.price;

      const payload = {
        subscription: updatedSubscription,
        invoice: updatedInvoice,
        plan: { ...price.plan, price: { ...price, plan: undefined } },
      };

      const event = await tx.webhookEvent.create({
        data: {
          environment: updatedSubscription.environment,
          payload: payload,
          type:
            finalStatus === 'canceled'
              ? WebhookEventType.SUBSCRIPTION_CANCELED
              : WebhookEventType.SUBSCRIPTION_PAST_DUE,
          project_id: invoice.project_id,
        },
      });

      if (finalStatus === 'canceled' && updatedSubscription.payment_method_id) {
        await tx.paymentMethod.update({
          where: { id: updatedSubscription.payment_method_id },
          data: { is_default: false },
        });
      }

      return event;
    });

    return event;
  }

  private async scheduleDunningRetry(
    invoice: Invoice & { subscription: Subscription },
    retry: RetryDecision,
  ) {
    if (!retry.dunningEnabled || retry.isTrial || retry.exhausted) {
      return;
    }

    await this.queue.add(
      RenewalJobs.PROCESS_DUNNING,
      {
        subscriptionId: invoice.subscription.id,
        invoiceId: invoice.id,
      },
      {
        delay: 24 * 60 * 60 * 1000,
        jobId: `dunning:${invoice.id}:${retry.attempts + 1}`,
      },
    );
  }

  private async handleFailedVerification(
    invoice: Invoice & {
      subscription: Subscription & { price: Price & { plan: Plan } };
    },
  ) {
    const retry = await this.calculateRetry(invoice);

    const event = await this.persistVerificationFailure(invoice, retry);

    // dispatch event

    await this.webhook.dispatch({ webhookEventId: event.id });

    await this.scheduleDunningRetry(invoice, retry);
  }

  private async handleSuccessfulVerification(
    invoice: Invoice & {
      subscription: Subscription & { price: Price & { plan: Plan } };
    },
    verification: IChargeVerification,
  ) {
    const now = new Date();
    const price: Price & { plan: Plan } = invoice.subscription.price;
    const period_end = DateUtils.calculatePeriodEnd(
      now,
      price.billing_interval,
      price.billing_interval_count,
    );

    const event = await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.update({
        where: { id: invoice.subscription_id },
        data: {
          status: 'active',
          current_period_start: now,
          current_period_end: period_end,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'paid',
          paid_at: now,
          period_start: now,
          period_end: period_end,
        },
      });

      const payload = {
        subscription: subscription,
        plan: {
          ...price.plan,
          price: {
            ...price,
            plan: undefined,
          },
        },
        invoice: updatedInvoice,
      };

      return await tx.webhookEvent.create({
        data: {
          environment: subscription.environment,
          payload: payload,
          type: WebhookEventType.SUBSCRIPTION_ACTIVE,
          project_id: invoice.project_id,
        },
      });
    });

    await this.webhook.dispatch({ webhookEventId: event.id });
  }
}
