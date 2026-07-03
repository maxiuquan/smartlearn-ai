import { Router } from 'express';
import { prisma } from '../db';
import { generateArticleFromWords, generateWordQuestions } from '../services/ai-analysis';

export const englishRoutes = Router();

englishRoutes.get('/words', async (req, res) => {
  try {
    const { category, difficulty, page = '1', limit = '50' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (category) where.category = String(category);
    if (difficulty) {
      const diff = String(difficulty);
      const DIFFICULTY_MAP: Record<string, string> = {
        '0': '', '1': 'easy', '2': 'medium', '3': 'hard',
        'easy': 'easy', 'medium': 'medium', 'hard': 'hard',
      };
      const mapped = DIFFICULTY_MAP[diff];
      if (mapped) where.difficulty = mapped;
    }

    const [words, total] = await Promise.all([
      prisma.word.findMany({ where, skip, take: Number(limit), orderBy: { id: 'asc' } }),
      prisma.word.count({ where }),
    ]);

    res.json({ words, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    res.status(500).json({ error: '获取单词列表失败' });
  }
});

englishRoutes.get('/words/:id', async (req, res) => {
  try {
    const word = await prisma.word.findUnique({ where: { id: Number(req.params.id) } });
    if (!word) return res.status(404).json({ error: '单词不存在' });
    res.json(word);
  } catch (error) {
    res.status(500).json({ error: '获取单词详情失败' });
  }
});

englishRoutes.get('/user-words/:userId', async (req, res) => {
  try {
    const userWords = await prisma.userWord.findMany({
      where: { userId: Number(req.params.userId) },
      include: { word: true },
      orderBy: [
        { memoryLevel: 'asc' },
        { nextReview: 'asc' },
      ],
    });

    const today = new Date();

    const toReview = userWords.filter(uw => {
      if (!uw.nextReview) return true;
      return new Date(uw.nextReview) <= today;
    });

    const mastered = userWords.filter(uw => uw.memoryLevel >= 5);

    res.json({
      total: userWords.length,
      toReview: toReview.length,
      mastered: mastered.length,
      words: userWords.map(uw => ({
        id: uw.word.id,
        word: uw.word.word,
        phonetic: uw.word.phonetic,
        definition: uw.word.definition,
        exampleSentence: uw.word.exampleSentence,
        partOfSpeech: uw.word.partOfSpeech,
        difficulty: uw.word.difficulty,
        memoryLevel: uw.memoryLevel,
        reviewCount: uw.reviewCount,
        lastReviewed: uw.lastReviewed,
        nextReview: uw.nextReview,
        needReview: !uw.nextReview || new Date(uw.nextReview) <= today,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: '获取用户单词失败' });
  }
});

englishRoutes.post('/review-word', async (req, res) => {
  try {
    const { userId, wordId, remembered } = req.body;

    if (!userId || !wordId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const uid = Number(userId);
    const wid = Number(wordId);

    const existing = await prisma.userWord.findUnique({
      where: { userId_wordId: { userId: uid, wordId: wid } },
    });

    const intervals = [1, 2, 4, 7, 15, 30, 60, 120];

    if (existing) {
      const newLevel = remembered
        ? Math.min(existing.memoryLevel + 1, 7)
        : Math.max(existing.memoryLevel - 1, 0);

      const intervalDays = intervals[newLevel] ?? 120;
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + intervalDays);

      const updated = await prisma.userWord.update({
        where: { id: existing.id },
        data: {
          memoryLevel: newLevel,
          reviewCount: existing.reviewCount + 1,
          lastReviewed: new Date(),
          nextReview,
        },
      });

      res.json({
        memoryLevel: updated.memoryLevel,
        nextReview: updated.nextReview,
        message: remembered ? '已记住！下次复习时间已更新' : '需要继续复习',
      });
    } else {
      const intervalDays = remembered ? intervals[1] : intervals[0];
      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + intervalDays);

      await prisma.userWord.create({
        data: {
          userId: uid,
          wordId: wid,
          memoryLevel: remembered ? 1 : 0,
          reviewCount: 1,
          lastReviewed: new Date(),
          nextReview,
        },
      });

      res.json({
        memoryLevel: remembered ? 1 : 0,
        nextReview,
        message: remembered ? '首次记忆成功！' : '已记录，需要继续复习',
      });
    }
  } catch (error) {
    res.status(500).json({ error: '复习记录失败' });
  }
});

englishRoutes.post('/generate-article', async (req, res) => {
  try {
    const { userId, wordIds } = req.body;

    let words: { word: string; definition: string; exampleSentence?: string | null }[];

    if (wordIds && Array.isArray(wordIds)) {
      const dbWords = await prisma.word.findMany({
        where: { id: { in: wordIds.map(Number) } },
        select: { word: true, definition: true, exampleSentence: true },
      });
      words = dbWords;
    } else if (userId) {
      const today = new Date();
      const userWords = await prisma.userWord.findMany({
        where: {
          userId: Number(userId),
          nextReview: { lte: today },
        },
        include: { word: true },
        take: 10,
      });

      if (userWords.length === 0) {
        const learnedWords = await prisma.userWord.findMany({
          where: { userId: Number(userId) },
          include: { word: true },
          orderBy: { lastReviewed: 'desc' },
          take: 10,
        });
        words = learnedWords.map(uw => ({
          word: uw.word.word,
          definition: uw.word.definition,
          exampleSentence: uw.word.exampleSentence,
        }));
      } else {
        words = userWords.map(uw => ({
          word: uw.word.word,
          definition: uw.word.definition,
          exampleSentence: uw.word.exampleSentence,
        }));
      }
    } else {
      return res.status(400).json({ error: '需要提供 userId 或 wordIds' });
    }

    const article = generateArticleFromWords(words);
    const questionData = generateWordQuestions(words);

    const created = await prisma.generatedArticle.create({
      data: {
        title: article.title,
        content: article.content,
        wordCount: words.length,
        difficulty: 'medium',
        articleWords: {
          create: await Promise.all(
            words.map(async (w) => {
              const dbWord = await prisma.word.findUnique({ where: { word: w.word } });
              return { wordId: dbWord?.id ?? 0 };
            })
          ),
        },
        articleQuestions: {
          create: questionData.map(q => ({
            question: q.question,
            questionType: 'choice',
            options: JSON.stringify(q.options),
            answer: q.answer,
            explanation: '',
          })),
        },
      },
      include: {
        articleQuestions: true,
        articleWords: { include: { word: true } },
      },
    });

    res.json({
      id: created.id,
      title: created.title,
      content: created.content,
      words: created.articleWords.map(aw => ({
        word: aw.word.word,
        definition: aw.word.definition,
      })),
      questions: created.articleQuestions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options ? JSON.parse(q.options) : [],
        answer: q.answer,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: '生成文章失败' });
  }
});

englishRoutes.get('/articles', async (req, res) => {
  try {
    const { page = '1', limit = '10' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [articles, total] = await Promise.all([
      prisma.generatedArticle.findMany({
        include: {
          articleWords: { include: { word: true } },
          articleQuestions: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.generatedArticle.count(),
    ]);

    res.json({
      articles: articles.map(a => ({
        id: a.id,
        title: a.title,
        content: a.content,
        wordCount: a.wordCount,
        words: a.articleWords.map(aw => ({ word: aw.word.word, definition: aw.word.definition })),
        questionCount: a.articleQuestions.length,
        createdAt: a.createdAt,
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ error: '获取文章列表失败' });
  }
});

englishRoutes.get('/articles/:id', async (req, res) => {
  try {
    const article = await prisma.generatedArticle.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        articleWords: { include: { word: true } },
        articleQuestions: true,
      },
    });

    if (!article) return res.status(404).json({ error: '文章不存在' });

    res.json({
      id: article.id,
      title: article.title,
      content: article.content,
      words: article.articleWords.map(aw => ({
        word: aw.word.word,
        definition: aw.word.definition,
        phonetic: aw.word.phonetic,
      })),
      questions: article.articleQuestions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options ? JSON.parse(q.options) : [],
        answer: q.answer,
        explanation: q.explanation,
      })),
      createdAt: article.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: '获取文章详情失败' });
  }
});