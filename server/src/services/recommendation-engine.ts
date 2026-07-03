import { prisma } from '../db';

const LEVEL_THRESHOLDS = [0, 0.3, 0.5, 0.7, 0.85];
const LEVEL_NAMES = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
const DECAY_HALF_LIFE_DAYS = 7;
const DIFFICULTY_WEIGHT = 0.3;
const DECAY_WEIGHT = 0.35;
const THETA_WEIGHT = 0.35;

function computeLevel(masteryLevel: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (masteryLevel >= LEVEL_THRESHOLDS[i]) return i;
  }
  return 0;
}

function computeLevelLabel(level: number): string {
  return LEVEL_NAMES[level] ?? 'L0';
}

function computeForgettingDecay(
  masteryLevel: number,
  lastPracticedAt: Date | null,
  nextReviewAt: Date | null
): number {
  if (!lastPracticedAt) return 1.0;
  const now = Date.now();
  const lastTime = new Date(lastPracticedAt).getTime();
  const elapsedDays = (now - lastTime) / (1000 * 60 * 60 * 24);
  if (elapsedDays <= 0) return 0;
  const halfLife = DECAY_HALF_LIFE_DAYS * (1 + masteryLevel * 3);
  const rawDecay = Math.pow(0.5, elapsedDays / halfLife);
  if (nextReviewAt && new Date(nextReviewAt).getTime() > now) {
    return rawDecay * 0.3;
  }
  return rawDecay;
}

function thetaToRecommendedDifficulty(theta: number): number {
  const difficulty = Math.round(1 + (theta + 3) * (4 / 6));
  return Math.max(1, Math.min(5, difficulty));
}

