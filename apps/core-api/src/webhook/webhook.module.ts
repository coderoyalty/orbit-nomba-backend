import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { QueueModule } from '@queue/queue/queue.module';
import { NombaModule, NombaService } from '@orbit/nomba';

@Module({
  imports: [QueueModule, NombaModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
