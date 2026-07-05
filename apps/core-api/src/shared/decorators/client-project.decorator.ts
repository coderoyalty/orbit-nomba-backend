import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyRequest } from '../guards/api-key.guard';

export interface ProjectContext {
  project: ApiKeyRequest['project'];
  environment: ApiKeyRequest['environment'];
}

const clientApiProjectFactory = (
  data: undefined,
  context: ExecutionContext,
) => {
  const request = context.switchToHttp().getRequest<ApiKeyRequest>();
  const project = request.project;

  return { project, environment: request.environment };
};

export const ApiProjectContext = createParamDecorator(clientApiProjectFactory);
