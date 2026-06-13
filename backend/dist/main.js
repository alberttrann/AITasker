"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
const zod_validation_pipe_1 = require("./common/pipes/zod-validation.pipe");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalPipes(new zod_validation_pipe_1.ZodValidationPipe());
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    app.enableCors({
        origin: allowedOrigins,
        credentials: true,
    });
    const config = new swagger_1.DocumentBuilder()
        .setTitle('AITasker API')
        .setDescription('AITasker backend — 91 endpoints across 3 engagement paths')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
        .build();
    swagger_1.SwaggerModule.setup('api', app, swagger_1.SwaggerModule.createDocument(app, config));
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`  Backend running on http://localhost:${port}`);
    console.log(`  Swagger docs at http://localhost:${port}/api`);
    console.log(`  Health check at http://localhost:${port}/health`);
    console.log(`  CORS allowed: ${allowedOrigins.join(', ')}`);
}
bootstrap();
//# sourceMappingURL=main.js.map