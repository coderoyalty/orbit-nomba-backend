import { Module } from '@nestjs/common';
import { ApiPlansModule } from '../v1/plans/plans.module';
import { ApiCustomersModule } from '../v1/customers/customers.module';
import { SubscriptionsModule as ApiSubscriptionsModule } from '../v1/subscriptions/subscriptions.module';

@Module({
  imports: [ApiPlansModule, ApiCustomersModule, ApiSubscriptionsModule],
})
export class ClientApiModule {}
