import { Module } from '@nestjs/common';
import { AuthCoreModule } from '../auth/auth.core.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({ imports: [AuthCoreModule, ProjectsModule] })
export class DashboardApiModule {}
