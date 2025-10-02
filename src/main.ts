import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: true,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'], 
  });

  // API prefix
  app.setGlobalPrefix(process.env.API_PREFIX || 'api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('TradeShip API')
    .setDescription('TradeShip Backend API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Graceful shutdown
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 TradeShip API is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
