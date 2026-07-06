import { PrismaService, SubscriptionStatus } from '@app/database';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentType, NombaService } from '@orbit/nomba';
import { QueueNames, RenewalJobs } from '@queue/queue';
import { WebhookDispatcher } from '@queue/queue/webhook.dispatcher';
import { DateUtils } from 'apps/core-api/utils/date.util';
import { Job, Queue } from 'bullmq';
import { WebhookEventType } from '../webhook/webhook.type';

interface TrialRenewalPayload {
  subscriptionId: string;
  invoiceId?: string;
}

interface ChargeVerificationData {
  invoiceId: string;
  subscriptionId: string;
  orderReference: string;
  environment: EnvironmentType;
}

@Injectable()
export class RenewalsService {
  private readonly logger = new Logger(RenewalsService.name);

  constructor(
    private prisma: PrismaService,
    private nomba: NombaService,
    @InjectQueue(QueueNames.RENEWALS)
    private queue: Queue,
    private webhook: WebhookDispatcher,
  ) {}

  async processTrialSubscriptionRenewal(job: Job<TrialRenewalPayload>) {
    await this.handleRenewal(job.data, true);
  }

  async processSubscriptionRenewal(job: Job<TrialRenewalPayload>) {
    await this.handleRenewal(job.data, false);
  } /**
   * Consolidated logic for both trial and standard renewals.
   */

  private async handleRenewal(
    { subscriptionId, invoiceId }: TrialRenewalPayload,
    isTrial: boolean,
  ) {
    const now = new Date();

    const subscription = await this.prisma.subscription.findUniqueOrThrow({
      where: {
        id: subscriptionId,
        status: {
          notIn: ['canceled', 'active'],
        },
      },
      include: {
        paymentMethod: { select: { provider_token: true } },
        price: true,
        customer: true,
      },
    });

    if (!subscription) {
      return;
    }

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
      return;
    }

    const failedStatus = isTrial ? 'canceled' : 'past_due';

    if (!subscription.paymentMethod) {
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
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
      });
      return;
    }

    let pendingInvoice;

    if (invoiceId) {
      pendingInvoice = await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'pending' },
      });
    } else {
      pendingInvoice = await this.prisma.invoice.create({
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
    }

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
            transaction_reference: pendingInvoice.id,
            redirect_url: '',
            amount: subscription.price.unit_amount / 100,
          },
          token: subscription.paymentMethod.provider_token,
        },
        subscription.environment,
      );

      if (!res.status) {
        await this.handleFailedCharge(
          subscription.id,
          pendingInvoice.id,
          failedStatus,
          isTrial,
          res.description || 'Gateway rejected tokenized charge.',
        );
        return;
      }

      await this.queue.add(
        RenewalJobs.CHARGE_STATUS,
        {
          invoiceId: pendingInvoice.id,
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
        where: { id: pendingInvoice.id },
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
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: subStatus,
          ...(isTrial && { canceled_at: now }),
        },
      });

      await tx.invoice.update({
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
    });
  }

  async processChargeStatus(job: Job<ChargeVerificationData>) {
    const { invoiceId, environment } = job.data;
    const now = new Date();

    const [invoice, attemptCount] = await this.prisma.$transaction([
      this.prisma.invoice.findUniqueOrThrow({
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
      }),
      this.prisma.paymentAttempt.count({ where: { invoice_id: invoiceId } }),
    ]);

    const price = invoice.subscription.price;

    const res = await this.nomba.verifyTransaction<any>(
      { id: invoice.id, type: 'orderReference' },
      invoice.environment,
    );

    const isPaymentFailed =
      !res.status || res.data?.status === 'PAYMENT_FAILED';
    const isTrialing = invoice.subscription.status === 'trialing';

    const MAX_DUNNING_RETRIES = 3;
    const retriesExhausted = attemptCount >= MAX_DUNNING_RETRIES;

    const failedStatus =
      isTrialing || retriesExhausted ? 'canceled' : 'past_due';

    if (isPaymentFailed) {
      const event = await this.prisma.$transaction(async (tx) => {
        const updatedInvoice = await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: 'failed' },
        });

        const updatedSubscription = await tx.subscription.update({
          where: { id: invoice.subscription_id },
          data: {
            status: failedStatus,
            canceled_at: isTrialing || retriesExhausted ? now : undefined, // Removed canceled_at for past_due
          },
        });

        await tx.paymentAttempt.create({
          data: {
            status: 'failed',
            error_message: 'Could not process payment during verification.',
            invoice_id: invoice.id,
          },
        });

        const payload = {
          subscription: updatedSubscription,
          invoice: updatedInvoice,
          plan: { ...price.plan, price: { ...price, plan: undefined } },
        };

        const event = await tx.webhookEvent.create({
          data: {
            environment,
            payload: payload,
            type:
              isTrialing || retriesExhausted
                ? WebhookEventType.SUBSCRIPTION_CANCELED
                : WebhookEventType.SUBSCRIPTION_PAST_DUE,
            project_id: invoice.project_id,
          },
        });

        if (
          (isTrialing || retriesExhausted) &&
          invoice.subscription.payment_method_id
        ) {
          await tx.paymentMethod.update({
            where: { id: invoice.subscription.payment_method_id },
            data: { is_default: false },
          });
        }

        return event;
      });

      await this.webhook.dispatch({ webhookEventId: event.id });

      if (!isTrialing && !retriesExhausted) {
        this.logger.log(
          `Scheduling Dunning retry for invoice ${invoice.id}. Attempt ${attemptCount + 1} of ${MAX_DUNNING_RETRIES}`,
        ); // Push the job back into the main RENEWALS queue with a 24-hour delay

        await this.queue.add(
          RenewalJobs.PROCESS_SUBSCRIPTION,
          { subscriptionId: invoice.subscription_id, invoiceId: invoice.id },
          {
            delay: 24 * 60 * 60 * 1000, // 24 hours.
            jobId: `dunning:${invoice.id}:${attemptCount + 1}`,
          },
        );
      }

      return;
    }

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
          environment,
          payload: payload,
          type: WebhookEventType.SUBSCRIPTION_ACTIVE,
          project_id: invoice.project_id,
        },
      });
    });

    await this.webhook.dispatch({ webhookEventId: event.id });
  }
}
