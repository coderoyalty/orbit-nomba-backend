import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@app/database';
import { ClientApiModule } from './api/client-api.module';
import { DashboardApiModule } from './api/dashboard-api.module';
import { ProjectsModule } from './projects/projects.module';
import { PlansModule } from './plans/plans.module';
import { NombaModule } from '@orbit/nomba';
import { WebhookModule } from './webhook/webhook.module';
import { BullModule } from '@nestjs/bullmq';
import { QueueKeys } from 'bullmq';
import { QueueNames } from '@queue/queue';
import { QueueModule } from '@queue/queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    QueueModule,
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
