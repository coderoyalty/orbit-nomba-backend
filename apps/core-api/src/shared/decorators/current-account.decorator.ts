import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthRequest } from '../guards/dashboard-auth.guard';

const currentAccountFactory = (
  data: keyof AuthRequest['account'] | undefined,
  context: ExecutionContext,
) => {
  const request = context.switchToHttp().getRequest<AuthRequest>();
  const account = request.account;
  return data ? account?.[data] : account;
};

export const CurrentAccount = createParamDecorator(currentAccountFactory);
