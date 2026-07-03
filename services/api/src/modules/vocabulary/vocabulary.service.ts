import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateVocabularyDto, QueryVocabularyDto, SubmitVocabReviewDto } from './dto/vocabulary.dto';

@Injectable()
export class VocabularyService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateVocabularyDto) {
    return this.prisma.vocabulary.create({
      data: {
        word: dto.word,
        phonetic: dto.phonetic,
        meaning: dto.meaning,
        example: dto.example,
        category: dto.category,
        level: dto.level || 1,
        root: dto.root,
        affix: dto.affix,
        synonyms: dto.synonyms || [],
        antonyms: dto.antonyms || [],
      },
    });
  }

  async findAll(dto: QueryVocabularyDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (dto.category) where.category = dto.category;
    if (dto.keyword) {
      where.OR = [
        { word: { contains: dto.keyword, mode: 'insensitive' } },
        { meaning: { contains: dto.keyword, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.vocabulary.findMany({ where, skip, take: limit }),
      this.prisma.vocabulary.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const vocab = await this.prisma.vocabulary.findUnique({ where: { id } });
    if (!vocab) throw new NotFoundException('单词不存在');
    return vocab;
  }

  async getUserVocab(userId: string, dto: QueryVocabularyDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (dto.category) where.category = dto.category;
    if (dto.keyword) {
      where.OR = [
        { word: { contains: dto.keyword, mode: 'insensitive' } },
        { meaning: { contains: dto.keyword, mode: 'insensitive' } },
      ];
    }

    const vocabs = await this.prisma.vocabulary.findMany({
      where,
      skip,
      take: limit,
      include: {
        progress: { where: { userId } },
      },
    });

    return vocabs.map((v) => ({
      ...v,
      status: v.progress[0]?.status || 'NEW',
      progress: v.progress[0] || null,
    }));
  }

  async getReviewList(userId: string, limit: number = 20) {
    const now = new Date();
    const progress = await this.prisma.vocabularyProgress.findMany({
      where: {
        userId,
        OR: [
          { status: 'NEW' },
          { status: 'LEARNING', nextReviewAt: { lte: now } },
        ],
      },
      take: limit,
      include: { vocabulary: true },
    });

    return progress.map((p) => ({ ...p.vocabulary, progress: p }));
  }

  async submitReview(userId: string, vocabId: string, dto: SubmitVocabReviewDto) {
    const progress = await this.prisma.vocabularyProgress.findUnique({
      where: { userId_vocabularyId: { userId, vocabularyId: vocabId } },
    });

    const quality = dto.quality;
    let easeFactor = 2.5;
    let interval = 1;
    let repetitions = 0;
    let status: string = 'LEARNING';

    if (progress) {
      easeFactor = progress.easeFactor;
      interval = progress.interval;
      repetitions = progress.repetitions;

      if (quality >= 3) {
        if (repetitions === 0) interval = 1;
        else if (repetitions === 1) interval = 6;
        else interval = Math.round(interval * easeFactor);
        repetitions++;
        if (repetitions >= 3) status = 'FAMILIAR';
        if (repetitions >= 5) status = 'MASTERED';
      } else {
        repetitions = 0;
        interval = 1;
      }

      const newEf = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      easeFactor = Math.max(1.3, newEf);
    }

    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + interval);

    return this.prisma.vocabularyProgress.upsert({
      where: { userId_vocabularyId: { userId, vocabularyId: vocabId } },
      create: {
        userId,
        vocabularyId: vocabId,
        status: status as any,
        easeFactor,
        interval,
        repetitions,
        nextReviewAt,
        correctCount: quality >= 3 ? 1 : 0,
        wrongCount: quality < 3 ? 1 : 0,
      },
      update: {
        status: status as any,
        easeFactor,
        interval,
        repetitions,
        nextReviewAt,
        lastReviewAt: new Date(),
        correctCount: quality >= 3 ? { increment: 1 } : undefined,
        wrongCount: quality < 3 ? { increment: 1 } : undefined,
      },
    });
  }

  async getStats(userId: string) {
    const [total, newCount, learning, familiar, mastered] = await Promise.all([
      this.prisma.vocabularyProgress.count({ where: { userId } }),
      this.prisma.vocabularyProgress.count({ where: { userId, status: 'NEW' } }),
      this.prisma.vocabularyProgress.count({ where: { userId, status: 'LEARNING' } }),
      this.prisma.vocabularyProgress.count({ where: { userId, status: 'FAMILIAR' } }),
      this.prisma.vocabularyProgress.count({ where: { userId, status: 'MASTERED' } }),
    ]);

    return { total, new: newCount, learning, familiar, mastered };
  }
}
