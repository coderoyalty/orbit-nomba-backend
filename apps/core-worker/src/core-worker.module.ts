import { Module } from '@nestjs/common';
import { CoreWorkerController } from './core-worker.controller';
import { CoreWorkerService } from './core-worker.service';

@Module({
  imports: [],
  controllers: [CoreWorkerController],
  providers: [CoreWorkerService],
})
export class CoreWorkerModule {}
