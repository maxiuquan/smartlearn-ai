import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateStudyPlanDto,
  UpdateStudyPlanDto,
  CreateDailyPlanDto,
  UpdateDailyPlanDto,
} from './dto/study-plan.dto';
import {
  StudyPlanResponseDto,
  DailyPlanResponseDto,
  PlanOverviewDto,
  ScheduleSuggestionDto,
} from './dto/response.dto';

@Injectable()
export class StudyPlanService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建备考计划
   */
  async create(userId: string, dto: CreateStudyPlanDto): Promise<StudyPlanResponseDto> {
    const plan = await this.prisma.studyPlan.create({
      data: {
        userId,
        examType: dto.examType,
        examDate: new Date(dto.examDate),
        targetScore: dto.targetScore,
        subjectPlan: dto.subjectPlan,
        status: 'ACTIVE',
      },
    });

    // 自动生成每日计划
    await this.generateDailyPlans(plan.id, userId, new Date(dto.examDate), dto.subjectPlan);

    return this.toPlanResponse(plan);
  }

  /**
   * 获取备考计划
   */
  async findOne(userId: string, planId: string): Promise<StudyPlanResponseDto> {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id: planId, userId },
    });

    if (!plan) {
      throw new NotFoundException('计划不存在');
    }

    return this.toPlanResponse(plan);
  }

  /**
   * 获取当前活跃计划
   */
  async getActivePlan(userId: string): Promise<StudyPlanResponseDto | null> {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan) return null;

    return this.toPlanResponse(plan);
  }

  /**
   * 更新备考计划
   */
  async update(
    userId: string,
    planId: string,
    dto: UpdateStudyPlanDto,
  ): Promise<StudyPlanResponseDto> {
    const plan = await this.prisma.studyPlan.update({
      where: { id: planId },
      data: {
        examDate: dto.examDate ? new Date(dto.examDate) : undefined,
        targetScore: dto.targetScore,
        subjectPlan: dto.subjectPlan as any,
        status: dto.status,
      },
    });

    return this.toPlanResponse(plan);
  }

  /**
   * 获取计划概览
   */
  async getOverview(userId: string, planId: string): Promise<PlanOverviewDto> {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id: planId, userId },
      include: {
        dailyPlans: {
          where: {
            date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
          orderBy: { date: 'asc' },
          take: 1,
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('计划不存在');
    }

    // 获取今日计划
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPlan = await this.prisma.dailyPlan.findFirst({
      where: { planId, date: today },
    });

    // 计算本周统计
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const weeklyPlans = await this.prisma.dailyPlan.findMany({
      where: {
        planId,
        date: { gte: weekStart },
      },
    });

    const weeklyStudyTime = weeklyPlans.reduce((sum, p) => sum + p.studyTime, 0);
    const weeklyCompletedTasks = weeklyPlans.reduce((sum, p) => sum + p.completedTasks, 0);

    return {
      plan: this.toPlanResponse(plan),
      todayPlan: todayPlan ? this.toDailyPlanResponse(todayPlan) : null,
      weeklyStudyTime,
      weeklyCompletedTasks,
    };
  }

  /**
   * 创建每日计划
   */
  async createDailyPlan(
    userId: string,
    dto: CreateDailyPlanDto,
  ): Promise<DailyPlanResponseDto> {
    const dailyPlan = await this.prisma.dailyPlan.create({
      data: {
        userId,
        planId: dto.planId,
        date: new Date(dto.date),
        tasks: dto.tasks,
        totalTasks: dto.tasks.length,
        status: 'PENDING',
      },
    });

    return this.toDailyPlanResponse(dailyPlan);
  }

  /**
   * 更新每日计划
   */
  async updateDailyPlan(
    userId: string,
    dailyPlanId: string,
    dto: UpdateDailyPlanDto,
  ): Promise<DailyPlanResponseDto> {
    const dailyPlan = await this.prisma.dailyPlan.update({
      where: { id: dailyPlanId },
      data: {
        completedTasks: dto.completedTasks,
        studyTime: dto.studyTime,
        status: dto.status,
      },
    });

    return this.toDailyPlanResponse(dailyPlan);
  }

  /**
   * 获取每日计划列表
   */
  async getDailyPlans(
    userId: string,
    planId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<DailyPlanResponseDto[]> {
    const where: any = { userId, planId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const plans = await this.prisma.dailyPlan.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return plans.map((p) => this.toDailyPlanResponse(p));
  }

  /**
   * 获取学习建议
   */
  async getSuggestions(userId: string, planId: string): Promise<ScheduleSuggestionDto[]> {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id: planId, userId },
    });

    if (!plan) {
      throw new NotFoundException('计划不存在');
    }

    const suggestions: ScheduleSuggestionDto[] = [];
    const subjectPlan = plan.subjectPlan as Record<string, number>;

    // 获取各学科进度
    for (const [subject, hours] of Object.entries(subjectPlan)) {
      const progress = await this.getSubjectProgress(userId, subject);

      // 根据进度生成建议
      if (progress.correctRate < 60) {
        suggestions.push({
          subject,
          duration: hours * 60,
          content: '正确率较低，建议复习基础知识点',
          priority: 1,
        });
      } else if (progress.correctRate < 80) {
        suggestions.push({
          subject,
          duration: hours * 45,
          content: '继续巩固，多做练习题',
          priority: 2,
        });
      } else {
        suggestions.push({
          subject,
          duration: hours * 30,
          content: '掌握良好，可以挑战难题',
          priority: 3,
        });
      }
    }

    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 生成每日计划
   */
  private async generateDailyPlans(
    planId: string,
    userId: string,
    examDate: Date,
    subjectPlan: Record<string, number>,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      // 根据学科分配生成任务
      const tasks = this.generateDailyTasks(subjectPlan, i, days);

      await this.prisma.dailyPlan.create({
        data: {
          userId,
          planId,
          date,
          tasks,
          totalTasks: tasks.length,
          status: 'PENDING',
        },
      });
    }
  }

  /**
   * 生成每日任务
   */
  private generateDailyTasks(
    subjectPlan: Record<string, number>,
    dayIndex: number,
    totalDays: number,
  ): any[] {
    const tasks: any[] = [];

    for (const [subject, hours] of Object.entries(subjectPlan)) {
      // 根据每天的时间分配生成任务
      tasks.push({
        subject,
        type: 'practice',
        duration: hours * 60, // 转换为分钟
        completed: false,
      });

      // 每周安排一次复习
      if (dayIndex % 7 === 6) {
        tasks.push({
          subject,
          type: 'review',
          duration: 30,
          completed: false,
        });
      }
    }

    return tasks;
  }

  /**
   * 获取学科进度
   */
  private async getSubjectProgress(userId: string, subject: string) {
    const records = await this.prisma.learningRecord.findMany({
      where: {
        userId,
        question: { subjectId: subject },
      },
    });

    const total = records.length;
    const correct = records.filter((r) => r.isCorrect).length;

    return {
      total,
      correct,
      correctRate: total > 0 ? (correct / total) * 100 : 0,
    };
  }

  /**
   * 转换为响应DTO
   */
  private toPlanResponse(plan: any): StudyPlanResponseDto {
    const remainingDays = Math.ceil(
      (new Date(plan.examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    return {
      id: plan.id,
      examType: plan.examType,
      examDate: plan.examDate,
      targetScore: plan.targetScore,
      subjectPlan: plan.subjectPlan,
      status: plan.status,
      remainingDays: Math.max(0, remainingDays),
      totalTasks: 0,
      completedTasks: 0,
      progress: 0,
    };
  }

  private toDailyPlanResponse(plan: any): DailyPlanResponseDto {
    const progress =
      plan.totalTasks > 0
        ? Math.round((plan.completedTasks / plan.totalTasks) * 100)
        : 0;

    return {
      id: plan.id,
      date: plan.date,
      tasks: plan.tasks,
      completedTasks: plan.completedTasks,
      totalTasks: plan.totalTasks,
      studyTime: plan.studyTime,
      status: plan.status,
      progress,
    };
  }
}
