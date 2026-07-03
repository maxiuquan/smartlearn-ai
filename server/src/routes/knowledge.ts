import { Router } from 'express';
import { prisma } from '../db';
import { getSmartRecommendations } from '../services/ai-analysis';

export const knowledgeRoutes = Router();

function getExamTypeFilter(examType?: string): Record<string, unknown> {
  if (!examType || examType === 'all') return {};
  return { OR: [{ examType: 'all' }, { examType }] };
}

const CATEGORY_ORDER: Record<string, number> = {
  '高等数学': 1,
  '线性代数': 2,
  '概率论与数理统计': 3,
};

function parseChapterNumber(chapter: string): number {
  const match = chapter.match(/第([一二三四五六七八九十百千]+)章/);
  if (!match) return 999;
  const chineseNum = match[1];
  const chineseMap: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  };
  return chineseMap[chineseNum] ?? 999;
}

function sortByCategoryAndChapter<T extends { category: string; chapter: string }>(points: T[]): T[] {
  return [...points].sort((a, b) => {
    const catA = CATEGORY_ORDER[a.category] ?? 99;
    const catB = CATEGORY_ORDER[b.category] ?? 99;
    if (catA !== catB) return catA - catB;
    return parseChapterNumber(a.chapter) - parseChapterNumber(b.chapter);
  });
}

knowledgeRoutes.get('/chapters', async (req, res) => {
  try {
    const { examType } = req.query;
    const examTypeFilter = getExamTypeFilter(examType as string | undefined);

    const points = await prisma.knowledgePoint.findMany({
      where: { subject: 'math', ...examTypeFilter },
      orderBy: [{ difficulty: 'asc' }],
    });

    const chapterMap = new Map<string, {
      chapter: string;
      category: string;
      knowledgePoints: { id: number; name: string; description: string; difficulty: number }[];
    }>();

    for (const p of points) {
      const key = `${p.category}||${p.chapter}`;
      if (!chapterMap.has(key)) {
        chapterMap.set(key, { chapter: p.chapter, category: p.category, knowledgePoints: [] });
      }
      chapterMap.get(key)!.knowledgePoints.push({
        id: p.id, name: p.name, description: p.description, difficulty: p.difficulty,
      });
    }

    const categoryOrder = ['高等数学', '线性代数', '概率论与数理统计'];
    const result = categoryOrder
      .filter(cat => [...chapterMap.values()].some(c => c.category === cat))
      .map(cat => ({
        category: cat,
        chapters: sortByCategoryAndChapter(
          [...chapterMap.values()].filter(c => c.category === cat)
        ).map(c => ({
          chapter: c.chapter,
          knowledgePointCount: c.knowledgePoints.length,
          knowledgePoints: c.knowledgePoints,
        })),
      }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '获取章节列表失败' });
  }
});

