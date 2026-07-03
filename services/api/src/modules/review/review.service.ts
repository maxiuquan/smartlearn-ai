import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateReviewTaskDto, SubmitReviewDto, QueryReviewTaskDto } from './dto/review.dto';
import { ReviewTaskResponseDto, ReviewStatsDto, ForgettingCurveDto } from './dto/response.dto';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建复习任务
   */
  async create(userId: string, dto: CreateReviewTaskDto): Promise<ReviewTaskResponseDto> {
    const task = await this.prisma.reviewTask.create({
      data: {
        userId,
        questionId: dto.questionId,
        knowledgeId: dto.knowledgeId,
        type: dto.type,
        nextReviewAt: dto.nextReviewAt ? new Date(dto.nextReviewAt) : new Date(),
        status: 'PENDING',
      },
    });

    return this.toResponse(task);
  }

  /**
   * 获取复习任务列表
   */
  async findAll(userId: string, dto: QueryReviewTaskDto): Promise<ReviewTaskResponseDto[]> {
    const where: any = { userId };

    if (dto.status) where.status = dto.status;
    if (dto.type) where.type = dto.type;
    if (dto.date) {
      const date = new Date(dto.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.nextReviewAt = { gte: date, lt: nextDay };
    }

    const tasks = await this.prisma.reviewTask.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { nextReviewAt: 'asc' }],
    });

    return tasks.map((t) => this.toResponse(t));
  }

  /**
   * 获取今日复习任务
   */
  async getTodayTasks(userId: string): Promise<ReviewTaskResponseDto[]> {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const tasks = await this.prisma.reviewTask.findMany({
      where: {
        userId,
        status: 'PENDING',
        nextReviewAt: { lte: endOfDay },
      },
      orderBy: [{ priority: 'desc' }, { nextReviewAt: 'asc' }],
      take: 50,
    });

    return tasks.map((t) => this.toResponse(t));
  }

  /**
   * 提交复习结果 (SM-2算法)
   */
  async submitReview(taskId: string, userId: string, dto: SubmitReviewDto): Promise<ReviewTaskResponseDto> {
    const task = await this.prisma.reviewTask.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new NotFoundException('复习任务不存在');
    }

    // SM-2算法计算下次复习时间
    const { easeFactor, interval, repetitions } = this.calculateNextReview(
      task.easeFactor,
      task.interval,
      task.repetitions,
      dto.quality,
    );

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + interval);

    const updated = await this.prisma.reviewTask.update({
      where: { id: taskId },
      data: {
        easeFactor,
        interval,
        repetitions,
        nextReviewAt,
        lastReviewAt: new Date(),
        status: 'COMPLETED',
      },
    });

    // 如果是知识点复习，更新掌握度
    if (task.knowledgeId) {
      await this.updateKnowledgeProgress(userId, task.knowledgeId, dto.quality);
    }

    return this.toResponse(updated);
  }

  /**
   * 跳过复习
   */
  async skipReview(taskId: string, userId: string): Promise<ReviewTaskResponseDto> {
    const task = await this.prisma.reviewTask.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new NotFoundException('复习任务不存在');
    }

    // 推迟一天
    const nextReviewAt = new Date(task.nextReviewAt);
    nextReviewAt.setDate(nextReviewAt.getDate() + 1);

    const updated = await this.prisma.reviewTask.update({
      where: { id: taskId },
      data: {
        nextReviewAt,
        status: 'SKIPPED',
      },
    });

    return this.toResponse(updated);
  }

  /**
   * 获取复习统计
   */
  async getStats(userId: string): Promise<ReviewStatsDto> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [pending, today, overdue, completedToday, totalCompleted] = await Promise.all([
      this.prisma.reviewTask.count({
        where: { userId, status: 'PENDING' },
      }),
      this.prisma.reviewTask.count({
        where: {
          userId,
          status: 'PENDING',
          nextReviewAt: { lte: endOfDay },
        },
      }),
      this.prisma.reviewTask.count({
        where: {
          userId,
          status: 'PENDING',
          nextReviewAt: { lt: startOfDay },
        },
      }),
      this.prisma.reviewTask.count({
        where: {
          userId,
          status: 'COMPLETED',
          lastReviewAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      this.prisma.reviewTask.count({
        where: { userId, status: 'COMPLETED' },
      }),
    ]);

    return {
      pending,
      today,
      overdue,
      completedToday,
      totalCompleted,
    };
  }

  /**
   * 获取遗忘曲线数据
   */
  async getForgettingCurve(userId: string, days: number = 30): Promise<ForgettingCurveDto[]> {
    const curve: ForgettingCurveDto[] = [];

    for (let day = 0; day <= days; day++) {
      // 基于艾宾浩斯遗忘曲线: R = e^(-t/S)
      // S是记忆稳定性，这里简化计算
      const retention = Math.exp(-day / 10) * 100;
      curve.push({
        day,
        retention: Math.round(retention * 100) / 100,
      });
    }

    return curve;
  }

  /**
   * SM-2算法计算下次复习时间
   */
  private calculateNextReview(
    ef: number,
    interval: number,
    repetitions: number,
    quality: number,
  ): { easeFactor: number; interval: number; repetitions: number } {
    // 质量评分 0-5, >=3表示回忆成功
    if (quality >= 3) {
      // 回忆成功
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * ef);
      }
      repetitions++;
    } else {
      // 回忆失败
      repetitions = 0;
      interval = 1;
    }

    // 更新难度因子
    const newEf = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    const easeFactor = Math.max(1.3, newEf);

    return { easeFactor, interval, repetitions };
  }

  /**
   * 更新知识点掌握度
   */
  private async updateKnowledgeProgress(
    userId: string,
    knowledgeId: string,
    quality: number,
  ): Promise<void> {
    const progress = await this.prisma.knowledgeProgress.findUnique({
      where: { userId_knowledgeId: { userId, knowledgeId } },
    });

    const masteryChange = quality * 10; // 简化计算

    if (progress) {
      const newMastery = Math.min(100, Math.max(0, progress.masteryLevel + masteryChange - 30));
      await this.prisma.knowledgeProgress.update({
        where: { id: progress.id },
        data: {
          masteryLevel: newMastery,
          attemptCount: { increment: 1 },
          correctCount: quality >= 3 ? { increment: 1 } : undefined,
          lastPracticeAt: new Date(),
        },
      });
    } else {
      await this.prisma.knowledgeProgress.create({
        data: {
          userId,
          knowledgeId,
          masteryLevel: Math.max(0, masteryChange - 30),
          attemptCount: 1,
          correctCount: quality >= 3 ? 1 : 0,
          lastPracticeAt: new Date(),
        },
      });
    }
  }

  /**
   * 转换为响应DTO
   */
  private toResponse(task: any): ReviewTaskResponseDto {
    return {
      id: task.id,
      questionId: task.questionId,
      knowledgeId: task.knowledgeId,
      type: task.type,
      easeFactor: task.easeFactor,
      interval: task.interval,
      repetitions: task.repetitions,
      nextReviewAt: task.nextReviewAt,
      lastReviewAt: task.lastReviewAt,
      status: task.status,
      priority: task.priority,
    };
  }
}
