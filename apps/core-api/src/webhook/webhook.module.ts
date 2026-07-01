import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { QueueModule } from '@queue/queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
