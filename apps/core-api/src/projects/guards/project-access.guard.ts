import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthRequest } from '../../shared/guards/dashboard-auth.guard';
import { PrismaService, Project } from '@app/database';

export interface RequestWithProject extends AuthRequest {
  project: Project;
}

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithProject>();

    const { projectId } = request.params;

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId as string,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    if (project.account_id !== request.account.sub) {
      throw new ForbiddenException();
    }

    request.project = project;

    return true;
  }
}
