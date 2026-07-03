import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateExerciseBookDto, AddQuestionToBookDto, QueryExerciseBookDto, UpdateProgressDto } from './dto/exercise-book.dto';

@Injectable()
export class ExerciseBooksService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateExerciseBookDto) {
    return this.prisma.exerciseBook.create({
      data: {
        subjectId: dto.subjectId,
        name: dto.name,
        code: dto.code,
        author: dto.author,
        publisher: dto.publisher,
        year: dto.year,
        description: dto.description,
        cover: dto.cover,
      },
    });
  }

  async findAll(dto: QueryExerciseBookDto) {
    const where: any = {};
    if (dto.subjectId) where.subjectId = dto.subjectId;

    return this.prisma.exerciseBook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const book = await this.prisma.exerciseBook.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { progress: true },
        },
      },
    });
    if (!book) throw new NotFoundException('习题册不存在');
    return book;
  }

  async addQuestion(bookId: string, dto: AddQuestionToBookDto) {
    const question = await this.prisma.exerciseBookQuestion.create({
      data: {
        bookId,
        questionId: dto.questionId,
        chapter: dto.chapter,
        section: dto.section,
        order: dto.order,
      },
    });

    // 更新总数
    await this.prisma.exerciseBook.update({
      where: { id: bookId },
      data: { totalQuestions: { increment: 1 } },
    });

    return question;
  }

  async getUserProgress(userId: string, bookId: string) {
    const progress = await this.prisma.exerciseProgress.findMany({
      where: { userId, bookQuestion: { bookId } },
      include: { bookQuestion: { include: { question: true } } },
    });

    const total = await this.prisma.exerciseBookQuestion.count({
      where: { bookId },
    });

    const completed = progress.filter((p) => p.status === 'COMPLETED').length;

    return {
      total,
      completed,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      details: progress,
    };
  }

  async updateProgress(
    userId: string,
    bookQuestionId: string,
    dto: UpdateProgressDto,
  ) {
    const status = dto.isCorrect !== undefined ? 'COMPLETED' : 'IN_PROGRESS';

    return this.prisma.exerciseProgress.upsert({
      where: { userId_bookQuestionId: { userId, bookQuestionId } },
      create: {
        userId,
        bookQuestionId,
        status: status as any,
        userAnswer: dto.userAnswer,
        isCorrect: dto.isCorrect,
        timeSpent: dto.timeSpent,
        attemptedAt: new Date(),
      },
      update: {
        status: status as any,
        userAnswer: dto.userAnswer,
        isCorrect: dto.isCorrect,
        timeSpent: dto.timeSpent,
        attemptedAt: new Date(),
      },
    });
  }

  async getStats(userId: string) {
    const books = await this.prisma.exerciseBook.findMany({
      include: {
        questions: {
          include: {
            progress: { where: { userId } },
          },
        },
      },
    });

    return books.map((book) => {
      const total = book.questions.length;
      const completed = book.questions.filter((q) =>
        q.progress.some((p) => p.status === 'COMPLETED'),
      ).length;

      return {
        id: book.id,
        name: book.name,
        code: book.code,
        total,
        completed,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
  }
}
