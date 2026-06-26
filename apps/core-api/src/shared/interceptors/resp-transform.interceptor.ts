import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type ResponseEnvelope = {
  message?: string;
  data?: unknown;
  meta?: unknown;
};

function isResponseEnvelope(value: unknown): value is ResponseEnvelope {
  return (
    value !== null &&
    typeof value === 'object' &&
    ('data' in value || 'message' in value || 'meta' in value)
  );
}

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((body: unknown) => {
        const response = context.switchToHttp().getResponse();

        const statusCode = response.statusCode;
        const success = statusCode >= 200 && statusCode < 300;

        // HTTP 204 responses must not contain a body.
        if (statusCode === 204) {
          return undefined;
        }

        let message: string | undefined;
        let data: unknown;
        let meta: unknown;

        if (isResponseEnvelope(body)) {
          message = body.message;
          data = body.data;
          meta = body.meta;
        } else {
          data = body;
        }

        return {
          success,
          statusCode,
          ...(message ? { message } : {}),
          ...(data !== undefined && data !== null ? { data } : {}),
          ...(meta !== undefined ? { meta } : {}),
        };
      }),
    );
  }
}
