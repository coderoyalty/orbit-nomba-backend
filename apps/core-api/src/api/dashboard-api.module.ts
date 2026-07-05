import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../auth/auth.core.module';
import { ProjectsModule } from '../projects/projects.module';
import { PlansModule } from '../plans/plans.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({ imports: [AuthCoreModule, ProjectsModule, PlansModule, WebhooksModule] })
export class DashboardApiModule {}
