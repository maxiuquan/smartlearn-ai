import { Router } from 'express';
import { prisma } from '../db';
import { getExamReadiness } from '../services/recommendation-engine';

export const userRoutes = Router();

function targetExamToExamType(targetExam: string | null): string {
  if (!targetExam) return 'all';
  if (targetExam.includes('一')) return 'shu1';
  if (targetExam.includes('二')) return 'shu2';
  if (targetExam.includes('三')) return 'shu3';
  return 'all';
}

function getExamTypeFilter(examType: string): Record<string, unknown> {
  if (!examType || examType === 'all') return {};
  return { OR: [{ examType: 'all' }, { examType }] };
}

userRoutes.post('/register', async (req, res) => {
  try {
    const { username, email, password, targetExam } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existing) {
      return res.status(409).json({ error: '用户名或邮箱已存在' });
    }

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: password,
        targetExam: targetExam ?? '考研数学一',
      },
      select: {
        id: true,
        username: true,
        email: true,
        targetExam: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: '注册失败' });
  }
});

userRoutes.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      targetExam: user.targetExam,
      examType: targetExamToExamType(user.targetExam),
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: '登录失败' });
  }
});

userRoutes.get('/:id/dashboard', async (req, res) => {
  try {
    const userId = Number(req.params.id);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const examType = targetExamToExamType(user?.targetExam ?? null);
    const examTypeFilter = getExamTypeFilter(examType);

    const totalQuestions = await prisma.answerRecord.count({ where: { userId } });
    const correctCount = await prisma.answerRecord.count({ where: { userId, isCorrect: true } });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.answerRecord.count({
      where: { userId, createdAt: { gte: today } },
    });
    const todayCorrect = await prisma.answerRecord.count({
      where: { userId, isCorrect: true, createdAt: { gte: today } },
    });

    const allPoints = await prisma.knowledgePoint.count({ where: { subject: 'math', ...examTypeFilter } });
    const masteredPoints = await prisma.userProgress.count({
      where: { userId, masteryLevel: { gte: 0.8 } },
    });
    const weakPoints = await prisma.userProgress.count({
      where: { userId, masteryLevel: { gt: 0, lt: 0.5 }, totalAttempts: { gt: 0 } },
    });

    const userProgress = await prisma.userProgress.findMany({
      where: { userId },
      include: { knowledgePoint: true },
    });

    const categoryMap = new Map<string, { mastery: number; total: number }>();
    const allKps = await prisma.knowledgePoint.findMany({ where: { subject: 'math', ...examTypeFilter } });
    for (const kp of allKps) {
      if (!categoryMap.has(kp.category)) {
        categoryMap.set(kp.category, { mastery: 0, total: 0 });
      }
      const cat = categoryMap.get(kp.category)!;
      cat.total++;
      const progress = userProgress.find(p => p.knowledgePointId === kp.id);
      if (progress && progress.masteryLevel >= 0.7) {
        cat.mastery++;
      }
    }

    const categoryProgress = [...categoryMap.entries()].map(([category, data]) => {
      const catProgress = userProgress.filter(p => p.knowledgePoint.category === category);
      const averageLevel = catProgress.length > 0
        ? Math.round(catProgress.reduce((sum, p) => sum + (p.level || 0), 0) / catProgress.length)
        : 0;
      return {
        category,
        mastery: data.mastery,
        total: data.total,
        averageLevel,
      };
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);
    const weeklyRecords = await prisma.answerRecord.findMany({
      where: { userId, createdAt: { gte: weekAgo } },
      select: { createdAt: true },
    });

    const weeklyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      const count = weeklyRecords.filter(
        r => r.createdAt >= d && r.createdAt < nextDay
      ).length;
      weeklyActivity.push({ date: d.toISOString().split('T')[0], count });
    }

    let streakDays = 0;
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      checkDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(checkDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const hasActivity = await prisma.answerRecord.findFirst({
        where: { userId, createdAt: { gte: checkDate, lt: nextDay } },
      });
      if (hasActivity) {
        streakDays++;
      } else {
        break;
      }
    }

    const levelDistribution: Record<string, number> = { L0: 0, L1: 0, L2: 0, L3: 0, L4: 0 };
    for (const kp of allKps) {
      const progress = userProgress.find(p => p.knowledgePointId === kp.id);
      const level = progress?.level ?? 0;
      const levelLabel = `L${level}`;
      if (levelLabel in levelDistribution) {
        levelDistribution[levelLabel]++;
      }
    }

    let examReadiness = null;
    try {
      examReadiness = await getExamReadiness(userId);
    } catch (_) {
    }

    res.json({
      totalQuestions,
      correctCount,
      totalTimeSpent: 0,
      todayCount,
      todayCorrect,
      streakDays,
      masteredPoints,
      totalPoints: allPoints,
      weakPoints,
      weeklyActivity,
      categoryProgress,
      examType,
      levelDistribution,
      examReadiness,
    });
  } catch (error) {
    res.status(500).json({ error: '获取仪表盘数据失败' });
  }
});

userRoutes.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        id: true,
        username: true,
        email: true,
        targetExam: true,
        createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: '用户不存在' });

    const wordCount = await prisma.userWord.count({
      where: { userId: user.id },
    });

    const answerCount = await prisma.answerRecord.count({
      where: { userId: user.id },
    });

    res.json({ ...user, wordCount, answerCount });
  } catch (error) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

