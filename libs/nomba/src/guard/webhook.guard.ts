import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { Request } from 'express';
import { NombaWebhookPayload } from '../dto/nomba.dto';

@Injectable()
export class NombaWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { body: NombaWebhookPayload }>();

    const signature = request.headers['nomba-signature'];
    const timestamp = request.headers['nomba-timestamp'];

    if (typeof signature !== 'string') {
      throw new BadRequestException('Nomba signature not provided.');
    }

    if (typeof timestamp !== 'string') {
      throw new BadRequestException('Nomba timestamp not provided.');
    }

    const {
      event_type,
      requestId,
      data: {
        merchant: { userId, walletId },
        transaction,
      },
    } = request.body;

    const payload = [
      event_type,
      requestId,
      userId,
      walletId,
      transaction.transactionId,
      transaction.type,
      transaction.time,
      transaction.responseCode ?? '',
      timestamp,
    ].join(':');

    const expected = crypto
      .createHmac(
        'sha256',
        this.configService.getOrThrow<string>('NOMBA_WEBHOOK_SECRET'),
      )
      .update(payload)
      .digest();

    const received = Buffer.from(signature, 'base64');

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    return true;
  }
}
