import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { AuthService } from './auth.service';
import { ApiTags } from '@nestjs/swagger';
import { LoginAccountDto } from './dto/login-account.dto';
import express from 'express';
import { SESSION_NAME } from './constants';

@ApiTags('Dashboard Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: CreateAccountDto) {
    return this.authService.create(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginAccountDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const account = await this.authService.validateAccount(dto);

    const token = await this.authService.generateToken(
      account.id,
      account.email,
    );

    res.cookie(SESSION_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', //// HTTPS in production
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24, // 24hrs.
    });

    return { message: 'Authentication successful.', status: 200 };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Res({ passthrough: true }) res: express.Response) {
    res.clearCookie('orbit_session');
  }
}
