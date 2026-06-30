import { Module } from '@nestjs/common';
import { PublicPlansModule } from '../v1/plans/plans.module';
import { PublicCustomersModule } from '../v1/customers/customers.module';

@Module({ imports: [PublicPlansModule, PublicCustomersModule] })
export class ClientApiModule {}
