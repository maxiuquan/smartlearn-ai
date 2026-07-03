import { Router } from 'express';
import { prisma } from '../db';
import { generateMathQuestions, EXTERNAL_BOOKS, getAvailableChapters } from '../services/question-generator';

export const questionRoutes = Router();

questionRoutes.get('/', async (req, res) => {
  try {
    const { category, difficulty, knowledgePointId, knowledgePointIds, chapter, examType, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};

    if (difficulty) where.difficulty = Number(difficulty);

    if (examType && examType !== 'all') {
      where.knowledgePoints = {
        some: { knowledgePoint: { OR: [{ examType: 'all' }, { examType: String(examType) }] } },
      };
    }

    if (knowledgePointIds) {
      const ids = String(knowledgePointIds).split(',').map(Number);
      where.knowledgePoints = {
        some: { knowledgePointId: { in: ids } },
      };
    } else if (knowledgePointId) {
      where.knowledgePoints = {
        some: { knowledgePointId: Number(knowledgePointId) },
      };
    }

    if (chapter) {
      const chapterFilter = { knowledgePoint: { chapter: String(chapter) } };
      if (where.knowledgePoints) {
        const existing = where.knowledgePoints as { some: Record<string, unknown> };
        where.knowledgePoints = {
          some: {
            ...existing.some,
            ...chapterFilter,
          },
        };
      } else {
        where.knowledgePoints = { some: chapterFilter };
      }
    }

    if (category) {
      const catFilter = { knowledgePoint: { category: String(category) } };
      if (where.knowledgePoints) {
        const existing = where.knowledgePoints as { some: Record<string, unknown> };
        where.knowledgePoints = {
          some: {
            ...existing.some,
            ...catFilter,
          },
        };
      } else {
        where.knowledgePoints = { some: catFilter };
      }
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          knowledgePoints: {
            include: { knowledgePoint: true },
          },
        },
        skip,
        take: Number(limit),
        orderBy: { difficulty: 'asc' },
      }),
      prisma.question.count({ where }),
    ]);

    res.json({
      questions: questions.map(q => ({
        id: q.id,
        content: q.content,
        questionType: q.questionType,
        options: q.options ? JSON.parse(q.options) : null,
        difficulty: q.difficulty,
        source: q.source,
        knowledgePoints: q.knowledgePoints.map(kp => ({
          id: kp.knowledgePoint.id,
          name: kp.knowledgePoint.name,
        })),
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ error: '获取题目失败' });
  }
});

questionRoutes.get('/exam/mock', async (req, res) => {
  try {
    const { questionCount = '22' } = req.query;
    const count = Number(questionCount);

    const allQuestions = await prisma.question.findMany({
      include: {
        knowledgePoints: {
          include: { knowledgePoint: true },
        },
      },
    });

    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);

    const fillInBlanks = shuffled.filter(q => q.questionType === 'fill_in').slice(0, Math.ceil(count * 0.4));
    const choices = shuffled.filter(q => q.questionType === 'choice').slice(0, Math.ceil(count * 0.3));
    const essays = shuffled.filter(q => q.questionType === 'essay').slice(0, Math.ceil(count * 0.15));
    const remaining = shuffled.filter(q =>
      !fillInBlanks.includes(q) && !choices.includes(q) && !essays.includes(q)
    ).slice(0, count - fillInBlanks.length - choices.length - essays.length);

    const examQuestions = [...fillInBlanks, ...choices, ...essays, ...remaining]
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    res.json({
      questions: examQuestions.map((q, i) => ({
        index: i + 1,
        id: q.id,
        content: q.content,
        answer: q.answer,
        solution: q.solution || '',
        questionType: q.questionType,
        options: q.options ? JSON.parse(q.options) : null,
        difficulty: q.difficulty,
        source: q.source,
        knowledgePoints: q.knowledgePoints.map(kp => ({
          id: kp.knowledgePoint.id,
          name: kp.knowledgePoint.name,
          category: kp.knowledgePoint.category,
        })),
      })),
      totalCount: examQuestions.length,
      timeLimit: 180,
    });
  } catch (error) {
    res.status(500).json({ error: '生成模拟卷失败' });
  }
});

