import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/database';
import { ClientApiModule } from './api/client-api.module';
import { DashboardApiModule } from './api/dashboard-api.module';
import { RouterModule } from '@nestjs/core';
import { ProjectsModule } from './projects/projects.module';
import { PlansModule } from './plans/plans.module';
import { HttpModule } from '@nestjs/axios';
import { NombaModule } from '@orbit/nomba';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ClientApiModule,
    DashboardApiModule,
    ProjectsModule,
    PlansModule,
    NombaModule,
    WebhookModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
