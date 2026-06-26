import { NestFactory } from '@nestjs/core';
import { CoreWorkerModule } from './core-worker.module';

async function bootstrap() {
  const app = await NestFactory.create(CoreWorkerModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