questionRoutes.get('/exam/real', async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      where: {
        source: { not: null },
      },
      include: {
        knowledgePoints: {
          include: { knowledgePoint: true },
        },
      },
      orderBy: { source: 'asc' },
    });

    const sourceGroups = new Map<string, typeof questions>();
    for (const q of questions) {
      const src = q.source || '其他';
      if (!sourceGroups.has(src)) sourceGroups.set(src, []);
      sourceGroups.get(src)!.push(q);
    }

    res.json({
      sources: [...sourceGroups.entries()].map(([source, qs]) => ({
        source,
        count: qs.length,
        questions: qs.map(q => ({
          id: q.id,
          content: q.content,
          answer: q.answer,
          solution: q.solution || '',
          questionType: q.questionType,
          options: q.options ? JSON.parse(q.options) : null,
          difficulty: q.difficulty,
          source: q.source,
          knowledgePoints: q.knowledgePoints.map(kp => ({
            id: kp.knowledgePoint.id,
            name: kp.knowledgePoint.name,
          })),
        })),
      })),
      totalCount: questions.length,
    });
  } catch (error) {
    res.status(500).json({ error: '获取真题失败' });
  }
});

questionRoutes.get('/generate', async (req, res) => {
  try {
    const { category, count = '5', difficulty } = req.query;
    const questions = generateMathQuestions(
      String(category || ''),
      Number(count),
      difficulty ? Number(difficulty) : undefined
    );

    const source = req.query.source ? String(req.query.source) : '智能生成';
    const kpList = await prisma.knowledgePoint.findMany({
      where: category ? { category: String(category) } : { subject: 'math' },
      take: 20,
    });

    const created = [];
    for (const q of questions) {
      const kp = kpList[Math.floor(Math.random() * kpList.length)];
      const question = await prisma.question.create({
        data: {
          content: q.content,
          questionType: q.questionType,
          options: q.options ? JSON.stringify(q.options) : null,
          answer: q.answer,
          solution: q.solution,
          difficulty: q.difficulty,
          source,
          knowledgePoints: {
            create: [{ knowledgePointId: kp.id }],
          },
        },
        include: {
          knowledgePoints: {
            include: { knowledgePoint: true },
          },
        },
      });
      created.push({
        id: question.id,
        content: question.content,
        answer: question.answer,
        solution: question.solution || '',
        questionType: question.questionType,
        options: question.options ? JSON.parse(question.options) : null,
        difficulty: question.difficulty,
        source: question.source,
        knowledgePoints: question.knowledgePoints.map(k => ({
          id: k.knowledgePoint.id,
          name: k.knowledgePoint.name,
        })),
      });
    }

    res.json({ questions: created, count: created.length });
  } catch (error) {
    res.status(500).json({ error: '生成题目失败' });
  }
});

questionRoutes.get('/diagnostic', async (req, res) => {
  try {
    const { category } = req.query;
    const targetCount = 20;

    const where: Record<string, unknown> = {};
    if (category) {
      where.knowledgePoints = {
        some: { knowledgePoint: { category: String(category) } },
      };
    }

    const categories = category
      ? [String(category)]
      : ['高等数学', '线性代数', '概率论与数理统计'];

    const allQuestions: unknown[] = [];
    const perCategory = Math.ceil(targetCount / categories.length);

    for (const cat of categories) {
      const catQuestions = await prisma.question.findMany({
        where: {
          knowledgePoints: {
            some: { knowledgePoint: { category: cat } },
          },
        },
        include: {
          knowledgePoints: {
            include: { knowledgePoint: true },
          },
        },
        take: perCategory + 5,
      });

      const shuffled = [...catQuestions].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, perCategory);
      allQuestions.push(...picked);
    }

    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, targetCount);

    res.json({
      questions: selected.map(q => {
        const question = q as {
          id: number; content: string; questionType: string;
          options: string | null; difficulty: number; source: string | null;
          answer: string;
          knowledgePoints: { knowledgePoint: { id: number; name: string; category: string } }[];
        };
        return {
          id: question.id,
          content: question.content,
          questionType: question.questionType,
          options: question.options ? JSON.parse(question.options) : null,
          difficulty: question.difficulty,
          knowledgePoints: question.knowledgePoints.map(kp => ({
            id: kp.knowledgePoint.id,
            name: kp.knowledgePoint.name,
            category: kp.knowledgePoint.category,
          })),
        };
      }),
      totalCount: selected.length,
    });
  } catch (error) {
    res.status(500).json({ error: '获取诊断题目失败' });
  }
});

