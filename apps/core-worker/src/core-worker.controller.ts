import { Controller, Get } from '@nestjs/common';
import { CoreWorkerService } from './core-worker.service';

@Controller()
export class CoreWorkerController {
  constructor(private readonly coreWorkerService: CoreWorkerService) {}

  @Get()
  getHello(): string {
    return this.coreWorkerService.getHello();
  }
}
