import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAchievementDto } from './dto/achievement.dto';

@Injectable()
export class AchievementsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAchievementDto) {
    return this.prisma.achievement.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        icon: dto.icon,
        badge: dto.badge,
        type: dto.type,
        category: dto.category,
        condition: dto.condition,
        points: dto.points || 0,
        title: dto.title,
        rarity: dto.rarity || 'COMMON',
        isHidden: dto.isHidden || false,
      },
    });
  }

  async findAll(includeHidden: boolean = false) {
    return this.prisma.achievement.findMany({
      where: includeHidden ? {} : { isHidden: false },
      orderBy: [{ rarity: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findByCode(code: string) {
    return this.prisma.achievement.findUnique({ where: { code } });
  }

  async getUserAchievements(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  async checkAndUnlock(userId: string, type: string, value: number) {
    const achievements = await this.prisma.achievement.findMany({
      where: { type: type as any, isHidden: false },
    });

    const unlocked: any[] = [];

    for (const achievement of achievements) {
      const condition = achievement.condition as any;
      const alreadyUnlocked = await this.prisma.userAchievement.findUnique({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
      });

      if (alreadyUnlocked) continue;

      let shouldUnlock = false;
      if (condition.type === 'count' && value >= condition.value) {
        shouldUnlock = true;
      } else if (condition.type === 'rate' && value >= condition.value) {
        shouldUnlock = true;
      } else if (condition.type === 'streak' && value >= condition.value) {
        shouldUnlock = true;
      }

      if (shouldUnlock) {
        const userAchievement = await this.prisma.userAchievement.create({
          data: { userId, achievementId: achievement.id },
          include: { achievement: true },
        });
        unlocked.push(userAchievement);
      }
    }

    return unlocked;
  }

  async getProgress(userId: string) {
    const [total, unlocked] = await Promise.all([
      this.prisma.achievement.count({ where: { isHidden: false } }),
      this.prisma.userAchievement.count({ where: { userId } }),
    ]);

    const byRarity = await this.prisma.achievement.groupBy({
      by: ['rarity'],
      _count: true,
      where: { isHidden: false },
    });

    const unlockedByRarity = await this.prisma.userAchievement.groupBy({
      by: { achievement: { rarity: true } },
      _count: true,
      where: { userId },
    });

    return {
      total,
      unlocked,
      progress: total > 0 ? Math.round((unlocked / total) * 100) : 0,
      byRarity,
      unlockedByRarity,
    };
  }
}
