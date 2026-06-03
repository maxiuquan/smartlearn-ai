import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// 模块导入
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { KnowledgePointsModule } from './modules/knowledge-points/knowledge-points.module';
import { LearningRecordsModule } from './modules/learning-records/learning-records.module';
import { ReviewModule } from './modules/review/review.module';
import { StudyPlanModule } from './modules/study-plan/study-plan.module';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { RealExamModule } from './modules/real-exam/real-exam.module';
import { ExerciseBooksModule } from './modules/exercise-books/exercise-books.module';

// 公共模块
import { PrismaModule } from './common/prisma/prisma.module';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local', '.env.production'],
    }),

    // 限流模块
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1分钟
        limit: 100, // 每分钟最多100次请求
      },
    ]),

    // Passport认证模块
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JWT模块
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'smartlearn-secret-key'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
      inject: [ConfigService],
    }),

    // 公共模块
    PrismaModule,

    // 业务模块
    UsersModule,
    AuthModule,
    QuestionsModule,
    SubjectsModule,
    KnowledgePointsModule,
    LearningRecordsModule,
    ReviewModule,
    StudyPlanModule,
    VocabularyModule,
    AchievementsModule,
    RealExamModule,
    ExerciseBooksModule,
  ],
  providers: [
    // 全局限流守卫
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
