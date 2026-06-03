import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateKnowledgePointDto,
  UpdateKnowledgePointDto,
  AddDependencyDto,
  QueryKnowledgePointDto,
} from './dto/knowledge-point.dto';
import {
  KnowledgePointResponseDto,
  KnowledgeTreeDto,
  KnowledgeProgressDto,
  DependencyGraphDto,
} from './dto/response.dto';

@Injectable()
export class KnowledgePointsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建知识点
   */
  async create(dto: CreateKnowledgePointDto): Promise<KnowledgePointResponseDto> {
    let level = 1;
    let path = '';

    // 如果有父节点，计算层级和路径
    if (dto.parentId) {
      const parent = await this.prisma.knowledgePoint.findUnique({
        where: { id: dto.parentId },
      });
      if (parent) {
        level = parent.level + 1;
        path = `${parent.path}/${parent.id}`;
      }
    }

    const knowledgePoint = await this.prisma.knowledgePoint.create({
      data: {
        subjectId: dto.subjectId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        content: dto.content,
        parentId: dto.parentId,
        level,
        path,
        importance: dto.importance || 1,
        frequency: dto.frequency || 0,
        sortOrder: dto.sortOrder || 0,
      },
    });

    return this.toResponse(knowledgePoint);
  }

  /**
   * 获取知识点树
   */
  async getTree(subjectId: string): Promise<KnowledgeTreeDto> {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new NotFoundException('学科不存在');
    }

    const allPoints = await this.prisma.knowledgePoint.findMany({
      where: { subjectId },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    });

    // 构建树结构
    const tree = this.buildTree(allPoints);

    return {
      subjectId,
      subjectName: subject.name,
      tree,
    };
  }

  /**
   * 获取知识点列表
   */
  async findAll(dto: QueryKnowledgePointDto): Promise<KnowledgePointResponseDto[]> {
    const where: any = {};

    if (dto.subjectId) where.subjectId = dto.subjectId;
    if (dto.parentId) where.parentId = dto.parentId;
    if (dto.keyword) {
      where.OR = [
        { name: { contains: dto.keyword, mode: 'insensitive' } },
        { description: { contains: dto.keyword, mode: 'insensitive' } },
      ];
    }

    const points = await this.prisma.knowledgePoint.findMany({
      where,
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    });

    return points.map((p) => this.toResponse(p));
  }

  /**
   * 获取单个知识点
   */
  async findOne(id: string): Promise<KnowledgePointResponseDto> {
    const point = await this.prisma.knowledgePoint.findUnique({
      where: { id },
    });

    if (!point) {
      throw new NotFoundException('知识点不存在');
    }

    return this.toResponse(point);
  }

  /**
   * 更新知识点
   */
  async update(
    id: string,
    dto: UpdateKnowledgePointDto,
  ): Promise<KnowledgePointResponseDto> {
    const point = await this.prisma.knowledgePoint.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        content: dto.content,
        importance: dto.importance,
        frequency: dto.frequency,
      },
    });

    return this.toResponse(point);
  }

  /**
   * 删除知识点
   */
  async remove(id: string): Promise<void> {
    await this.prisma.knowledgePoint.delete({
      where: { id },
    });
  }

  /**
   * 添加依赖关系
   */
  async addDependency(
    knowledgeId: string,
    dto: AddDependencyDto,
  ): Promise<void> {
    await this.prisma.knowledgeDependency.create({
      data: {
        knowledgeId,
        dependsOnId: dto.dependsOnId,
        strength: dto.strength || 1,
      },
    });
  }

  /**
   * 移除依赖关系
   */
  async removeDependency(
    knowledgeId: string,
    dependsOnId: string,
  ): Promise<void> {
    await this.prisma.knowledgeDependency.delete({
      where: {
        knowledgeId_dependsOnId: {
          knowledgeId,
          dependsOnId,
        },
      },
    });
  }

  /**
   * 获取依赖图
   */
  async getDependencyGraph(id: string): Promise<DependencyGraphDto> {
    const point = await this.prisma.knowledgePoint.findUnique({
      where: { id },
    });

    if (!point) {
      throw new NotFoundException('知识点不存在');
    }

    const [dependencies, dependents] = await Promise.all([
      this.prisma.knowledgeDependency.findMany({
        where: { knowledgeId: id },
        include: { dependsOn: true },
      }),
      this.prisma.knowledgeDependency.findMany({
        where: { dependsOnId: id },
        include: { knowledge: true },
      }),
    ]);

    return {
      id,
      name: point.name,
      dependencies: dependencies.map((d) => ({
        id: d.dependsOnId,
        name: d.dependsOn.name,
        strength: d.strength,
      })),
      dependents: dependents.map((d) => ({
        id: d.knowledgeId,
        name: d.knowledge.name,
        strength: d.strength,
      })),
    };
  }

  /**
   * 获取用户知识点进度
   */
  async getUserProgress(
    userId: string,
    subjectId: string,
  ): Promise<KnowledgeProgressDto[]> {
    const progress = await this.prisma.knowledgeProgress.findMany({
      where: {
        userId,
        knowledgePoint: { subjectId },
      },
      include: { knowledgePoint: true },
    });

    return progress.map((p) => ({
      knowledgeId: p.knowledgeId,
      name: p.knowledgePoint.name,
      masteryLevel: p.masteryLevel,
      attemptCount: p.attemptCount,
      correctCount: p.correctCount,
      correctRate:
        p.attemptCount > 0
          ? Math.round((p.correctCount / p.attemptCount) * 10000) / 100
          : 0,
      lastPracticeAt: p.lastPracticeAt,
    }));
  }

  /**
   * 构建树结构
   */
  private buildTree(points: any[]): KnowledgePointResponseDto[] {
    const map = new Map<string, any>();
    const roots: any[] = [];

    // 创建映射
    for (const point of points) {
      map.set(point.id, { ...point, children: [] });
    }

    // 构建树
    for (const point of points) {
      const node = map.get(point.id)!;
      if (point.parentId) {
        const parent = map.get(point.parentId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots.map((r) => this.toResponse(r));
  }

  /**
   * 转换为响应DTO
   */
  private toResponse(point: any): KnowledgePointResponseDto {
    return {
      id: point.id,
      subjectId: point.subjectId,
      name: point.name,
      code: point.code,
      description: point.description,
      content: point.content,
      parentId: point.parentId,
      level: point.level,
      path: point.path,
      importance: point.importance,
      frequency: point.frequency,
      children: point.children?.map((c: any) => this.toResponse(c)) || [],
    };
  }
}
