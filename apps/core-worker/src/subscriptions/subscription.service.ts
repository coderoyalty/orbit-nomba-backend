import { Prisma, PrismaService, Subscription } from '@app/database';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { NombaService } from '@orbit/nomba';
import { TrialSubscriptionJob } from '@queue/queue';
import { DateUtils } from 'apps/core-api/utils/date.util';
import { Job } from 'bullmq';
import { WebhookEventType } from '../webhook/webhook.type';
import { WebhookDispatcher } from '@queue/queue/webhook.dispatcher';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private nomba: NombaService,
    private webhook: WebhookDispatcher,
  ) {}

  async processTrial(job: Job<TrialSubscriptionJob>) {
    const payload = job.data;

    /**
     * Flow: Verify Payment -> Save PaymentMethod (for recurring payment) ->
     * Update Subscription to trailing -> Refund authorization charge (TODO: Schedule refund job)
     */

    const res = await this.nomba.verifyTransaction<{
      data: { id: string; status: string };
    }>(
      { id: payload.transaction.id, type: 'transactionRef' },
      payload.environment,
    );

    this.logger.log(
      `Processing trial subscription for ${payload.subscriptionId}`,
    );

    const event = await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.findUnique({
        where: { id: payload.subscriptionId },
        include: {
          price: {
            include: { plan: true },
          },
        },
      });

      if (!subscription) {
        throw new Error('Subscription does not exist');
      }

      if (subscription.status !== 'incomplete') {
        return;
      }

      const trialStart = new Date();
      const trialEnd = DateUtils.addDays(
        trialStart,
        subscription.price.plan.trial_days,
      );

      const paymentMethod = await this.savePaymentToken(
        tx,
        payload,
        subscription,
      );

      const webhookPayload = {
        plan: {
          ...subscription.price.plan,
          price: { ...subscription.price, plan: undefined },
        },
        subscription: {
          ...subscription,
          price: undefined,
        },
      };

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'trialing',
          trial_start: trialStart,
          trial_end: trialEnd,
          payment_method_id: paymentMethod.id,
        },
      });

      const event = await tx.webhookEvent.create({
        data: {
          environment: subscription.environment,
          payload: webhookPayload,
          type: WebhookEventType.SUBSCRIPTION_CREATED,
          project_id: subscription.project_id,
          status: 'pending',
        },
      });

      return event;
    });

    await this.webhook.dispatch({ webhookEventId: event!.id });

    //TODO: delegate to refund job.
    await this.nomba.refundTransaction(
      payload.transaction.id, // the transaction ID.
      payload.environment,
    );
  }

  /**
   * Process Direct Subscription, no plan trial.
   */
  async processFirstPayment(job: Job<TrialSubscriptionJob>) {
    const payload = job.data;

    /**
     * Flow: Verify Transaction -> Save payment method (for )
     */

    //1. verify transaction
    const res = await this.nomba.verifyTransaction<{
      id: string;
      status: string;
      timeCompleted: string;
    }>(
      { id: payload.transaction.id, type: 'transactionRef' },
      payload.environment,
    );

    if (res.data.status !== 'SUCCESS') {
      throw new Error('Payment was not successful.');
    }

    this.logger.log(`Processing first payment for ${payload.subscriptionId}`);

    try {
      const event = await this.prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.findUnique({
          where: { id: payload.subscriptionId },
          include: {
            price: {
              include: { plan: true },
            },
          },
        });

        if (!subscription) {
          throw new Error('Subscription does not exist');
        }

        if (subscription.status !== 'incomplete') {
          return;
        }

        const price = subscription.price;

        const paymentMethod = await this.savePaymentToken(
          tx,
          payload,
          subscription,
        );

        const current_period_start = new Date(res.data.timeCompleted);

        const current_period_end = DateUtils.calculatePeriodEnd(
          current_period_start,
          price.billing_interval,
          price.billing_interval_count,
        );

        await tx.invoice.create({
          data: {
            amount: price.unit_amount,
            due_at: current_period_start,
            paid_at: current_period_start,
            environment: subscription.environment,
            status: 'paid',
            subscription_id: subscription.id,
            customer_id: subscription.customer_id,
            project_id: subscription.project_id,
            period_start: current_period_start,
            period_end: current_period_end,
          },
        });

        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'active',
            current_period_start: current_period_start,
            current_period_end: current_period_end,
            payment_method_id: paymentMethod.id,
          },
        });

        const webhookPayload = {
          plan: {
            ...subscription.price.plan,
            price: { ...subscription.price, plan: undefined },
          },
          subscription: {
            ...subscription,
            price: undefined,
          },
        };

        const event = await tx.webhookEvent.create({
          data: {
            environment: subscription.environment,
            payload: webhookPayload,
            type: WebhookEventType.SUBSCRIPTION_CREATED,
            project_id: subscription.project_id,
            status: 'pending',
          },
        });

        return event;
      });

      await this.webhook.dispatch({ webhookEventId: event!.id });

      this.logger.log(
        `Subscription ${payload.subscriptionId} activated successfully.`,
      );
    } catch (err) {
      this.logger.error(
        `Failed processing subscription ${payload.subscriptionId}`,
        err instanceof Error ? err.stack : undefined,
      );

      throw err;
    }
  }

  private async savePaymentToken(
    tx: Prisma.TransactionClient,
    payload: TrialSubscriptionJob,
    subscription: Subscription,
  ) {
    const paymentMethod = await tx.paymentMethod.create({
      data: {
        brand: payload.brand,
        environment: subscription.environment,
        last4: payload.last4,
        provider_token: payload.token,
        project_id: subscription.project_id,
        customer_id: subscription.customer_id,
        is_default: true,
      },
    });

    // only the latest payment method can be used.
    await tx.paymentMethod.updateMany({
      where: {
        project_id: subscription.project_id,
        customer_id: subscription.customer_id,
        id: { not: paymentMethod.id },
      },
      data: {
        is_default: false,
      },
    });

    return paymentMethod;
  }
}
