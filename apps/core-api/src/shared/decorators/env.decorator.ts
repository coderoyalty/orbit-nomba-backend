import { createParamDecorator, ExecutionContext } from '@nestjs/common';

const envFactory = (_: undefined, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ environment: string }>();

  return request.environment;
};

export const ActiveEnv = createParamDecorator(envFactory);
