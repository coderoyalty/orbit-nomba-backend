import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyRequest } from '../guards/api-key.guard';

const currentProjectFactory = (data: undefined, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<ApiKeyRequest>();
  const projectId = request.projectId;

  return projectId;
};

export const CurrentProject = createParamDecorator(currentProjectFactory);
