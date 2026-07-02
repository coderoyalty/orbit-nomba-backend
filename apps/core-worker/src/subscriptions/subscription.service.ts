import { Prisma, PrismaService, Subscription } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { TrialSubscriptionJob } from '@queue/queue';
import { DateUtils } from 'apps/core-api/utils/date.util';
import { Job } from 'bullmq';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private prisma: PrismaService) {}

  async processTrial(job: Job<TrialSubscriptionJob>) {
    const payload = job.data;

    this.logger.log(
      `Processing trial subscription for ${payload.subscriptionId}`,
    );

    const subscription = await this.prisma.subscription.findFirst({
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

    // guard against duplicate processing.
    if (subscription.status !== 'incomplete') {
      this.logger.warn(
        `Subscription ${subscription.id} is already ${subscription.status}. Skipping.`,
      );
      return;
    }

    const trialStart = new Date();
    const trialEnd = DateUtils.addDays(
      trialStart,
      subscription.price.plan.trial_days,
    );

    await this.prisma.$transaction(async (tx) => {
      const paymentMethod = await this.savePaymentToken(
        tx,
        payload,
        subscription,
      );

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'trialing',
          trial_start: trialStart,
          trial_end: trialEnd,
          payment_method_id: paymentMethod.id,
        },
      });
    });
  }

  /**
   * Process Direct Subscription, no plan trial.
   */
  async processFirstPayment(job: Job<TrialSubscriptionJob>) {
    const payload = job.data;

    this.logger.log(`Processing first payment for ${payload.subscriptionId}`);

    const subscription = await this.prisma.subscription.findFirst({
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

    // guard against duplicate processing.
    if (subscription.status !== 'incomplete') {
      this.logger.warn(
        `Subscription ${subscription.id} is already ${subscription.status}. Skipping.`,
      );
      return;
    }

    const price = subscription.price;

    await this.prisma.$transaction(async (tx) => {
      const paymentMethod = await this.savePaymentToken(
        tx,
        payload,
        subscription,
      );

      await tx.invoice.create({
        data: {
          amount: price.unit_amount,
          due_at: new Date(), //TODO:
          environment: subscription.environment,
          status: 'paid',
          subscription_id: subscription.id,
          customer_id: subscription.customer_id,
          project_id: subscription.project_id,
        },
      });

      const current_period_start = new Date();

      const current_period_end = DateUtils.calculatePeriodEnd(
        current_period_start,
        price.billing_interval,
        price.billing_interval_count,
      );

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          current_period_start: current_period_start,
          current_period_end: current_period_end,
          payment_method_id: paymentMethod.id,
        },
      });
    });
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
