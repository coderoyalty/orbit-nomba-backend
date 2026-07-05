import { Module } from '@nestjs/common';
import { SubScriptionService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { NombaModule } from '@orbit/nomba';

@Module({
  imports: [NombaModule],
  controllers: [SubscriptionsController],
  providers: [SubScriptionService],
})
export class SubscriptionsModule {}
