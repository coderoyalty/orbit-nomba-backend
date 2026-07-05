import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { QueueNames, WebhookJobs } from './queue.constants';
import { Queue } from 'bullmq';

export interface DispatchWebhookPayload {
  webhookEventId: string;
}

@Injectable()
export class WebhookDispatcher {
  constructor(@InjectQueue(QueueNames.WEBHOOK) private readonly queue: Queue) {}

  async dispatch(payload: DispatchWebhookPayload) {
    return this.queue.add(WebhookJobs.DISPATCH, payload, {
      attempts: 6,
      backoff: {
        type: 'exponential',
        delay: 1000 * 60 * 5, // 5 mins delay
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