export async function getSmartNextQuestion(userId: number, examType?: string) {
  const whereExam: Record<string, unknown> = examType && examType !== 'all'
    ? { OR: [{ examType: 'all' }, { examType }] }
    : {};

  const allKps = await prisma.knowledgePoint.findMany({
    where: { subject: 'math', ...whereExam },
    include: { prerequisites: true },
  });

  const allProgress = await prisma.userProgress.findMany({
    where: { userId },
  });
  const progressMap = new Map(allProgress.map(p => [p.knowledgePointId, p]));

  const prereqMap = new Map<number, number[]>();
  for (const kp of allKps) {
    prereqMap.set(kp.id, kp.prerequisites.map(r => r.prerequisiteId));
  }

  const scored = allKps.map(kp => {
    const progress = progressMap.get(kp.id);
    const masteryLevel = progress?.masteryLevel ?? 0;
    const theta = progress?.theta ?? -1.2;
    const decay = computeForgettingDecay(
      masteryLevel,
      progress?.lastPracticedAt ?? null,
      progress?.nextReviewAt ?? null
    );

    const prereqIds = prereqMap.get(kp.id) || [];
    const allPrereqsMet = prereqIds.length === 0 || prereqIds.every(pid => {
      const pm = progressMap.get(pid);
      return pm && pm.masteryLevel >= 0.6;
    });
    const prereqBonus = allPrereqsMet ? 0 : -0.5;

    const targetDifficulty = thetaToRecommendedDifficulty(theta);
    const difficultyMatch = 1 - Math.abs(kp.difficulty - targetDifficulty) / 4;

    const needReview = decay > 0.4;
    const reviewUrgency = needReview ? decay : 0;

    const score =
      DIFFICULTY_WEIGHT * difficultyMatch +
      DECAY_WEIGHT * reviewUrgency +
      THETA_WEIGHT * (masteryLevel < 0.85 ? (1 - masteryLevel) : 0.1) +
      prereqBonus;

    return {
      knowledgePointId: kp.id,
      name: kp.name,
      category: kp.category,
      chapter: kp.chapter,
      difficulty: kp.difficulty,
      masteryLevel,
      level: progress?.level ?? 0,
      theta,
      decay,
      targetDifficulty,
      score,
      allPrereqsMet,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);

  const kpIds = top.map(s => s.knowledgePointId);

  const questions = await prisma.question.findMany({
    where: {
      knowledgePoints: {
        some: { knowledgePointId: { in: kpIds } },
      },
    },
    include: {
      knowledgePoints: {
        include: { knowledgePoint: true },
      },
    },
  });

  const questionMap = new Map<number, typeof questions>();
  for (const q of questions) {
    for (const qkp of q.knowledgePoints) {
      const kpId = qkp.knowledgePointId;
      if (!questionMap.has(kpId)) questionMap.set(kpId, []);
      questionMap.get(kpId)!.push(q);
    }
  }

  const recommendations = top.map(item => {
    const qs = questionMap.get(item.knowledgePointId) || [];
    const bestQuestion = qs.length > 0
      ? qs.sort((a, b) => Math.abs(a.difficulty - item.targetDifficulty) - Math.abs(b.difficulty - item.targetDifficulty))[0]
      : null;

    return {
      knowledgePoint: {
        id: item.knowledgePointId,
        name: item.name,
        category: item.category,
        chapter: item.chapter,
        difficulty: item.difficulty,
      },
      currentLevel: computeLevelLabel(item.level),
      masteryLevel: Math.round(item.masteryLevel * 100),
      theta: Math.round(item.theta * 100) / 100,
      decayScore: Math.round(item.decay * 100) / 100,
      recommendedDifficulty: item.targetDifficulty,
      priorityScore: Math.round(item.score * 100) / 100,
      prerequisitesMet: item.allPrereqsMet,
      question: bestQuestion ? {
        id: bestQuestion.id,
        content: bestQuestion.content,
        questionType: bestQuestion.questionType,
        options: bestQuestion.options ? JSON.parse(bestQuestion.options) : null,
        difficulty: bestQuestion.difficulty,
      } : null,
    };
  });

  return {
    recommendations,
    algorithm: {
      irtThetaEnabled: true,
      forgettingCurveEnabled: true,
      prerequisiteCheckEnabled: true,
      decayHalfLifeDays: DECAY_HALF_LIFE_DAYS,
    },
  };
}

export async function getExamReadiness(userId: number) {
  const allKps = await prisma.knowledgePoint.findMany({
    where: { subject: 'math' },
  });

  const allProgress = await prisma.userProgress.findMany({
    where: { userId },
    include: { knowledgePoint: true },
  });
  const progressMap = new Map(allProgress.map(p => [p.knowledgePointId, p]));

  const categoryLevels = new Map<string, Map<string, number>>();
  const categoryMap = new Map<string, { total: number; sumMastery: number; mastered: number }>();

  for (const kp of allKps) {
    const progress = progressMap.get(kp.id);
    const masteryLevel = progress?.masteryLevel ?? 0;
    const level = progress?.level ?? 0;

    if (!categoryLevels.has(kp.category)) {
      categoryLevels.set(kp.category, new Map(LEVEL_NAMES.map(l => [l, 0])));
    }
    if (!categoryMap.has(kp.category)) {
      categoryMap.set(kp.category, { total: 0, sumMastery: 0, mastered: 0 });
    }

    const levelLabel = computeLevelLabel(level);
    const levelCounts = categoryLevels.get(kp.category)!;
    levelCounts.set(levelLabel, (levelCounts.get(levelLabel) ?? 0) + 1);

    const cat = categoryMap.get(kp.category)!;
    cat.total++;
    cat.sumMastery += masteryLevel;
    if (masteryLevel >= 0.7) cat.mastered++;
  }

  const categoryDistribution = [...categoryLevels.entries()].map(([category, levelMap]) => ({
    category,
    levelDistribution: Object.fromEntries(levelMap),
  }));

  const overallMastery = allKps.length > 0
    ? allProgress.reduce((sum, p) => sum + p.masteryLevel, 0) / allKps.length
    : 0;

  const predictedScore = Math.round(overallMastery * 150);

  const categoryAbility = [...categoryMap.entries()].map(([category, data]) => {
    const avg = data.total > 0 ? data.sumMastery / data.total : 0;
    return {
      category,
      masteryPercent: Math.round(avg * 100),
      abilityBar: Math.min(100, Math.round(avg * 100)),
      predictedScore: Math.round(avg * 50),
    };
  });

  const totalAbility = categoryAbility.length > 0
    ? Math.round(categoryAbility.reduce((s, c) => s + c.abilityBar, 0) / categoryAbility.length)
    : 0;

  return {
    overallMastery: Math.round(overallMastery * 100),
    predictedScore,
    totalAbilityBar: totalAbility,
    categoryLevelDistribution: categoryDistribution,
    categoryAbility,
    levelThresholds: LEVEL_NAMES.map((name, i) => ({
      level: name,
      threshold: LEVEL_THRESHOLDS[i],
      range: i < LEVEL_THRESHOLDS.length - 1
        ? `${Math.round(LEVEL_THRESHOLDS[i] * 100)}%-${Math.round(LEVEL_THRESHOLDS[i + 1] * 100)}%`
        : `${Math.round(LEVEL_THRESHOLDS[i] * 100)}%+`,
    })),
  };
}