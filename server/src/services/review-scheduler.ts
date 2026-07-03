import { prisma } from '../db';
import { calculateDecay, isDueForReview, getDueReviewPoints, getYellowDotCount, getLevelFromTheta, getLevelLabel, INITIAL_THETA, type MasteryState } from './mastery-engine';

export interface ReviewTask {
  knowledgePointId: number;
  name: string;
  category: string;
  chapter: string;
  theta: number;
  level: number;
  levelLabel: string;
  nextReviewAt: Date | null;
  isOverdue: boolean;
  suggestedQuestionId: number | null;
}

export async function generateReviewQueue(userId: number): Promise<number> {
  const allProgress = await prisma.userProgress.findMany({
    where: { userId, totalAttempts: { gt: 0 } },
  });

  const masteryStates: (MasteryState & { id: number; knowledgePointId: number })[] = allProgress.map(p => ({
    id: p.id,
    knowledgePointId: p.knowledgePointId,
    theta: p.theta,
    level: p.level,
    masteryLevel: p.masteryLevel,
    totalAttempts: p.totalAttempts,
    correctAttempts: p.correctAttempts,
    reviewInterval: p.reviewInterval,
    reviewCount: p.reviewCount,
    lastPracticedAt: p.lastPracticedAt,
    nextReviewAt: p.nextReviewAt,
  }));

  const decayed = masteryStates.map(s => calculateDecay(s));

  for (let i = 0; i < decayed.length; i++) {
    if (decayed[i].theta !== masteryStates[i].theta) {
      await prisma.userProgress.update({
        where: { id: masteryStates[i].id },
        data: {
          theta: decayed[i].theta,
          level: decayed[i].level,
          masteryLevel: decayed[i].masteryLevel,
        },
      });
    }
  }

  const duePoints = getDueReviewPoints(decayed);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existingCount = await prisma.reviewQueue.count({
    where: {
      userId,
      status: 'pending',
      scheduledAt: { gte: today, lt: tomorrow },
    },
  });

  if (existingCount > 0) {
    return existingCount;
  }

  let created = 0;
  const dueIndexMap = new Map<number, number>();
  for (let i = 0; i < decayed.length; i++) {
    if (isDueForReview(decayed[i])) {
      dueIndexMap.set(dueIndexMap.size, i);
    }
  }

  for (let j = 0; j < Math.min(duePoints.length, 30); j++) {
    const origIdx = dueIndexMap.get(j);
    if (origIdx === undefined) continue;
    const masteryState = masteryStates[origIdx];
    const kpId = masteryState.knowledgePointId;

    const question = await prisma.question.findFirst({
      where: {
        knowledgePoints: { some: { knowledgePointId: kpId } },
      },
      orderBy: { difficulty: 'asc' },
    });

    await prisma.reviewQueue.create({
      data: {
        userId,
        knowledgePointId: kpId,
        questionId: question?.id ?? null,
        status: 'pending',
        scheduledAt: duePoints[j].nextReviewAt ?? new Date(),
      },
    });
    created++;
  }

  return created;
}

export async function getReviewTasks(userId: number): Promise<{
  tasks: ReviewTask[];
  totalCount: number;
  dueCount: number;
  yellowDotCount: number;
}> {
  await generateReviewQueue(userId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const queueItems = await prisma.reviewQueue.findMany({
    where: {
      userId,
      status: 'pending',
    },
    orderBy: { scheduledAt: 'asc' },
  });

  const knowledgePointIds = [...new Set(queueItems.map(q => q.knowledgePointId))];
  const knowledgePoints = await prisma.knowledgePoint.findMany({
    where: { id: { in: knowledgePointIds } },
  });
  const kpMap = new Map(knowledgePoints.map(kp => [kp.id, kp]));

  const progressList = await prisma.userProgress.findMany({
    where: {
      userId,
      knowledgePointId: { in: knowledgePointIds },
    },
  });
  const progressMap = new Map(progressList.map(p => [p.knowledgePointId, p]));

  const tasks: ReviewTask[] = queueItems.map(item => {
    const kp = kpMap.get(item.knowledgePointId);
    const progress = progressMap.get(item.knowledgePointId);
    const theta = progress?.theta ?? INITIAL_THETA;
    return {
      knowledgePointId: item.knowledgePointId,
      name: kp?.name ?? '未知知识点',
      category: kp?.category ?? '',
      chapter: kp?.chapter ?? '',
      theta,
      level: progress?.level ?? 0,
      levelLabel: getLevelLabel(theta),
      nextReviewAt: item.scheduledAt,
      isOverdue: new Date() >= item.scheduledAt,
      suggestedQuestionId: item.questionId,
    };
  });

  const allProgress = await prisma.userProgress.findMany({
    where: { userId, totalAttempts: { gt: 0 } },
  });
  const masteryStates: MasteryState[] = allProgress.map(p => ({
    theta: p.theta,
    level: p.level,
    masteryLevel: p.masteryLevel,
    totalAttempts: p.totalAttempts,
    correctAttempts: p.correctAttempts,
    reviewInterval: p.reviewInterval,
    reviewCount: p.reviewCount,
    lastPracticedAt: p.lastPracticedAt,
    nextReviewAt: p.nextReviewAt,
  }));

  const yellowDotCount = getYellowDotCount(masteryStates);

  return {
    tasks,
    totalCount: queueItems.length,
    dueCount: tasks.filter(t => t.isOverdue).length,
    yellowDotCount,
  };
}

export async function completeReviewTask(
  knowledgePointId: number,
  userId: number
): Promise<void> {
  const tasks = await prisma.reviewQueue.findMany({
    where: { knowledgePointId, userId, status: 'pending' },
  });

  if (tasks.length === 0) throw new Error('Review task not found');

  for (const task of tasks) {
    await prisma.reviewQueue.update({
      where: { id: task.id },
      data: { status: 'completed', completedAt: new Date() },
    });
  }
}

export async function getYellowDotStatus(userId: number): Promise<{
  yellowDotCount: number;
  dueTodayCount: number;
  categories: { category: string; count: number }[];
}> {
  const allProgress = await prisma.userProgress.findMany({
    where: { userId, totalAttempts: { gt: 0 } },
    include: { knowledgePoint: true },
  });

  const masteryStates: (MasteryState & { kpId: number; category: string })[] = allProgress.map(p => ({
    theta: p.theta,
    level: p.level,
    masteryLevel: p.masteryLevel,
    totalAttempts: p.totalAttempts,
    correctAttempts: p.correctAttempts,
    reviewInterval: p.reviewInterval,
    reviewCount: p.reviewCount,
    lastPracticedAt: p.lastPracticedAt,
    nextReviewAt: p.nextReviewAt,
    kpId: p.knowledgePointId,
    category: p.knowledgePoint.category,
  }));

  const decayed = masteryStates.map(s => calculateDecay(s));
  const dueIndices = decayed.reduce<number[]>((acc, state, i) => {
    if (isDueForReview(state)) acc.push(i);
    return acc;
  }, []);

  const categoryMap = new Map<string, number>();
  for (const idx of dueIndices) {
    const cat = masteryStates[idx].category;
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
  }

  const dueTodayCount = decayed.reduce((count, state, i) => {
    const orig = masteryStates[i];
    if (isDueForReview(state) && orig.nextReviewAt && new Date() >= orig.nextReviewAt) {
      return count + 1;
    }
    return count;
  }, 0);

  return {
    yellowDotCount: dueIndices.length,
    dueTodayCount,
    categories: [...categoryMap.entries()].map(([category, count]) => ({ category, count })),
  };
}