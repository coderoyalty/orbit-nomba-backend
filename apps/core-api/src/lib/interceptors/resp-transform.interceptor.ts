import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((data) => {
        const ctx = context.switchToHttp();
        const res = ctx.getResponse();

        const statusCode = res.statusCode;

        const success = statusCode >= 200 && statusCode < 300;

        const transform = (value: any) => {
          if (!value || typeof value !== 'object') return value;

          const ordered: Record<string, any> = {};

          const keyOrder = ['status', 'message', 'data', 'meta'];

          for (const key of keyOrder) {
            if (key in value) ordered[key] = value[key];
          }

          for (const key of Object.keys(value)) {
            if (!(key in ordered)) ordered[key] = value[key];
          }

          return ordered;
        };

        const transformedData = transform(data);

        return { ...transformedData, statusCode, success };
      }),
    );
  }
}
