import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { DashboardAuthGuard } from './guards/dashboard-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      signOptions: {
        expiresIn: '24hr',
      },
      secret: process.env.JWT_SECRET!,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, DashboardAuthGuard],
  exports: [DashboardAuthGuard, JwtModule],
})
export class AuthCoreModule {}
