import { Router } from 'express';
import { prisma } from '../db';

export const englishGamesRoutes = Router();

englishGamesRoutes.get('/words-pool', async (req, res) => {
  try {
    const { category = '考研英语', difficulty, limit = '20' } = req.query;
    const where: Record<string, unknown> = { category: String(category) };
    if (difficulty) where.difficulty = String(difficulty);

    const words = await prisma.word.findMany({
      where,
      take: Number(limit),
      orderBy: { id: 'asc' },
      select: {
        id: true, word: true, phonetic: true, definition: true,
        partOfSpeech: true, difficulty: true, category: true,
      },
    });
    res.json({ words, examType: String(category) });
  } catch (error) {
    res.status(500).json({ error: '获取游戏词库失败' });
  }
});

englishGamesRoutes.post('/score', async (req, res) => {
  try {
    const { userId, gameType, score, accuracy, timeSpent } = req.body;
    if (!userId || !gameType || score === undefined) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const record = await prisma.gameRecord.create({
      data: {
        userId: Number(userId),
        gameType: String(gameType),
        score: Number(score),
        accuracy: accuracy ? Number(accuracy) : null,
        timeSpent: timeSpent ? Number(timeSpent) : null,
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRecords = await prisma.gameRecord.findMany({
      where: {
        userId: Number(userId),
        createdAt: { gte: today },
      },
    });

    const totalToday = todayRecords.reduce((s, r) => s + r.score, 0);
    const bestToday = todayRecords.reduce((max, r) => Math.max(max, r.score), 0);

    res.json({
      record,
      todayStats: { totalScore: totalToday, gamesPlayed: todayRecords.length, bestScore: bestToday },
    });
  } catch (error) {
    res.status(500).json({ error: '保存游戏分数失败' });
  }
});

englishGamesRoutes.get('/stats/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const allRecords = await prisma.gameRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRecords = allRecords.filter(r => new Date(r.createdAt) >= today);

    const gameTypeStats = ['word_match', 'speed_challenge', 'word_puzzle'].map(type => {
      const records = allRecords.filter(r => r.gameType === type);
      return {
        gameType: type,
        totalPlayed: records.length,
        bestScore: records.reduce((max, r) => Math.max(max, r.score), 0),
        averageAccuracy: records.length > 0
          ? Math.round(records.reduce((s, r) => s + (r.accuracy || 0), 0) / records.length)
          : 0,
        lastPlayed: records[0]?.createdAt || null,
      };
    });

    res.json({
      totalGames: allRecords.length,
      totalScore: allRecords.reduce((s, r) => s + r.score, 0),
      todayGames: todayRecords.length,
      todayScore: todayRecords.reduce((s, r) => s + r.score, 0),
      gameTypeStats,
    });
  } catch (error) {
    res.status(500).json({ error: '获取游戏统计失败' });
  }
});

englishGamesRoutes.get('/leaderboard/:gameType', async (req, res) => {
  try {
    const { gameType } = req.params;
    const records = await prisma.gameRecord.findMany({
      where: { gameType },
      orderBy: { score: 'desc' },
      take: 20,
      include: { user: { select: { id: true, username: true } } },
    });

    const leaderboard = records.map(r => ({
      userId: r.user.id,
      username: r.user.username,
      score: r.score,
      accuracy: r.accuracy,
      playedAt: r.createdAt,
    }));

    res.json({ gameType, leaderboard });
  } catch (error) {
    res.status(500).json({ error: '获取排行榜失败' });
  }
});