questionRoutes.post('/diagnostic', async (req, res) => {
  try {
    const { userId, answers } = req.body as {
      userId: number;
      answers: { questionId: number; answer: string }[];
    };

    if (!userId || !answers) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const questionIds = answers.map(a => a.questionId);
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      include: {
        knowledgePoints: {
          include: { knowledgePoint: true },
        },
      },
    });

    const questionMap = new Map(questions.map(q => [q.id, q]));
    let correctCount = 0;
    const kpResults = new Map<number, { kp: { id: number; name: string; category: string }; correct: boolean }>();

    for (const ans of answers) {
      const q = questionMap.get(ans.questionId);
      if (!q) continue;
      const isCorrect = ans.answer.trim().toLowerCase() === q.answer.trim().toLowerCase();
      if (isCorrect) correctCount++;

      for (const kp of q.knowledgePoints) {
        const existing = kpResults.get(kp.knowledgePoint.id);
        if (!existing) {
          kpResults.set(kp.knowledgePoint.id, {
            kp: { id: kp.knowledgePoint.id, name: kp.knowledgePoint.name, category: kp.knowledgePoint.category },
            correct: isCorrect,
          });
        } else if (!isCorrect) {
          existing.correct = false;
        }
      }

      await prisma.answerRecord.create({
        data: {
          userId,
          questionId: ans.questionId,
          userAnswer: ans.answer,
          isCorrect,
          timeSpent: null,
          analysis: isCorrect ? '诊断答题正确' : '诊断答题错误',
          weakPointIds: JSON.stringify(q.knowledgePoints.map(k => k.knowledgePointId)),
        },
      });
    }

    const allKps = await prisma.knowledgePoint.findMany({
      where: { subject: 'math' },
    });

    const userProgress = await prisma.userProgress.findMany({
      where: { userId },
    });
    const progressMap = new Map(userProgress.map(p => [p.knowledgePointId, p.masteryLevel]));

    const categoryMap = new Map<string, {
      category: string;
      mastery: number;
      knowledgePoints: { id: number; name: string; category: string; mastery: number }[];
    }>();

    for (const cat of ['高等数学', '线性代数', '概率论与数理统计']) {
      categoryMap.set(cat, { category: cat, mastery: 0, knowledgePoints: [] });
    }

    const weakPoints: { id: number; name: string; category: string; mastery: number }[] = [];

    for (const kp of allKps) {
      const cat = categoryMap.get(kp.category);
      if (!cat) continue;
      const diagResult = kpResults.get(kp.id);
      const progress = progressMap.get(kp.id) ?? 0;
      const diagMastery = diagResult ? (diagResult.correct ? 0.8 : 0.3) : progress;
      const combinedMastery = progress > 0 ? Math.round((progress * 0.6 + diagMastery * 0.4) * 100) / 100 : diagMastery;

      cat.knowledgePoints.push({
        id: kp.id,
        name: kp.name,
        category: kp.category,
        mastery: combinedMastery,
      });

      if (combinedMastery < 0.5 && combinedMastery > 0) {
        weakPoints.push({ id: kp.id, name: kp.name, category: kp.category, mastery: combinedMastery });
      }
    }

    for (const [cat, data] of categoryMap) {
      const total = data.knowledgePoints.length;
      const mastered = data.knowledgePoints.filter(k => k.mastery >= 0.7).length;
      data.mastery = total > 0 ? Math.round((mastered / total) * 100) / 100 : 0;
    }

    const accuracy = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;

    res.json({
      totalScore: accuracy,
      correctCount,
      totalCount: answers.length,
      accuracy: accuracy / 100,
      categoryBreakdown: [...categoryMap.values()],
      weakPoints: weakPoints.sort((a, b) => a.mastery - b.mastery).slice(0, 8),
      recommendedPath: weakPoints
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 5)
        .map(wp => ({
          knowledgePoint: { id: wp.id, name: wp.name, category: wp.category },
          reason: `掌握度仅${Math.round(wp.mastery * 100)}%，建议优先巩固`,
          category: wp.category,
        })),
    });
  } catch (error) {
    res.status(500).json({ error: '提交诊断答案失败' });
  }
});

