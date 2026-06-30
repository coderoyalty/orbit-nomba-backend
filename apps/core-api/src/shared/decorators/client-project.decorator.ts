import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyRequest } from '../guards/api-key.guard';

const clientApiProjectFactory = (
  data: undefined,
  context: ExecutionContext,
) => {
  const request = context.switchToHttp().getRequest<ApiKeyRequest>();
  const project = request.project;

  return project;
};

export const ClientApiProject = createParamDecorator(clientApiProjectFactory);
