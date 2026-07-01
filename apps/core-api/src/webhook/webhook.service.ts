import { PrismaService } from '@app/database';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NombaWebhookData,
  NombaWebhookPayload,
} from '@orbit/nomba/dto/nomba.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private prisma: PrismaService) {}

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

    const queuePayload = {
      token,
      last4,
      brand,
      subscription,
    };

    if (!subscription) {
      throw new NotFoundException('Invalid subscription ID');
    }

    if (subscription.status !== 'incomplete') {
      this.logger.warn(
        `Ignoring payment for subscription ${subscription.id} because it is ${subscription.status}.`,
      );

      return;
    }

    const existing = await this.prisma.paymentAttempt.findFirst({
      where: {
        provider_reference: data.transaction.transactionId,
        status: 'successful',
      },
    });

    if (existing) {
      return;
    }

    if (subscription.price.plan.trial_days > 0) {
      // save payment token
      // refund authorization
      // update subscription trial period
      //TODO: dispatch trial subscription
    } else {
      // save payment token
      // update subscription next billing period.
      //TODO: dispatch first subscription
    }
  }

  handlePaymentFailed(data: NombaWebhookData) {}

  handleDebitSuccess(data: NombaWebhookData) {}

  handleVirtualAccountFunded(data: NombaWebhookData) {}
}
