import { PrismaService } from '@app/database';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { EnvironmentType, NombaService } from '@orbit/nomba';
import { QueueNames, RenewalJobs } from '@queue/queue';
import { DateUtils } from 'apps/core-api/utils/date.util';
import { Job, Queue } from 'bullmq';

interface TrialRenewalPayload {
  subscriptionId: string;
}

interface ChargeVerificationData {
  invoiceId: string;
  subscriptionId: string;
  orderReference: string;
  environment: EnvironmentType;
}

@Injectable()
export class RenewalsService {
  constructor(
    private prisma: PrismaService,
    private nomba: NombaService,
    @InjectQueue(QueueNames.RENEWALS)
    private queue: Queue,
  ) {}

  async processTrialSubscriptionRenewal(job: Job<TrialRenewalPayload>) {
    const payload = job.data;
    const now = new Date();

    /**
     * Flow:
     * verify existence of payment method/cancel trial if no payment method ->
     * create charge invoice -> attempt card charge -> cancel subscription if failed -> dispatch charge verification.
     */

    const subscription = await this.prisma.subscription.findUniqueOrThrow({
      where: { id: payload.subscriptionId },
      include: {
        paymentMethod: {
          select: {
            provider_token: true,
          },
        },
        price: true,
        customer: true,
      },
    });

    if (!subscription.paymentMethod) {
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'canceled',
            canceled_at: now,
          },
        });

        const invoice = await tx.invoice.create({
          data: {
            amount: subscription.price.unit_amount,
            environment: subscription.environment,
            status: 'failed',
            //
            project_id: subscription.project_id,
            customer_id: subscription.customer_id,
            subscription_id: subscription.id,
            //
            period_start: now,
            period_end: now,
            due_at: now,
          },
        });

        await tx.paymentAttempt.create({
          data: {
            status: 'failed',
            error_message: 'Could not process payment at trial end.',
            invoice_id: invoice.id,
          },
        });
      });

      return;
    }

    const pendingInvoice = await this.prisma.invoice.create({
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
      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'canceled',
            canceled_at: now,
          },
        });

        // Update the pending invoice to failed
        await tx.invoice.update({
          where: { id: pendingInvoice.id },
          data: { status: 'failed' },
        });

        await tx.paymentAttempt.create({
          data: {
            status: 'failed',
            error_message:
              res.description || 'Gateway rejected tokenized charge.',
            invoice_id: pendingInvoice.id,
          },
        });
      });

      return;
    }

    // dispatch job that verifies charge status and update payment
    await this.queue.add(
      RenewalJobs.CHARGE_STATUS,
      {
        invoiceId: pendingInvoice.id,
        subscriptionId: subscription.id,
        orderReference: res.data.orderReference,
        environment: subscription.environment,
      },
      { delay: 10000 }, // 10 seconds delay
    );
  }

  async processChargeStatus(job: Job<ChargeVerificationData>) {
    const jobData = job.data;
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: jobData.invoiceId },
      include: {
        subscription: {
          include: {
            price: true,
          },
        },
      },
    });

    const res = await this.nomba.verifyTransaction<any>(
      { id: invoice.id, type: 'orderReference' },
      invoice.environment,
    );

    const now = new Date();

    if (!res.status || res.data.status === 'PAYMENT_FAILED') {
      await this.prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'failed',
          },
        });

        await tx.subscription.update({
          where: { id: invoice.subscription_id },
          data: {
            status: 'canceled',
            canceled_at: now,
          },
        });

        await tx.paymentAttempt.create({
          data: {
            status: 'failed',
            error_message: 'Could not process payment at trial end.',
            invoice_id: invoice.id,
          },
        });

        if (invoice.subscription.payment_method_id) {
          await tx.paymentMethod.update({
            where: {
              id: invoice.subscription.payment_method_id,
            },
            data: {
              is_default: false,
            },
          });
        }
      });

      return;
    }

    const price = invoice.subscription.price;

    const period_end = DateUtils.calculatePeriodEnd(
      now,
      price.billing_interval,
      price.billing_interval_count,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: invoice.subscription_id },
        data: {
          status: 'active',
          current_period_start: now,
          current_period_end: period_end,
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'paid',
          paid_at: now,
          period_start: now,
          period_end: period_end,
        },
      });
    });

    return;
  }
}
