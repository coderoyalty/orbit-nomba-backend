import { Test, TestingModule } from '@nestjs/testing';
import { CoreWorkerController } from './core-worker.controller';
import { CoreWorkerService } from './core-worker.service';

describe('CoreWorkerController', () => {
  let coreWorkerController: CoreWorkerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CoreWorkerController],
      providers: [CoreWorkerService],
    }).compile();

    coreWorkerController = app.get<CoreWorkerController>(CoreWorkerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(coreWorkerController.getHello()).toBe('Hello World!');
    });
  });
});
