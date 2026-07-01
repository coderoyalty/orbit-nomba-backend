import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { Environment } from '@app/database';

export class DashboardEnvInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { environment: Environment }>();

    const envHeader = request.headers['x-orbit-env'];

    const envType = Object.keys(Environment);

    if (!envHeader || !envType.includes(envHeader as string)) {
      throw new BadRequestException(
        `Missing or invalid X-Orbit-Env header. Must be ${envType.join(' or ')}`,
      );
    }

    request.environment = envType as any;

    return next.handle();
  }
}
