import { NestFactory } from '@nestjs/core';
import { CoreWorkerModule } from './core-worker.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('CoreWorker');

  const app = await NestFactory.createApplicationContext(CoreWorkerModule);

  // Enable graceful shutdown hooks.
  // This is critical for BullMQ. If the container is killed (e.g., during deployment),
  // this tells the worker to finish the current job before shutting down, preventing data corruption.
  app.enableShutdownHooks();

  logger.log('Orbit Background Engine is initialized and listening to Redis.');
}

bootstrap();
