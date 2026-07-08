import { PrismaService } from '@app/database';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NombaService } from '@orbit/nomba';
import {
  NombaWebhookData,
  NombaWebhookPayload,
} from '@orbit/nomba/dto/nomba.dto';
import { TrialSubscriptionJob } from '@queue/queue';
import { SubscriptionDispatcher } from '@queue/queue/subscription-dispatcher.service';
import { WebhookDispatcher } from '@queue/queue/webhook.dispatcher';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private prisma: PrismaService,
    private nomba: NombaService,
    private subDispatcher: SubscriptionDispatcher,
    private webhookDispatcher: WebhookDispatcher,
  ) {}

  async handleNomba(payload: NombaWebhookPayload) {
    const { event_type, data, requestId } = payload;

    switch (event_type) {
      case 'payment_success':
        await this.handlePaymentSuccess(data);
        break;
      case 'transfer.failed':
        this.handlePaymentFailed(data);
        break;
      case 'mandate.debit_success':
        this.handleDebitSuccess(data);
        break;
      case 'virtual_account.funded':
        this.handleVirtualAccountFunded(data);
        break;
      default:
        throw new ForbiddenException('Unknown Webhook Event Type');
    }
  }

  async handlePaymentSuccess(data: NombaWebhookData) {
    const subscriptionId = data.order.orderReference;

    if (subscriptionId.startsWith('card_update:')) {
      await this.handleCardUpdateWebhook(data);
      return;
    }

    const token = data.tokenizedCardData.tokenKey;
    const last4 = data.order.cardLast4Digits;
    const brand = data.tokenizedCardData.cardType;

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
      },
      include: {
        price: { include: { plan: true } },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Invalid subscription ID');
    }

    if (subscription.status !== 'incomplete') {
      this.logger.warn(
        `Ignoring payment for subscription ${subscription.id} because it is ${subscription.status}.`,
      );

      return;
    }

    await this.nomba.verifyTransaction<{
      data: { id: string; status: string; timeCompleted: string };
    }>(
      { id: subscriptionId, type: 'orderReference' },
      subscription.environment,
    );

    const existing = await this.prisma.paymentAttempt.findFirst({
      where: {
        provider_reference: data.transaction.transactionId,
        status: 'successful',
      },
    });

    if (existing) {
      return;
    }

    const dispatchPayload: TrialSubscriptionJob = {
      token,
      brand,
      last4,
      subscriptionId: subscription.id,
      environment: subscription.environment,
      transaction: {
        amount: data.transaction.transactionAmount * 100,
        id: data.transaction.transactionId,
      },
    };

    if (subscription.price.plan.trial_days > 0) {
      // save payment token
      // refund authorization
      // update subscription trial period
      //TODO: dispatch trial subscription
      this.subDispatcher.dispatchTrial(dispatchPayload);
    } else {
      // save payment token
      // update subscription next billing period.
      //TODO: dispatch first subscription
      this.subDispatcher.dispatchFirstPayment(dispatchPayload);
    }
  }

  handlePaymentFailed(data: NombaWebhookData) {}

  handleDebitSuccess(data: NombaWebhookData) {}

  handleVirtualAccountFunded(data: NombaWebhookData) {}

  private async handleCardUpdateWebhook(data: NombaWebhookData) {
    const orderRef = data.order.orderReference;
    const parts = orderRef.split(':');
    const subscriptionId = parts[1];

    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { customer: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found for card update');
    }

    const res = await this.nomba.verifyTransaction<{
      id: string;
      status: string;
      timeCompleted: string;
    }>({ id: orderRef, type: 'orderReference' }, subscription.environment);

    if (res.data?.status !== 'SUCCESS') {
      this.logger.warn(
        `Card update verification failed. Nomba status: ${res.data?.status}`,
      );
      return;
    }

    const existingAttempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        provider_reference: data.transaction.transactionId,
        status: 'successful',
      },
    });
    if (existingAttempt) {
      return;
    }

    const { pm, updatedSubscription } = await this.prisma.$transaction(
      async (tx) => {
        const pm = await tx.paymentMethod.create({
          data: {
            brand: data.tokenizedCardData.cardType,
            environment: subscription.environment,
            last4: data.order.cardLast4Digits,
            provider_token: data.tokenizedCardData.tokenKey,
            project_id: subscription.project_id,
            customer_id: subscription.customer_id,
            is_default: true,
          },
        });

        await tx.paymentMethod.updateMany({
          where: {
            project_id: subscription.project_id,
            customer_id: subscription.customer_id,
            id: { not: pm.id },
          },
          data: {
            is_default: false,
          },
        });

        const updatedSubscription = await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            payment_method_id: pm.id,
          },
        });

        const invoice = await tx.invoice.create({
          data: {
            amount: Math.round(data.transaction.transactionAmount * 100),
            due_at: new Date(res.data.timeCompleted),
            paid_at: new Date(res.data.timeCompleted),
            environment: subscription.environment,
            status: 'paid',
            subscription_id: subscription.id,
            customer_id: subscription.customer_id,
            project_id: subscription.project_id,
            period_start: new Date(res.data.timeCompleted),
            period_end: new Date(res.data.timeCompleted),
            payment_method_id: pm.id,
          },
        });

        await tx.paymentAttempt.create({
          data: {
            invoice_id: invoice.id,
            provider_reference: data.transaction.transactionId,
            status: 'successful',
            provider_response: data as any,
          },
        });

        return { pm, updatedSubscription };
      },
    );

    try {
      await this.nomba.refundTransaction(
        data.transaction.transactionId,
        subscription.environment,
      );
      this.logger.log(
        `Refunded validation charge ${data.transaction.transactionId} for card update`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to refund validation charge ${data.transaction.transactionId}: ${err}`,
      );
    }

    const webhookPayload = {
      subscription: updatedSubscription,
      paymentMethod: pm,
    };

    const event = await this.prisma.webhookEvent.create({
      data: {
        environment: subscription.environment,
        payload: webhookPayload,
        type: 'customer.payment_method.updated',
        project_id: subscription.project_id,
        status: 'pending',
      },
    });

    await this.webhookDispatcher.dispatch({ webhookEventId: event.id });
  }
}
