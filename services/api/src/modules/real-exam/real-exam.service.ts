import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateExamPaperDto, StartExamDto, SubmitExamDto, QueryExamPaperDto } from './dto/exam.dto';

@Injectable()
export class RealExamService {
  constructor(private prisma: PrismaService) {}

  async createPaper(dto: CreateExamPaperDto) {
    return this.prisma.examPaper.create({
      data: {
        subjectId: dto.subjectId,
        name: dto.name,
        year: dto.year,
        examType: dto.examType,
        totalScore: dto.totalScore,
        duration: dto.duration,
        sections: dto.sections,
        source: dto.source,
      },
    });
  }

  async findPapers(dto: QueryExamPaperDto) {
    const where: any = {};
    if (dto.subjectId) where.subjectId = dto.subjectId;
    if (dto.year) where.year = dto.year;
    if (dto.examType) where.examType = dto.examType;

    return this.prisma.examPaper.findMany({
      where,
      orderBy: { year: 'desc' },
    });
  }

  async findPaper(id: string) {
    const paper = await this.prisma.examPaper.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { question: true },
        },
      },
    });
    if (!paper) throw new NotFoundException('试卷不存在');
    return paper;
  }

  async startExam(userId: string, dto: StartExamDto) {
    const paper = await this.prisma.examPaper.findUnique({
      where: { id: dto.paperId },
    });
    if (!paper) throw new NotFoundException('试卷不存在');

    // 检查是否有未完成的考试
    const existing = await this.prisma.examRecord.findFirst({
      where: { userId, paperId: dto.paperId, status: 'IN_PROGRESS' },
    });
    if (existing) return existing;

    return this.prisma.examRecord.create({
      data: {
        userId,
        paperId: dto.paperId,
        answers: {},
        startTime: new Date(),
        status: 'IN_PROGRESS',
      },
    });
  }

  async submitExam(userId: string, recordId: string, dto: SubmitExamDto) {
    const record = await this.prisma.examRecord.findFirst({
      where: { id: recordId, userId, status: 'IN_PROGRESS' },
      include: {
        paper: {
          include: { questions: { include: { question: true } } },
        },
      },
    });
    if (!record) throw new NotFoundException('考试记录不存在');

    // 计算得分
    let score = 0;
    for (const q of record.paper.questions) {
      const userAnswer = dto.answers[q.order];
      if (userAnswer && this.checkAnswer(q.question.answer, userAnswer)) {
        score += q.score;
      }
    }

    return this.prisma.examRecord.update({
      where: { id: recordId },
      data: {
        answers: dto.answers,
        score,
        endTime: new Date(),
        timeSpent: Math.round((Date.now() - record.startTime.getTime()) / 1000),
        status: 'COMPLETED',
      },
    });
  }

  async getRecords(userId: string) {
    return this.prisma.examRecord.findMany({
      where: { userId },
      include: { paper: true },
      orderBy: { startTime: 'desc' },
    });
  }

  async getRecordDetail(userId: string, recordId: string) {
    const record = await this.prisma.examRecord.findFirst({
      where: { id: recordId, userId },
      include: {
        paper: {
          include: { questions: { include: { question: true } } },
        },
      },
    });
    if (!record) throw new NotFoundException('考试记录不存在');
    return record;
  }

  private checkAnswer(correct: string, user: string): boolean {
    return correct.trim().toLowerCase() === user.trim().toLowerCase();
  }
}
