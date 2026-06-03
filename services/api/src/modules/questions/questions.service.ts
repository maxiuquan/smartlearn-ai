import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  QueryQuestionDto,
  SubmitAnswerDto,
} from './dto/question.dto';
import {
  QuestionResponseDto,
  QuestionListResponseDto,
  AnswerResultDto,
  QuestionStatsDto,
} from './dto/response.dto';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建题目
   */
  async create(dto: CreateQuestionDto): Promise<QuestionResponseDto> {
    const question = await this.prisma.question.create({
      data: {
        subjectId: dto.subjectId,
        categoryId: dto.categoryId,
        type: dto.type,
        difficulty: dto.difficulty || 'MEDIUM',
        content: dto.content,
        options: dto.options,
        answer: dto.answer,
        analysis: dto.analysis,
        tags: dto.tags || [],
        keywords: dto.keywords || [],
        source: dto.source,
        sourceYear: dto.sourceYear,
        sourceBook: dto.sourceBook,
      },
    });

    // 关联知识点
    if (dto.knowledgePointIds && dto.knowledgePointIds.length > 0) {
      await this.prisma.questionKnowledgePoint.createMany({
        data: dto.knowledgePointIds.map((kpId) => ({
          questionId: question.id,
          knowledgeId: kpId,
        })),
        skipDuplicates: true,
      });
    }

    return this.toQuestionResponse(question);
  }

  /**
   * 批量创建题目
   */
  async createMany(dtos: CreateQuestionDto[]): Promise<{ count: number }> {
    const questions = await this.prisma.question.createMany({
      data: dtos.map((dto) => ({
        subjectId: dto.subjectId,
        categoryId: dto.categoryId,
        type: dto.type,
        difficulty: dto.difficulty || 'MEDIUM',
        content: dto.content,
        options: dto.options,
        answer: dto.answer,
        analysis: dto.analysis,
        tags: dto.tags || [],
        keywords: dto.keywords || [],
        source: dto.source,
        sourceYear: dto.sourceYear,
        sourceBook: dto.sourceBook,
      })),
    });

    return { count: questions.count };
  }

  /**
   * 获取题目列表
   */
  async findAll(dto: QueryQuestionDto): Promise<QuestionListResponseDto> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (dto.subjectId) where.subjectId = dto.subjectId;
    if (dto.categoryId) where.categoryId = dto.categoryId;
    if (dto.type) where.type = dto.type;
    if (dto.difficulty) where.difficulty = dto.difficulty;
    if (dto.tag) where.tags = { has: dto.tag };
    if (dto.keyword) {
      where.OR = [
        { content: { contains: dto.keyword, mode: 'insensitive' } },
        { keywords: { has: dto.keyword } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          knowledgePoints: {
            include: {
              knowledgePoint: true,
            },
          },
        },
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      items: items.map((q) => this.toQuestionResponse(q)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取单个题目
   */
  async findOne(id: string): Promise<QuestionResponseDto> {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        knowledgePoints: {
          include: {
            knowledgePoint: true,
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('题目不存在');
    }

    return this.toQuestionResponse(question);
  }

  /**
   * 更新题目
   */
  async update(id: string, dto: UpdateQuestionDto): Promise<QuestionResponseDto> {
    const question = await this.prisma.question.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        difficulty: dto.difficulty,
        content: dto.content,
        options: dto.options,
        answer: dto.answer,
        analysis: dto.analysis,
        tags: dto.tags,
        keywords: dto.keywords,
        status: dto.status,
      },
    });

    return this.toQuestionResponse(question);
  }

  /**
   * 删除题目
   */
  async remove(id: string): Promise<void> {
    await this.prisma.question.delete({
      where: { id },
    });
  }

  /**
   * 提交答案
   */
  async submitAnswer(
    questionId: string,
    userId: string,
    dto: SubmitAnswerDto,
  ): Promise<AnswerResultDto> {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        knowledgePoints: {
          include: {
            knowledgePoint: true,
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('题目不存在');
    }

    // 判断答案是否正确
    const isCorrect = this.checkAnswer(question.answer, dto.answer);

    // 创建学习记录
    await this.prisma.learningRecord.create({
      data: {
        userId,
        questionId,
        userAnswer: dto.answer,
        isCorrect,
        timeSpent: dto.timeSpent || 0,
        mode: (dto.mode as any) || 'PRACTICE',
      },
    });

    // 更新题目统计
    await this.prisma.question.update({
      where: { id: questionId },
      data: {
        attemptCount: { increment: 1 },
        correctCount: isCorrect ? { increment: 1 } : undefined,
      },
    });

    // 如果答错，加入错题本
    if (!isCorrect) {
      await this.prisma.errorQuestion.upsert({
        where: {
          userId_questionId: {
            userId,
            questionId,
          },
        },
        create: {
          userId,
          questionId,
          wrongAnswer: dto.answer,
        },
        update: {
          wrongAnswer: dto.answer,
          wrongCount: { increment: 1 },
          lastWrongAt: new Date(),
          mastered: false,
          masteredAt: null,
        },
      });
    }

    return {
      isCorrect,
      correctAnswer: question.answer,
      userAnswer: dto.answer,
      analysis: question.analysis || '',
      knowledgePoints: question.knowledgePoints.map((kp) => kp.knowledgePoint.name),
    };
  }

  /**
   * 获取随机题目
   */
  async getRandom(
    subjectId: string,
    count: number = 10,
    difficulty?: string,
  ): Promise<QuestionResponseDto[]> {
    const where: any = { subjectId };
    if (difficulty) where.difficulty = difficulty;

    const questions = await this.prisma.question.findMany({
      where,
      take: count * 3, // 取更多以便随机
      orderBy: { attemptCount: 'asc' }, // 优先返回答得少的题
    });

    // 随机打乱并取指定数量
    const shuffled = questions.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((q) => this.toQuestionResponse(q));
  }

  /**
   * 获取题目统计
   */
  async getStats(): Promise<QuestionStatsDto> {
    const [total, byType, byDifficulty, bySubject] = await Promise.all([
      this.prisma.question.count(),
      this.prisma.question.groupBy({
        by: ['type'],
        _count: true,
      }),
      this.prisma.question.groupBy({
        by: ['difficulty'],
        _count: true,
      }),
      this.prisma.question.groupBy({
        by: ['subjectId'],
        _count: true,
      }),
    ]);

    return {
      total,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {} as any),
      byDifficulty: byDifficulty.reduce((acc, item) => {
        acc[item.difficulty] = item._count;
        return acc;
      }, {} as any),
      bySubject: bySubject.reduce((acc, item) => {
        acc[item.subjectId] = item._count;
        return acc;
      }, {} as any),
    };
  }

  /**
   * 检查答案是否正确
   */
  private checkAnswer(correctAnswer: string, userAnswer: string): boolean {
    // 标准化答案比较
    const normalized1 = correctAnswer.trim().toLowerCase();
    const normalized2 = userAnswer.trim().toLowerCase();
    return normalized1 === normalized2;
  }

  /**
   * 转换为响应DTO
   */
  private toQuestionResponse(question: any): QuestionResponseDto {
    const correctRate =
      question.attemptCount > 0
        ? (question.correctCount / question.attemptCount) * 100
        : 0;

    return {
      id: question.id,
      subjectId: question.subjectId,
      categoryId: question.categoryId,
      type: question.type,
      difficulty: question.difficulty,
      content: question.content,
      options: question.options,
      answer: question.answer,
      analysis: question.analysis,
      tags: question.tags,
      keywords: question.keywords,
      source: question.source,
      sourceYear: question.sourceYear,
      attemptCount: question.attemptCount,
      correctCount: question.correctCount,
      correctRate: Math.round(correctRate * 100) / 100,
      favoriteCount: question.favoriteCount,
      knowledgePoints: question.knowledgePoints?.map((kp: any) => kp.knowledgePoint?.id || kp.knowledgeId) || [],
      createdAt: question.createdAt,
    };
  }
}
