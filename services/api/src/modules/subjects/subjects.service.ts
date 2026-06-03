import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSubjectDto) {
    const existing = await this.prisma.subject.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException('学科代码已存在');
    }

    return this.prisma.subject.create({
      data: {
        name: dto.name,
        code: dto.code,
        icon: dto.icon,
        color: dto.color,
        description: dto.description,
        sortOrder: dto.sortOrder || 0,
      },
    });
  }

  async findAll() {
    return this.prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
    });
    if (!subject) {
      throw new NotFoundException('学科不存在');
    }
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto) {
    return this.prisma.subject.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    return this.prisma.subject.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getStats(id: string) {
    const [questionCount, knowledgeCount, examCount] = await Promise.all([
      this.prisma.question.count({ where: { subjectId: id } }),
      this.prisma.knowledgePoint.count({ where: { subjectId: id } }),
      this.prisma.examPaper.count({ where: { subjectId: id } }),
    ]);

    return { questionCount, knowledgeCount, examCount };
  }
}
