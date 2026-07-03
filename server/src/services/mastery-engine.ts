export interface MasteryState {
  theta: number;
  level: number;
  masteryLevel: number;
  totalAttempts: number;
  correctAttempts: number;
  reviewInterval: number;
  reviewCount: number;
  lastPracticedAt: Date | null;
  nextReviewAt: Date | null;
}

const LEVEL_THRESHOLDS = [
  { level: 0, minTheta: -Infinity, maxTheta: -1.5, label: '未学习', range: '0%' },
  { level: 1, minTheta: -1.5, maxTheta: -0.3, label: 'Lv.1 了解', range: '1-40%' },
  { level: 2, minTheta: -0.3, maxTheta: 0.8, label: 'Lv.2 熟悉', range: '41-70%' },
  { level: 3, minTheta: 0.8, maxTheta: 1.8, label: 'Lv.3 掌握', range: '71-90%' },
  { level: 4, minTheta: 1.8, maxTheta: Infinity, label: 'Lv.4 精通', range: '91-100%' },
];

export const INITIAL_THETA = -1.2;
const K = 0.12;
const MIN_INTERVAL_HOURS = 4;
const MAX_INTERVAL_DAYS = 60;
const BASE_INTERVAL_HOURS = 6;

export function getLevelFromTheta(theta: number): number {
  for (const t of LEVEL_THRESHOLDS) {
    if (theta >= t.minTheta && theta < t.maxTheta) return t.level;
  }
  return 4;
}

export function getLevelLabel(theta: number): string {
  return LEVEL_THRESHOLDS[getLevelFromTheta(theta)]?.label ?? '未知';
}

export function thetaToMasteryPercent(theta: number): number {
  const normalized = (theta + 3) / 6;
  return Math.round(Math.max(0, Math.min(1, normalized)) * 100);
}

export function getLevelConfig(theta: number) {
  return LEVEL_THRESHOLDS[getLevelFromTheta(theta)];
}

export function updateMastery(
  current: MasteryState,
  isCorrect: boolean,
  difficulty: number,
  timeSpentSeconds?: number
): MasteryState {
  const now = new Date();

  const expected = 1 / (1 + Math.exp(-(current.theta - (difficulty - 3))));
  const learningRate = K * (1 + Math.max(0, 3 - current.totalAttempts) * 0.3);

  let newTheta: number;
  if (isCorrect) {
    newTheta = current.theta + learningRate * (1 - expected);
  } else {
    newTheta = current.theta - learningRate * expected;
  }

  newTheta = Math.max(-3, Math.min(3, newTheta));

  const newTotalAttempts = current.totalAttempts + 1;
  const newCorrectAttempts = current.correctAttempts + (isCorrect ? 1 : 0);

  let newInterval: number;
  let newReviewCount = current.reviewCount;

  if (isCorrect) {
    newReviewCount = current.reviewCount + 1;
    const baseHours = BASE_INTERVAL_HOURS * Math.pow(2.2, newReviewCount - 1);
    const timeBonus = timeSpentSeconds ? Math.min(1.5, 1 + (timeSpentSeconds < 60 ? 0.2 : 0)) : 1;
    newInterval = Math.min(baseHours * timeBonus, MAX_INTERVAL_DAYS * 24);
  } else {
    newReviewCount = Math.max(0, current.reviewCount - 1);
    newInterval = Math.max(MIN_INTERVAL_HOURS, BASE_INTERVAL_HOURS / 2);
  }

  const nextReviewAt = new Date(now.getTime() + newInterval * 60 * 60 * 1000);

  const newLevel = getLevelFromTheta(newTheta);
  const newMasteryLevel = thetaToMasteryPercent(newTheta) / 100;

  return {
    theta: Math.round(newTheta * 100) / 100,
    level: newLevel,
    masteryLevel: newMasteryLevel,
    totalAttempts: newTotalAttempts,
    correctAttempts: newCorrectAttempts,
    reviewInterval: newInterval,
    reviewCount: newReviewCount,
    lastPracticedAt: now,
    nextReviewAt,
  };
}

export function calculateDecay(current: MasteryState): MasteryState {
  if (!current.lastPracticedAt) return current;

  const now = new Date();
  const hoursSinceLastPractice = (now.getTime() - current.lastPracticedAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastPractice < 24) return current;

  const decayRate = 0.02;
  const daysSinceLastPractice = hoursSinceLastPractice / 24;
  const decayAmount = decayRate * daysSinceLastPractice;

  const decayedTheta = current.theta - decayAmount;

  const newTheta = Math.max(-3, decayedTheta);
  const newLevel = getLevelFromTheta(newTheta);
  const newMasteryLevel = thetaToMasteryPercent(newTheta) / 100;

  return {
    ...current,
    theta: Math.round(newTheta * 100) / 100,
    level: newLevel,
    masteryLevel: newMasteryLevel,
  };
}

export function isDueForReview(current: MasteryState): boolean {
  if (!current.nextReviewAt) return false;
  return new Date() >= current.nextReviewAt;
}

export function getDueReviewPoints(
  progressList: MasteryState[]
): MasteryState[] {
  return progressList
    .filter(p => p.totalAttempts > 0 && isDueForReview(p))
    .sort((a, b) => a.nextReviewAt!.getTime() - b.nextReviewAt!.getTime());
}

export function getYellowDotCount(
  progressList: MasteryState[]
): number {
  return progressList.filter(p => p.totalAttempts > 0 && isDueForReview(p)).length;
}

export function getOverallLevel(progressList: MasteryState[]): {
  level: number;
  label: string;
  averageTheta: number;
  masteredCount: number;
  totalCount: number;
} {
  if (progressList.length === 0) {
    return { level: 0, label: '未学习', averageTheta: INITIAL_THETA, masteredCount: 0, totalCount: 0 };
  }

  const totalTheta = progressList.reduce((sum, p) => sum + p.theta, 0);
  const averageTheta = totalTheta / progressList.length;
  const masteredCount = progressList.filter(p => p.level >= 3).length;

  return {
    level: getLevelFromTheta(averageTheta),
    label: getLevelLabel(averageTheta),
    averageTheta,
    masteredCount,
    totalCount: progressList.length,
  };
}