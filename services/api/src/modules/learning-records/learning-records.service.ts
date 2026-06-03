import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLearningRecordDto, QueryLearningRecordDto } from './dto/learning-record.dto';
import {
  LearningRecordListDto,
  LearningProgressDto,
  DailyStatsDto,
} from './dto/response.dto';

@Injectable()
export class LearningRecordsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建学习记录
   */
  async create(userId: string, dto: CreateLearningRecordDto) {
    // 获取题目信息
    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
    });

    if (!question) {
      throw new Error('题目不存在');
    }

    // 判断答案是否正确
    const isCorrect = this.checkAnswer(question.answer, dto.userAnswer);

    // 创建学习记录
    const record = await this.prisma.learningRecord.create({
      data: {
        userId,
        questionId: dto.questionId,
        userAnswer: dto.userAnswer,
        isCorrect,
        timeSpent: dto.timeSpent || 0,
        mode: dto.mode || 'PRACTICE',
      },
    });

    // 更新用户统计
    await this.updateUserStats(userId, isCorrect, dto.timeSpent || 0);

    // 更新题目统计
    await this.prisma.question.update({
      where: { id: dto.questionId },
      data: {
        attemptCount: { increment: 1 },
        correctCount: isCorrect ? { increment: 1 } : undefined,
      },
    });

    return record;
  }

  /**
   * 获取学习记录列表
   */
  async findAll(userId: string, dto: QueryLearningRecordDto): Promise<LearningRecordListDto> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (dto.subjectId) {
      where.question = { subjectId: dto.subjectId };
    }

    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) where.createdAt.gte = new Date(dto.startDate);
      if (dto.endDate) where.createdAt.lte = new Date(dto.endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.learningRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { question: true },
      }),
      this.prisma.learningRecord.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        questionId: item.questionId,
        userAnswer: item.userAnswer,
        isCorrect: item.isCorrect,
        timeSpent: item.timeSpent,
        mode: item.mode,
        createdAt: item.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * 获取学习进度
   */
  async getProgress(userId: string): Promise<LearningProgressDto[]> {
    const records = await this.prisma.learningRecord.findMany({
      where: { userId },
      include: {
        question: {
          include: { subject: true },
        },
      },
    });

    // 按学科分组统计
    const subjectMap = new Map<string, any>();

    for (const record of records) {
      const subjectId = record.question.subjectId;
      const subjectName = record.question.subject.name;

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subjectId,
          subjectName,
          totalQuestions: 0,
          correctCount: 0,
          totalTime: 0,
        });
      }

      const stats = subjectMap.get(subjectId);
      stats.totalQuestions++;
      if (record.isCorrect) stats.correctCount++;
      stats.totalTime += record.timeSpent;
    }

    return Array.from(subjectMap.values()).map((stats) => ({
      subjectId: stats.subjectId,
      subjectName: stats.subjectName,
      totalQuestions: stats.totalQuestions,
      correctCount: stats.correctCount,
      correctRate:
        stats.totalQuestions > 0
          ? Math.round((stats.correctCount / stats.totalQuestions) * 10000) / 100
          : 0,
      totalTime: Math.round(stats.totalTime / 60),
      avgTime:
        stats.totalQuestions > 0
          ? Math.round(stats.totalTime / stats.totalQuestions)
          : 0,
    }));
  }

  /**
   * 获取每日统计
   */
  async getDailyStats(userId: string, days: number = 7): Promise<DailyStatsDto[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const records = await this.prisma.learningRecord.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
    });

    // 按日期分组
    const dateMap = new Map<string, any>();

    for (const record of records) {
      const date = record.createdAt.toISOString().split('T')[0];

      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          questionCount: 0,
          correctCount: 0,
          studyTime: 0,
        });
      }

      const stats = dateMap.get(date);
      stats.questionCount++;
      if (record.isCorrect) stats.correctCount++;
      stats.studyTime += record.timeSpent;
    }

    return Array.from(dateMap.values())
      .map((stats) => ({
        date: stats.date,
        questionCount: stats.questionCount,
        correctCount: stats.correctCount,
        correctRate:
          stats.questionCount > 0
            ? Math.round((stats.correctCount / stats.questionCount) * 10000) / 100
            : 0,
        studyTime: Math.round(stats.studyTime / 60),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 更新用户统计
   */
  private async updateUserStats(
    userId: string,
    isCorrect: boolean,
    timeSpent: number,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const newTotal = user.totalQuestions + 1;
    const newCorrect = user.totalQuestions * (user.correctRate / 100) + (isCorrect ? 1 : 0);
    const newRate = (newCorrect / newTotal) * 100;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totalQuestions: newTotal,
        correctRate: Math.round(newRate * 100) / 100,
        totalStudyTime: { increment: Math.round(timeSpent / 60) },
      },
    });
  }

  /**
   * 检查答案
   */
  private checkAnswer(correctAnswer: string, userAnswer: string): boolean {
    return correctAnswer.trim().toLowerCase() === userAnswer.trim().toLowerCase();
  }
}