knowledgeRoutes.get('/from-scratch/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { examType } = req.query;
    const examTypeFilter = getExamTypeFilter(examType as string | undefined);

    const allPoints = await prisma.knowledgePoint.findMany({
      where: { subject: 'math', ...examTypeFilter },
      include: { prerequisites: true },
    });

    const progress = await prisma.userProgress.findMany({ where: { userId } });
    const progressMap = new Map(progress.map(p => [p.knowledgePointId, p.masteryLevel]));

    const prereqMap = new Map<number, number[]>();
    for (const p of allPoints) {
      prereqMap.set(p.id, p.prerequisites.map(r => r.prerequisiteId));
    }

    // 拓扑排序：按前置依赖层级排列
    const sorted: typeof allPoints = [];
    const visited = new Set<number>();
    let remaining = [...allPoints];

    while (remaining.length > 0) {
      // 找出所有前置依赖已在visited中的知识点
      const ready = remaining.filter(p => {
        const prereqs = prereqMap.get(p.id) || [];
        return prereqs.every(pid => visited.has(pid));
      });

      if (ready.length === 0) break;

      ready.sort((a, b) => {
        const catA = CATEGORY_ORDER[a.category] ?? 99;
        const catB = CATEGORY_ORDER[b.category] ?? 99;
        if (catA !== catB) return catA - catB;
        return a.difficulty - b.difficulty;
      });

      for (const p of ready) {
        sorted.push(p);
        visited.add(p.id);
      }

      remaining = remaining.filter(p => !visited.has(p.id));
    }

    // 构建路径
    const path = sorted.map((point, idx) => {
      const mastery = progressMap.get(point.id) ?? 0;
      const prereqIds = prereqMap.get(point.id) || [];
      const allPrereqsCompleted = prereqIds.every(pid => {
        const pm = progressMap.get(pid) ?? 0;
        return pm >= 0.7;
      });

      return {
        step: idx + 1,
        knowledgePointId: point.id,
        name: point.name,
        category: point.category,
        chapter: point.chapter,
        difficulty: point.difficulty,
        mastery,
        isUnlocked: prereqIds.length === 0 || allPrereqsCompleted,
        isCompleted: mastery >= 0.8,
      };
    });

    const currentIndex = path.findIndex(p => p.isUnlocked && !p.isCompleted);
    const currentStep = currentIndex >= 0 ? currentIndex + 1 : path.length + 1;

    res.json({ path, currentStep, totalSteps: path.length });
  } catch (error) {
    res.status(500).json({ error: '获取从零开始路径失败' });
  }
});

knowledgeRoutes.get('/chapters-progress/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { examType } = req.query;
    const examTypeFilter = getExamTypeFilter(examType as string | undefined);

    const allPoints = await prisma.knowledgePoint.findMany({
      where: { subject: 'math', ...examTypeFilter },
    });

    const progress = await prisma.userProgress.findMany({ where: { userId } });
    const progressMap = new Map(progress.map(p => [p.knowledgePointId, p.masteryLevel]));

    const chapterMap = new Map<string, {
      chapter: string;
      category: string;
      totalPoints: number;
      masteredPoints: number;
      averageMastery: number;
    }>();

    for (const p of allPoints) {
      const key = `${p.category}||${p.chapter}`;
      if (!chapterMap.has(key)) {
        chapterMap.set(key, { chapter: p.chapter, category: p.category, totalPoints: 0, masteredPoints: 0, averageMastery: 0 });
      }
      const c = chapterMap.get(key)!;
      c.totalPoints++;
      const m = progressMap.get(p.id) ?? 0;
      c.averageMastery += m;
      if (m >= 0.8) c.masteredPoints++;
    }

    const categories = [...new Set(allPoints.map(p => p.category))];
    const categoryOrder = ['高等数学', '线性代数', '概率论与数理统计'];
    const sortedCategories = categoryOrder.filter(cat => categories.includes(cat));
    const result = sortedCategories.map(cat => ({
      category: cat,
      chapters: sortByCategoryAndChapter(
        [...chapterMap.values()].filter(c => c.category === cat)
      ).map(c => ({
        ...c,
        averageMastery: c.totalPoints > 0 ? Math.round(c.averageMastery / c.totalPoints * 100) / 100 : 0,
      })),
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '获取章节进度失败' });
  }
});

knowledgeRoutes.get('/tree', async (req, res) => {
  try {
    const { examType } = req.query;
    const examTypeFilter = getExamTypeFilter(examType as string | undefined);

    const points = await prisma.knowledgePoint.findMany({
      where: { subject: 'math', ...examTypeFilter },
      include: {
        children: true,
        prerequisites: {
          include: { prerequisite: true },
        },
      },
      orderBy: [{ difficulty: 'asc' }],
    });

    const categoryOrder = ['高等数学', '线性代数', '概率论与数理统计'];
    const categories = categoryOrder.filter(cat => points.some(p => p.category === cat));
    const tree = categories.map(cat => ({
      category: cat,
      knowledgePoints: points
        .filter(p => p.category === cat && !p.parentId)
        .map(p => ({
          id: p.id,
          name: p.name,
          chapter: p.chapter,
          description: p.description,
          difficulty: p.difficulty,
          prerequisites: p.prerequisites.map(pr => ({
            id: pr.prerequisite.id,
            name: pr.prerequisite.name,
          })),
          children: points
            .filter(child => child.parentId === p.id)
            .map(child => ({
              id: child.id,
              name: child.name,
              description: child.description,
              difficulty: child.difficulty,
            })),
        })),
    }));

    res.json({ tree, totalCount: points.length });
  } catch (error) {
    res.status(500).json({ error: '获取知识图谱失败' });
  }
});

