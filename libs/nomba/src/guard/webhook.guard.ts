import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { type Request } from 'express';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';

@Injectable()
export class NombaWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const signature = request.headers['nomba-signature'];

    if (!signature) {
      throw new BadRequestException('Nomba Signature not provided');
    }

    const expected = crypto
      .createHmac(
        'sha256',
        this.configService.getOrThrow<any>('NOMBA_WEBHOOK_SECRET'),
      )
      .update(request.body)
      .digest('hex');

    if (expected !== signature) {
      throw new UnauthorizedException('Bad signature');
    }

    return true;
  }
}
