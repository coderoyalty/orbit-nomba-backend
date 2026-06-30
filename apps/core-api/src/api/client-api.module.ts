import { Module } from '@nestjs/common';
import { PublicPlansModule } from '../v1/plans/plans.module';

@Module({ imports: [PublicPlansModule] })
export class ClientApiModule {}
