import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ResponseTransformInterceptor } from './shared/interceptors/resp-transform.interceptor';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DashboardApiModule } from './api/dashboard-api.module';
import { ClientApiModule } from './api/client-api.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalInterceptors(new ResponseTransformInterceptor());
  app.use(cookieParser());

  const dashboardConfig = new DocumentBuilder()
    .setTitle('Orbit Dashboard API')
    .setDescription('Internal API for the web dashboard UI.')
    .setVersion('1.0')
    .addCookieAuth()
    .build();

  const dashboardDocument = SwaggerModule.createDocument(app, dashboardConfig, {
    include: [DashboardApiModule],
    deepScanRoutes: true,
  });

  SwaggerModule.setup('docs/dashboard', app, dashboardDocument);

  const publicConfig = new DocumentBuilder()
    .setTitle('Orbit Subscription Engine API')
    .setDescription('Public REST API for downstream application integration.')
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', name: 'Authorization', in: 'header' },
      'ProjectApiKey',
    )
    .build();

  const publicDocument = SwaggerModule.createDocument(app, publicConfig, {
    include: [ClientApiModule],
    deepScanRoutes: true,
  });
  SwaggerModule.setup('docs/v1', app, publicDocument);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
