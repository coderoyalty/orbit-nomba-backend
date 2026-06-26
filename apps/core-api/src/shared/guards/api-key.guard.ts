import { PrismaService } from '@app/database';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import express from 'express';
import crypto from 'node:crypto';

export interface ApiKeyRequest extends express.Request {
  projectId: string;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();

    const authorization = request.headers.authorization;

    const [scheme, secretKey] = authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !secretKey) {
      throw new UnauthorizedException('Invalid Authorization header');
    }

    const [type, environment, ...parts] = secretKey.split('_');

    const prefix = `${type}_${environment}`;
    const rawKey = parts.join('_');

    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.projectApiKey.findUnique({
      where: {
        key_prefix_key_hash: {
          key_hash: hash,
          key_prefix: prefix,
        },
      },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key.');
    }

    request.projectId = apiKey.project_id;

    return true;
  }
}
