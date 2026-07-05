import { applyDecorators, Controller, UseGuards } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { ProjectAccessGuard } from '../../projects/guards/project-access.guard';
import { DashboardAuthGuard } from '../guards/dashboard-auth.guard';

export function DashboardProjectController(path: string) {
  return applyDecorators(
    ApiParam({
      name: 'projectId',
      type: String,
      description: 'Project ID',
    }),
    UseGuards(DashboardAuthGuard, ProjectAccessGuard),
    Controller(`dashboard/projects/:projectId/${path}`),
  );
}