knowledgeRoutes.get('/point/:id', async (req, res) => {
  try {
    const point = await prisma.knowledgePoint.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        prerequisites: {
          include: { prerequisite: true },
        },
        dependentOn: {
          include: { knowledgePoint: true },
        },
        children: true,
        parent: true,
      },
    });

    if (!point) {
      return res.status(404).json({ error: '知识点不存在' });
    }

    const questionCount = await prisma.questionKnowledgePoint.count({
      where: { knowledgePointId: point.id },
    });

    res.json({
      ...point,
      questionCount,
      prerequisiteOf: point.dependentOn.map(d => ({
        id: d.knowledgePoint.id,
        name: d.knowledgePoint.name,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: '获取知识点详情失败' });
  }
});

knowledgeRoutes.get('/recommendations/:userId', async (req, res) => {
  try {
    const recommendations = await getSmartRecommendations(Number(req.params.userId));
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: '获取推荐失败' });
  }
});

knowledgeRoutes.get('/progress/:userId', async (req, res) => {
  try {
    const { examType } = req.query;
    const examTypeStr = typeof examType === 'string' ? examType : undefined;
    const examTypeFilter = getExamTypeFilter(examTypeStr);

    const progress = await prisma.userProgress.findMany({
      where: {
        userId: Number(req.params.userId),
        ...(examTypeStr && examTypeStr !== 'all' ? { knowledgePoint: { OR: [{ examType: 'all' }, { examType: examTypeStr }] } } : {}),
      },
      include: { knowledgePoint: true },
      orderBy: { masteryLevel: 'asc' },
    });

    const categorized = progress.reduce((acc, p) => {
      const cat = p.knowledgePoint.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({
        id: p.knowledgePointId,
        name: p.knowledgePoint.name,
        masteryLevel: p.masteryLevel,
        totalAttempts: p.totalAttempts,
        correctAttempts: p.correctAttempts,
        lastPracticedAt: p.lastPracticedAt,
      });
      return acc;
    }, {} as Record<string, unknown[]>);

    res.json({ progress: categorized, overallMastery: progress.length > 0
      ? Math.round(progress.reduce((sum, p) => sum + p.masteryLevel, 0) / progress.length * 100) / 100
      : 0,
    });
  } catch (error) {
    res.status(500).json({ error: '获取学习进度失败' });
  }
});

knowledgeRoutes.get('/progress', async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    const idParam = req.query.id;
    const ids: number[] = (Array.isArray(idParam) ? idParam : idParam ? [idParam] : [])
      .map((v) => Number(v))
      .filter((n) => !Number.isNaN(n));
    if (!userId || ids.length === 0) {
      return res.status(400).json({ error: '缺少参数' });
    }
    const progress = await prisma.userProgress.findMany({
      where: { userId, knowledgePointId: { in: ids.map(Number) } },
      include: { knowledgePoint: true },
    });
    res.json({ progress });
  } catch (error) {
    res.status(500).json({ error: '获取指定知识点进度失败' });
  }
});

