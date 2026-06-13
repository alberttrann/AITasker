import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());

  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin:      allowedOrigins,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('AITasker API')
    .setDescription('AITasker backend — 91 endpoints across 3 engagement paths')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .build();
  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`  Backend running on http://localhost:${port}`);
  console.log(`  Swagger docs at http://localhost:${port}/api`);
  console.log(`  Health check at http://localhost:${port}/health`);
  console.log(`  CORS allowed: ${allowedOrigins.join(', ')}`);
}

bootstrap();
