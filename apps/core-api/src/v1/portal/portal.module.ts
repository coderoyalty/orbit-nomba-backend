import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { QueueModule } from '@queue/queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
