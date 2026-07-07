import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import express from 'express';
import { JWT_SECRET_NAME, SESSION_NAME } from '../../auth/constants';
import { ConfigService } from '@nestjs/config';

export interface AuthRequest extends express.Request {
  account: { sub: string; email: string };
}

@Injectable()
export class DashboardAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();

    if (request.method === 'OPTIONS') {
      return true;
    }

    const token = request.cookies?.[SESSION_NAME];

    if (!token) {
      throw new UnauthorizedException('Session missing');
    }

    const secret = this.config.getOrThrow<string>(JWT_SECRET_NAME);

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret,
      });

      request['account'] = payload;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired session.');
    }

    return true;
  }
}
