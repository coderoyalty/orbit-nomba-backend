import { BadRequestException, Injectable } from '@nestjs/common';

type NombaEventType =
  | 'payment_success'
  | 'virtual_account.funded'
  | 'transfer.success'
  | 'transfer.failed'
  | 'mandate.debit_success';

interface NombaWebhookPayload {
  event_type: NombaEventType;
}

@Injectable()
export class WebhookService {
  async handleNomba(payload: NombaWebhookPayload) {
    const { event_type, ...data } = payload;

    switch (event_type) {
      case 'payment_success':
        break;

      case 'transfer.success':
        this.handlePaymentSuccess(data);
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
        throw new BadRequestException('Unknown Webhook Event Type');
    }
  }

  handlePaymentSuccess(data: any) {}

  handlePaymentFailed(data: any) {}

  handleDebitSuccess(data: any) {}

  handleVirtualAccountFunded(data: any) {}
}
