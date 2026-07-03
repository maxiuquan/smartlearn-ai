import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 全局验证管道
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

  // API版本控制
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // CORS配置
  app.enableCors({
    origin: configService.get('CORS_ORIGIN', '*'),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Swagger文档配置
  if (configService.get('SWAGGER_ENABLE', 'true') === 'true') {
    const config = new DocumentBuilder()
      .setTitle('SmartLearn AI API')
      .setDescription('智能学习系统后端API接口文档')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('users', '用户管理')
      .addTag('auth', '认证授权')
      .addTag('questions', '题库管理')
      .addTag('subjects', '学科管理')
      .addTag('knowledge-points', '知识点管理')
      .addTag('learning-records', '学习记录')
      .addTag('review', '复习系统')
      .addTag('study-plan', '备考规划')
      .addTag('vocabulary', '单词学习')
      .addTag('achievements', '成就系统')
      .addTag('real-exam', '真题管理')
      .addTag('exercise-books', '习题册管理')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(
      configService.get('SWAGGER_PATH', 'api-docs'),
      app,
      document,
    );
  }

  const port = configService.get('PORT', 3000);
  await app.listen(port);

  console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║                    SmartLearn AI API                         ║
  ╠══════════════════════════════════════════════════════════════╣
  ║  🚀 Application is running on: http://localhost:${port}          ║
  ║  📚 API Documentation: http://localhost:${port}/api-docs        ║
  ║  🌍 Environment: ${configService.get('NODE_ENV', 'development').padEnd(42)}║
  ╚══════════════════════════════════════════════════════════════╝
  `);
}

bootstrap();
