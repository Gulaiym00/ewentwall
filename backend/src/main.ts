import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { LocalStorageService } from './storage/local-storage.service.js';

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  return app;
}

/** Shared by main.ts and the e2e tests so both run the same pipeline. */
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService<Env, true>);

  app.set('trust proxy', 1); // correct client IPs behind a reverse proxy (rate limit, audit log)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // photos are loaded by the frontend origin
  app.enableCors({
    origin: [config.get('FRONTEND_URL', { infer: true }), ...config.get('CORS_ORIGINS', { infer: true })],
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  // Uploaded files (local storage driver) at {API_URL}/uploads/...
  app.useStaticAssets(app.get(LocalStorageService).root, {
    prefix: '/uploads/',
    maxAge: '30d',
    immutable: true, // keys are random UUIDs, a file never changes
    index: false,
  });

  const docs = new DocumentBuilder()
    .setTitle('EventWall API')
    .setDescription('Organizer, guest and admin API. Send `Authorization: Bearer <accessToken>` (users) or `<guestToken>` (guests).')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, docs));
}

async function bootstrap() {
  const app = await createApp();
  const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0'); // all IPv4 interfaces: hosts like Render probe the service over IPv4
  console.log(`API ready on http://localhost:${port}/api  ·  docs: http://localhost:${port}/api/docs`);
}

// Only start the server when run directly (not when imported by tests).
if (process.env.NODE_ENV !== 'test') await bootstrap();
