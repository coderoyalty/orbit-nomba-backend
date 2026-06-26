import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../auth/auth.core.module';

@Module({ imports: [AuthCoreModule] })
export class DashboardApiModule {}