knowledgeRoutes.get('/prerequisites/:id', async (req, res) => {
  try {
    const kpId = Number(req.params.id);
    const userId = Number(req.query.userId);
    const kp = await prisma.knowledgePoint.findUnique({
      where: { id: kpId },
      include: {
        prerequisites: { include: { prerequisite: true } },
      },
    });
    if (!kp) return res.status(404).json({ error: '知识点不存在' });

    const chain: { id: number; name: string; masteryLevel: number; depth: number }[] = [];
    const visited = new Set<number>();
    const queue: { id: number; depth: number }[] = [{ id: kpId, depth: 0 }];
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = id === kpId
        ? { id: kp.id, name: kp.name, depth }
        : await prisma.knowledgePoint.findUnique({ where: { id } });
      if (!node) continue;
      const progress = userId
        ? await prisma.userProgress.findUnique({ where: { userId_knowledgePointId: { userId, knowledgePointId: id } } })
        : null;
      chain.push({
        id: (node as { id: number }).id,
        name: (node as { name: string }).name,
        masteryLevel: progress?.masteryLevel ?? 0,
        depth,
      });
      const prereqs = id === kpId
        ? kp.prerequisites.map(p => p.prerequisiteId)
        : (await prisma.knowledgePointRelation.findMany({ where: { knowledgePointId: id } })).map(r => r.prerequisiteId);
      for (const pid of prereqs) {
        if (!visited.has(pid)) queue.push({ id: pid, depth: depth + 1 });
      }
    }

    chain.sort((a, b) => a.depth - b.depth);
    res.json({
      knowledgePoint: { id: kp.id, name: kp.name, masteryLevel: chain[0]?.masteryLevel ?? 0 },
      prerequisites: chain,
    });
  } catch (error) {
    res.status(500).json({ error: '获取前置链失败' });
  }
});

knowledgeRoutes.get('/review-queue/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const records = await prisma.answerRecord.findMany({
      where: { userId },
      include: { question: { include: { knowledgePoints: { include: { knowledgePoint: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const kpStats = new Map<number, { kpName: string; lastWrong: Date | null; total: number; wrong: number; mastery: number }>();
    for (const r of records) {
      for (const qkp of r.question.knowledgePoints) {
        const kpId = qkp.knowledgePointId;
        if (!kpStats.has(kpId)) {
          kpStats.set(kpId, { kpName: qkp.knowledgePoint.name, lastWrong: null, total: 0, wrong: 0, mastery: 0 });
        }
        const s = kpStats.get(kpId)!;
        s.total++;
        if (!r.isCorrect) {
          s.wrong++;
          if (!s.lastWrong || r.createdAt > s.lastWrong) s.lastWrong = r.createdAt;
        }
      }
    }
    const progress = await prisma.userProgress.findMany({ where: { userId } });
    const progressMap = new Map(progress.map(p => [p.knowledgePointId, p.masteryLevel]));
    for (const [kpId, s] of kpStats.entries()) {
      s.mastery = progressMap.get(kpId) ?? 0;
    }

    const now = Date.now();
    const queue: { knowledgePointId: number; name: string; urgency: number; reason: string; masteryLevel: number }[] = [];
    for (const [kpId, s] of kpStats.entries()) {
      if (s.mastery >= 0.85) continue;
      const wrongRate = s.wrong / s.total;
      if (wrongRate < 0.3 && s.mastery >= 0.7) continue;
      const daysSinceLast = s.lastWrong ? (now - s.lastWrong.getTime()) / (1000 * 60 * 60 * 24) : 0;
      const ebbinghausFactor = daysSinceLast > 7 ? 2 : daysSinceLast > 3 ? 1.5 : 1;
      const urgency = (1 - s.mastery) * ebbinghausFactor + wrongRate * 0.5;
      const reason = wrongRate >= 0.5
        ? `错误率${Math.round(wrongRate * 100)}% · 急需巩固`
        : daysSinceLast > 7
          ? `已${Math.round(daysSinceLast)}天未复习 · 遗忘风险高`
          : `掌握度${Math.round(s.mastery * 100)}% · 渐进提升`;
      queue.push({
        knowledgePointId: kpId,
        name: s.kpName,
        urgency,
        reason,
        masteryLevel: s.mastery,
      });
    }

    queue.sort((a, b) => b.urgency - a.urgency);
    res.json({ queue: queue.slice(0, 20), total: queue.length });
  } catch (error) {
    res.status(500).json({ error: '生成复习队列失败' });
  }
});