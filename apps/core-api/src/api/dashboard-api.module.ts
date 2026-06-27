import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../auth/auth.core.module';
import { ProjectsModule } from '../projects/projects.module';
import { PlansModule } from '../plans/plans.module';

@Module({ imports: [AuthCoreModule, ProjectsModule, PlansModule] })
export class DashboardApiModule {}
