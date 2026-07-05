import { Module } from '@nestjs/common';
import { SubscriptionDispatcher } from './subscription-dispatcher.service';
import { BullModule } from '@nestjs/bullmq';
import { QueueNames } from './queue.constants';
import { WebhookDispatcher } from './webhook.dispatcher';

@Module({
  imports: [
    BullModule.registerQueue(
      ...(() => {
        return Object.values(QueueNames).map((v) => ({ name: v }));
      })(),
    ),
  ],
  providers: [SubscriptionDispatcher, WebhookDispatcher],
  exports: [BullModule, SubscriptionDispatcher, WebhookDispatcher],
})
export class QueueModule {}
