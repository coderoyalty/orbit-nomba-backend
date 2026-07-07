import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { AuthService } from './auth.service';
import { ApiTags } from '@nestjs/swagger';
import { LoginAccountDto } from './dto/login-account.dto';
import express from 'express';
import { SESSION_NAME } from './constants';
import { CurrentAccount } from '../shared/decorators/current-account.decorator';
import { DashboardAuthGuard } from '../shared/guards/dashboard-auth.guard';

@ApiTags('Dashboard Auth')
@Controller('dashboard/auth')
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

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(SESSION_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24, // 24hrs.
    });

    return { message: 'Authentication successful.', status: 200 };
  }

  @UseGuards(DashboardAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Res({ passthrough: true }) res: express.Response) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('orbit_session', {
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });
  }

  @UseGuards(DashboardAuthGuard)
  @Get('/me')
  async authUser(@CurrentAccount('sub') accountId: string) {
    return await this.authService.authMe(accountId);
  }
}
