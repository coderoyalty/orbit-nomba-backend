import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { QueueModule } from '@queue/queue/queue.module';
import { NombaModule } from '@orbit/nomba';

@Module({
  imports: [QueueModule, NombaModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
