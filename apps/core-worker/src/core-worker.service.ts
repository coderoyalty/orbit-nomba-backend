import { Injectable } from '@nestjs/common';

@Injectable()
export class CoreWorkerService {
  getHello(): string {
    return 'Hello World!';
  }
}
