import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithProject } from '../../projects/guards/project-access.guard';
import { Project } from '@app/database';

const currentProjectFactory = (
  key: keyof Project | undefined,
  context: ExecutionContext,
) => {
  const request = context.switchToHttp().getRequest<RequestWithProject>();
  const project = request.project;
  return key ? project[key] : project;
};

export const CurrentProject = createParamDecorator(currentProjectFactory);
