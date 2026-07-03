import { Router } from 'express';
import { analyzeAnswer } from '../services/ai-analysis';
import { prisma } from '../db';

export const practiceRoutes = Router();

practiceRoutes.post('/submit', async (req, res) => {
  try {
    const { userId, questionId, userAnswer, timeSpent } = req.body;

    if (!userId || !questionId || userAnswer === undefined) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await analyzeAnswer(
      Number(userId),
      Number(questionId),
      String(userAnswer),
      timeSpent ? Number(timeSpent) : undefined
    );

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '提交答案失败';
    res.status(500).json({ error: message });
  }
});

practiceRoutes.get('/history/:userId', async (req, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [records, total] = await Promise.all([
      prisma.answerRecord.findMany({
        where: { userId: Number(req.params.userId) },
        include: {
          question: {
            include: {
              knowledgePoints: {
                include: { knowledgePoint: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.answerRecord.count({
        where: { userId: Number(req.params.userId) },
      }),
    ]);

    res.json({
      records: records.map(r => ({
        id: r.id,
        questionId: r.questionId,
        questionContent: r.question.content,
        userAnswer: r.userAnswer,
        isCorrect: r.isCorrect,
        timeSpent: r.timeSpent,
        analysis: r.analysis,
        weakPointIds: r.weakPointIds ? JSON.parse(r.weakPointIds) : [],
        knowledgePoints: r.question.knowledgePoints.map(kp => ({
          id: kp.knowledgePoint.id,
          name: kp.knowledgePoint.name,
        })),
        createdAt: r.createdAt,
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ error: '获取答题记录失败' });
  }
});

practiceRoutes.get('/stats/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const [totalAnswers, correctAnswers, records] = await Promise.all([
      prisma.answerRecord.count({ where: { userId } }),
      prisma.answerRecord.count({ where: { userId, isCorrect: true } }),
      prisma.answerRecord.findMany({
        where: { userId },
        select: { createdAt: true, isCorrect: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAnswers = records.filter(r => new Date(r.createdAt) >= today).length;
    const todayCorrect = records.filter(r => new Date(r.createdAt) >= today && r.isCorrect).length;

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayRecords = records.filter(r => {
        const t = new Date(r.createdAt);
        return t >= date && t < nextDate;
      });

      return {
        date: date.toISOString().split('T')[0],
        total: dayRecords.length,
        correct: dayRecords.filter(r => r.isCorrect).length,
      };
    }).reverse();

    res.json({
      totalAnswers,
      correctAnswers,
      accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
      todayAnswers,
      todayCorrect,
      todayAccuracy: todayAnswers > 0 ? Math.round((todayCorrect / todayAnswers) * 100) : 0,
      last7Days,
    });
  } catch (error) {
    res.status(500).json({ error: '获取统计数据失败' });
  }
});