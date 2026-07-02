import { Module } from '@nestjs/common';
import { CoreWorkerService } from './core-worker.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@app/database';
import { QueueNames } from '@queue/queue';
import { SubscriptionProcessor } from './subscriptions/subscription.processor';
import { SubscriptionService } from './subscriptions/subscription.service';

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
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true, // Keep Redis memory lean
          removeOnFail: false, // Leave failed jobs in Redis for debugging
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: QueueNames.SUBSCRIPTIONS }),
    DatabaseModule,
  ],
  providers: [CoreWorkerService, SubscriptionService, SubscriptionProcessor],
})
export class CoreWorkerModule {}