userRoutes.put('/profile', async (req, res) => {
  try {
    const { userId, username, email } = req.body;

    if (!userId) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username, NOT: { id: userId } },
          { email, NOT: { id: userId } },
        ],
      },
    });

    if (existing) {
      return res.status(409).json({ error: '用户名或邮箱已被使用' });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { username, email },
      select: { id: true, username: true, email: true },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: '更新失败' });
  }
});

userRoutes.get('/:id/report', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { period = '30' } = req.query;
    const days = Number(period);

    const records = await prisma.answerRecord.findMany({
      where: { userId },
      select: { createdAt: true, isCorrect: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const allKps = await prisma.knowledgePoint.findMany({
      where: { subject: 'math' },
    });

    const userProgress = await prisma.userProgress.findMany({
      where: { userId },
      include: { knowledgePoint: true },
    });

    const dayMap = new Map<string, { total: number; correct: number }>();
    const now = new Date();
    for (const r of records) {
      const date = r.createdAt.toISOString().split('T')[0];
      if (!dayMap.has(date)) dayMap.set(date, { total: 0, correct: 0 });
      const entry = dayMap.get(date)!;
      entry.total++;
      if (r.isCorrect) entry.correct++;
    }

    const dailyData: { date: string; total: number; correct: number; accuracy: number }[] = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = dayMap.get(dateStr) || { total: 0, correct: 0 };
      dailyData.push({
        date: dateStr,
        total: entry.total,
        correct: entry.correct,
        accuracy: entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0,
      });
    }
    dailyData.reverse();

    const totalAnswers = records.length;
    const correctAnswers = records.filter(r => r.isCorrect).length;
    const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

    let streakDays = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = dayMap.get(dateStr);
      if (entry && entry.total > 0) streakDays++;
      else break;
    }

    const kpMastery: { id: number; name: string; category: string; chapter: string; mastery: number }[] = [];
    const weakKps: { id: number; name: string; category: string; chapter: string; mastery: number }[] = [];
    const masteredKps: { id: number; name: string; category: string; chapter: string; mastery: number }[] = [];

    for (const kp of allKps) {
      const progress = userProgress.find(p => p.knowledgePointId === kp.id);
      const mastery = progress ? (progress.correctAttempts > 0
        ? Math.min(1, progress.correctAttempts / Math.max(progress.totalAttempts, 1))
        : 0) : 0;
      const entry = { id: kp.id, name: kp.name, category: kp.category, chapter: kp.chapter, mastery };
      kpMastery.push(entry);
      if (mastery > 0 && mastery < 0.4) weakKps.push(entry);
      if (mastery >= 0.7) masteredKps.push(entry);
    }

    const categoryMap = new Map<string, { mastery: number; total: number }>();
    for (const kp of kpMastery) {
      if (!categoryMap.has(kp.category)) categoryMap.set(kp.category, { mastery: 0, total: 0 });
      const cat = categoryMap.get(kp.category)!;
      cat.total++;
      if (kp.mastery >= 0.7) cat.mastery++;
    }
    const categoryProgress = [...categoryMap.entries()].map(([category, data]) => ({
      category,
      mastery: data.mastery,
      total: data.total,
    }));

    const totalMastered = kpMastery.filter(k => k.mastery >= 0.7).length;
    const totalPoints = allKps.length;
    const overallMastery = totalPoints > 0 ? totalMastered / totalPoints : 0;

    let advice = '';
    if (overallMastery < 0.3) {
      advice = '你刚开始备考，建议从"从零开始"模式出发，系统性地学习每个知识点。重点关注高等数学的函数与极限部分，这是所有计算的基础。';
    } else if (overallMastery < 0.6) {
      advice = '你已经有了一定的基础，但还有不少薄弱环节。建议针对红色标注的薄弱知识点进行专项训练，同时通过模拟考试检验学习效果。';
    } else if (overallMastery < 0.85) {
      advice = '整体掌握情况良好！建议在巩固薄弱点的同时，增加真题模拟训练频率，熟悉考试题型和出题风格。每天保持一定量的题目训练以维持手感。';
    } else {
      advice = '你的掌握程度已经很高了！建议以真题训练为主，重点攻克历年难题和易错题。同时关注错题分析，确保不再犯同样的错误。';
    }

    res.json({
      totalAnswers,
      correctAnswers,
      accuracy,
      streakDays,
      dailyData,
      kpMastery,
      weakKps: weakKps.sort((a, b) => a.mastery - b.mastery),
      masteredKps: masteredKps.sort((a, b) => b.mastery - a.mastery),
      categoryProgress,
      overallMastery,
      totalPoints,
      totalMastered,
      advice,
    });
  } catch (error) {
    res.status(500).json({ error: '获取学习报告失败' });
  }
});

userRoutes.post('/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.passwordHash !== currentPassword) {
      return res.status(401).json({ error: '当前密码错误' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPassword },
    });

    res.json({ message: '密码修改成功' });
  } catch (error) {
    res.status(500).json({ error: '修改密码失败' });
  }
});