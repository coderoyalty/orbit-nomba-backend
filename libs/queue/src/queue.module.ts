import { Module } from '@nestjs/common';
import { SubscriptionDispatcher } from './subscription-dispatcher.service';
import { BullModule } from '@nestjs/bullmq';
import { QueueNames } from './queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QueueNames.SUBSCRIPTIONS,
    }),
  ],
  providers: [SubscriptionDispatcher],
  exports: [SubscriptionDispatcher],
})
export class QueueModule {}
