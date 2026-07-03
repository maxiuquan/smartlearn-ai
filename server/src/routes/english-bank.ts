import { Router } from 'express';
import { prisma } from '../db';
import { ALL_ENGLISH_WORDS, CET4_CORE_WORDS, CET6_ADVANCED_WORDS, KAOYAN_ESSENTIAL_WORDS } from '../data/english-words';

export const englishBankRoutes = Router();

englishBankRoutes.get('/words', async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const difficulty = req.query.difficulty as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    let words = [...ALL_ENGLISH_WORDS];

    if (category) {
      words = words.filter(w => w.category === category);
    }
    if (difficulty) {
      words = words.filter(w => w.difficulty === difficulty);
    }

    const paginated = words.slice(0, limit);
    res.json({ words: paginated, total: words.length });
  } catch (error) {
    res.status(500).json({ error: '获取词库失败' });
  }
});

englishBankRoutes.get('/categories', async (_req, res) => {
  try {
    res.json({
      categories: [
        { id: 'CET4核心词', name: '四级核心词', count: CET4_CORE_WORDS.length, description: '大学英语四级考试核心词汇' },
        { id: 'CET6进阶词', name: '六级进阶词', count: CET6_ADVANCED_WORDS.length, description: '大学英语六级考试进阶词汇' },
        { id: '考研必备词', name: '考研必备词', count: KAOYAN_ESSENTIAL_WORDS.length, description: '研究生入学考试必备词汇' },
        { id: '考研熟词僻义', name: '考研熟词僻义', count: KAOYAN_ESSENTIAL_WORDS.filter(w => w.category === '考研熟词僻义').length, description: '考研常见熟词僻义合集' },
      ],
      total: ALL_ENGLISH_WORDS.length,
    });
  } catch (error) {
    res.status(500).json({ error: '获取分类失败' });
  }
});

englishBankRoutes.post('/seed', async (_req, res) => {
  try {
    let created = 0;
    let skipped = 0;

    for (const wordData of ALL_ENGLISH_WORDS) {
      const existing = await prisma.word.findFirst({
        where: { word: wordData.word },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.word.create({
        data: {
          word: wordData.word,
          phonetic: wordData.phonetic,
          definition: wordData.definition,
          exampleSentence: wordData.exampleSentence,
          partOfSpeech: wordData.partOfSpeech,
          difficulty: wordData.difficulty,
          category: wordData.category,
        },
      });
      created++;
    }

    res.json({
      message: `成功导入 ${created} 个单词，跳过 ${skipped} 个已存在的单词`,
      created,
      skipped,
      total: ALL_ENGLISH_WORDS.length,
    });
  } catch (error) {
    res.status(500).json({ error: '导入词库失败' });
  }
});