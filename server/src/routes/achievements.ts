import { Router } from 'express';
import { prisma } from '../db';

export const achievementRoutes = Router();

const PREDEFINED_ACHIEVEMENTS = [
  {
    key: 'first_answer',
    name: '初次答题',
    description: '完成第1道题',
    icon: '📝',
    category: '答题',
    condition: 'answer_count',
    threshold: 1,
  },
  {
    key: 'answer_100',
    name: '答题能手',
    description: '完成100道题',
    icon: '✍️',
    category: '答题',
    condition: 'answer_count',
    threshold: 100,
  },
  {
    key: 'answer_500',
    name: '答题达人',
    description: '完成500道题',
    icon: '🏅',
    category: '答题',
    condition: 'answer_count',
    threshold: 500,
  },
  {
    key: 'answer_1000',
    name: '答题王者',
    description: '完成1000道题',
    icon: '👑',
    category: '答题',
    condition: 'answer_count',
    threshold: 1000,
  },
  {
    key: 'first_lv3',
    name: '初窥门径',
    description: '首个知识点达到Lv.3',
    icon: '🔰',
    category: '学习',
    condition: 'first_lv3',
    threshold: 1,
  },
  {
    key: 'ten_lv3',
    name: '炉火纯青',
    description: '10个知识点达到Lv.3',
    icon: '🔥',
    category: '学习',
    condition: 'lv3_count',
    threshold: 10,
  },
  {
    key: 'first_lv4',
    name: '登峰造极',
    description: '首个知识点达到Lv.4',
    icon: '⛰️',
    category: '学习',
    condition: 'first_lv4',
    threshold: 1,
  },
  {
    key: 'streak_7',
    name: '连续签到',
    description: '连续7天签到',
    icon: '🔥',
    category: '签到',
    condition: 'streak_days',
    threshold: 7,
  },
  {
    key: 'streak_30',
    name: '学霸养成',
    description: '连续30天签到',
    icon: '🎓',
    category: '签到',
    condition: 'streak_days',
    threshold: 30,
  },
  {
    key: 'all_70',
    name: '全科精通',
    description: '所有科目平均掌握度>=70%',
    icon: '💎',
    category: '学习',
    condition: 'avg_mastery_70',
    threshold: 70,
  },
];

achievementRoutes.get('/', async (_req, res) => {
  try {
    const achievements = await prisma.achievement.findMany({
      orderBy: [{ category: 'asc' }, { threshold: 'asc' }],
    });

    if (achievements.length === 0) {
      for (const def of PREDEFINED_ACHIEVEMENTS) {
        await prisma.achievement.create({ data: def });
      }
      const created = await prisma.achievement.findMany({
        orderBy: [{ category: 'asc' }, { threshold: 'asc' }],
      });
      return res.json(created);
    }

    res.json(achievements);
  } catch (error) {
    res.status(500).json({ error: '获取成就列表失败' });
  }
});

achievementRoutes.get('/user/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    await ensureAchievements();

    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });

    const allAchievements = await prisma.achievement.findMany({
      orderBy: [{ category: 'asc' }, { threshold: 'asc' }],
    });

    const unlockedKeys = new Set(userAchievements.map(ua => ua.achievement.key));

    const achievementsWithStatus = allAchievements.map(a => ({
      id: a.id,
      key: a.key,
      name: a.name,
      description: a.description,
      icon: a.icon,
      category: a.category,
      condition: a.condition,
      threshold: a.threshold,
      unlocked: unlockedKeys.has(a.key),
      unlockedAt: userAchievements.find(ua => ua.achievementId === a.id)?.unlockedAt ?? null,
    }));

    res.json({
      achievements: achievementsWithStatus,
      unlockedCount: userAchievements.length,
      totalCount: allAchievements.length,
    });
  } catch (error) {
    res.status(500).json({ error: '获取用户成就失败' });
  }
});

achievementRoutes.post('/check', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    await ensureAchievements();

    const allAchievements = await prisma.achievement.findMany();

    const alreadyUnlocked = await prisma.userAchievement.findMany({
      where: { userId },
    });
    const unlockedKeys = new Set(alreadyUnlocked.map(ua => ua.achievementId));

    const answerCount = await prisma.answerRecord.count({ where: { userId } });

    const userProgress = await prisma.userProgress.findMany({
      where: { userId },
    });
    const lv3Count = userProgress.filter(p => p.level >= 3).length;
    const lv4Count = userProgress.filter(p => p.level >= 4).length;

    const checkIns = await prisma.checkIn.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    let streakDays = 0;
    if (checkIns.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let checkDate = new Date(today);
      for (const ci of checkIns) {
        const ciDate = new Date(ci.date);
        ciDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((checkDate.getTime() - ciDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1 && diffDays >= 0) {
          streakDays++;
          checkDate = ciDate;
        } else if (diffDays === 0) {
          streakDays++;
          checkDate = ciDate;
        } else {
          break;
        }
      }
    }

    const allKps = await prisma.knowledgePoint.findMany({ where: { subject: 'math' } });
    const progressMap = new Map(userProgress.map(p => [p.knowledgePointId, p.masteryLevel]));
    let totalMastery = 0;
    let kpWithProgress = 0;
    for (const kp of allKps) {
      const m = progressMap.get(kp.id);
      if (m !== undefined) {
        totalMastery += m;
        kpWithProgress++;
      }
    }
    const avgMastery = allKps.length > 0 ? totalMastery / allKps.length : 0;

    const newlyUnlocked: typeof allAchievements = [];

    for (const achievement of allAchievements) {
      if (unlockedKeys.has(achievement.id)) continue;

      let shouldUnlock = false;

      switch (achievement.condition) {
        case 'answer_count':
          shouldUnlock = answerCount >= achievement.threshold;
          break;
        case 'first_lv3':
          shouldUnlock = lv3Count >= achievement.threshold;
          break;
        case 'first_lv4':
          shouldUnlock = lv4Count >= achievement.threshold;
          break;
        case 'lv3_count':
          shouldUnlock = lv3Count >= achievement.threshold;
          break;
        case 'streak_days':
          shouldUnlock = streakDays >= achievement.threshold;
          break;
        case 'avg_mastery_70':
          shouldUnlock = avgMastery >= achievement.threshold / 100;
          break;
      }

      if (shouldUnlock) {
        await prisma.userAchievement.create({
          data: { userId, achievementId: achievement.id },
        });
        newlyUnlocked.push(achievement);
      }
    }

    res.json({
      newlyUnlocked: newlyUnlocked.map(a => ({
        id: a.id,
        key: a.key,
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
      })),
      totalUnlocked: alreadyUnlocked.length + newlyUnlocked.length,
      stats: {
        answerCount,
        lv3Count,
        lv4Count,
        streakDays,
        avgMastery: Math.round(avgMastery * 100),
      },
    });
  } catch (error) {
    res.status(500).json({ error: '检查成就失败' });
  }
});

async function ensureAchievements() {
  const count = await prisma.achievement.count();
  if (count === 0) {
    for (const def of PREDEFINED_ACHIEVEMENTS) {
      await prisma.achievement.create({ data: def });
    }
  }
}