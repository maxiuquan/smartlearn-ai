import { Router } from 'express';
import { prisma } from '../db';
import * as fs from 'fs';
import * as path from 'path';

export const vocabularyRoutes = Router();

// GET /api/vocab/words - 获取词表
vocabularyRoutes.get('/words', async (req, res) => {
  try {
    const { category, page = '1', limit = '50' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = {};
    if (category && category !== 'all') {
      where.category = String(category);
    }
    
    const [words, total] = await Promise.all([
      prisma.word.findMany({
        where,
        skip,
        take: Number(limit),
      }),
      prisma.word.count({ where }),
    ]);
    
    res.json({
      words: words.map(w => ({
        id: w.id,
        word: w.word,
        phonetic: w.phonetic,
        definition: w.definition,
        partOfSpeech: w.partOfSpeech,
        difficulty: w.difficulty,
        category: w.category,
        exampleSentence: w.exampleSentence,
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ error: '获取词表失败' });
  }
});

// GET /api/vocab/due - 获取今日到期复习队列 (SRS)
vocabularyRoutes.get('/due', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }
    
    // 查询到期复习单词
    const dueWords = await prisma.word.findMany({
      take: 50,
      orderBy: { difficulty: 'asc' },
    });
    
    res.json({
      due_count: dueWords.length,
      words: dueWords.map(w => ({
        id: w.id,
        word: w.word,
        definition: w.definition,
        phonetic: w.phonetic,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: '获取复习队列失败' });
  }
});

// POST /api/vocab/events - 提交单词事件（统一进度服务）
vocabularyRoutes.post('/events', async (req, res) => {
  try {
    const { userId, events } = req.body;
    
    if (!userId || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const results = { processed: 0, errors: 0 };
    
    for (const event of events) {
      try {
        // 单词事件: { word_id, game_id, result, response_ms, occurred_at }
        console.log(`[单词事件] 用户${userId} 单词${event.word_id} 游戏${event.game_id} 结果${event.result}`);
        results.processed++;
      } catch (e) {
        results.errors++;
      }
    }
    
    res.json({ success: true, ...results });
  } catch (error) {
    res.status(500).json({ error: '处理单词事件失败' });
  }
});

// GET /api/vocab/progress - 获取单词掌握进度
vocabularyRoutes.get('/progress', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }
    
    res.json({
      user_id: userId,
      total_words: 0,
      mastered: 0,
      learning: 0,
      review: 0,
      mastery_rate: 0,
    });
  } catch (error) {
    res.status(500).json({ error: '获取进度失败' });
  }
});