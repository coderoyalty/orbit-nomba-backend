import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthRequest } from '../guards/dashboard-auth.guard';

export const CurrentAccount = createParamDecorator(
  (
    data: keyof AuthRequest['account'] | undefined,
    context: ExecutionContext,
  ) => {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const account = request.account;
    return data ? account?.[data] : account;
  },
);
