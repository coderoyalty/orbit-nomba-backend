import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/database';
import { PublicApiModule } from './api/public-api.module';
import { DashboardApiModule } from './api/dashboard-api.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    PublicApiModule,
    DashboardApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