questionRoutes.get('/daily', async (_req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const seed = [...today].reduce((acc, c) => acc + c.charCodeAt(0), 0);

    const questions = await prisma.question.findMany({
      include: {
        knowledgePoints: {
          include: { knowledgePoint: true },
        },
      },
      skip: seed % Math.max(await prisma.question.count() - 1, 0),
      take: 1,
    });

    if (questions.length === 0) {
      const generated = generateMathQuestions('all', 1);
      return res.json({
        question: {
          id: 0,
          content: generated[0].content,
          questionType: generated[0].questionType,
          difficulty: generated[0].difficulty,
          answer: generated[0].answer,
          solution: generated[0].solution,
          date: today,
          knowledgePoints: [],
        },
      });
    }

    const q = questions[0];
    res.json({
      question: {
        id: q.id,
        content: q.content,
        questionType: q.questionType,
        options: q.options ? JSON.parse(q.options) : null,
        difficulty: q.difficulty,
        answer: q.answer,
        date: today,
        knowledgePoints: q.knowledgePoints.map(kp => ({
          id: kp.knowledgePoint.id,
          name: kp.knowledgePoint.name,
          category: kp.knowledgePoint.category,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: '获取每日一题失败' });
  }
});

questionRoutes.get('/external', (req, res) => {
  try {
    const { source, category, chapter } = req.query;
    const count = 20;

    let cat = 'all';
    if (category && typeof category === 'string') {
      cat = category;
    }

    if (source && typeof source === 'string') {
      if (source.includes('概率') || source.includes('统计')) {
        cat = '概率论与数理统计';
      } else if (source.includes('线性') || source.includes('代数') || source.includes('线代')) {
        cat = '线性代数';
      } else if (source.includes('高数') || source.includes('数学')) {
        cat = '高等数学';
      }
    }

    const chapterFilter = chapter && typeof chapter === 'string' ? chapter : undefined;
    const questions = generateMathQuestions(cat, count, undefined, chapterFilter);

    const availableChapters = getAvailableChapters(cat);

    res.json({
      questions: questions.map((q, i) => ({
        id: 10000 + i,
        content: q.content,
        answer: q.answer,
        solution: q.solution,
        questionType: q.questionType,
        difficulty: q.difficulty,
        knowledgePoints: q.knowledgePoints || [],
        chapter: q.chapter || '',
      })),
      source: source || '智能生成',
      chapters: availableChapters,
    });
  } catch (error) {
    res.status(500).json({ error: '获取外部题库失败' });
  }
});

questionRoutes.get('/books', (_req, res) => {
  res.json({ books: EXTERNAL_BOOKS });
});

questionRoutes.get('/:id', async (req, res) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        knowledgePoints: {
          include: { knowledgePoint: true },
        },
      },
    });

    if (!question) {
      return res.status(404).json({ error: '题目不存在' });
    }

    res.json({
      ...question,
      options: question.options ? JSON.parse(question.options) : null,
      knowledgePoints: question.knowledgePoints.map(kp => ({
        id: kp.knowledgePoint.id,
        name: kp.knowledgePoint.name,
        category: kp.knowledgePoint.category,
      })),
      answer: undefined,
      solution: undefined,
    });
  } catch (error) {
    res.status(500).json({ error: '获取题目详情失败' });
  }
});

questionRoutes.get('/:id/solution', async (req, res) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, answer: true, solution: true },
    });

    if (!question) {
      return res.status(404).json({ error: '题目不存在' });
    }

    res.json(question);
  } catch (error) {
    res.status(500).json({ error: '获取答案失败' });
  }
});