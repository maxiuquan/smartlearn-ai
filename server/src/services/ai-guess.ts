import { prisma } from '../db';
import { getLevelFromTheta } from './mastery-engine';

export interface AiGuessResult {
  questionId: number;
  content: string;
  difficulty: number;
  knowledgePoints: string[];
  prediction: 'green' | 'orange' | 'red';
  confidence: number;
  reason: string;
}

export async function predictExternalBookQuestions(
  userId: number,
  bookName: string,
  category?: string,
  chapter?: string
): Promise<{
  green: AiGuessResult[];
  orange: AiGuessResult[];
  red: AiGuessResult[];
  summary: { total: number; canSkip: number; shouldDo: number; mustReview: number };
}> {
  const userProgress = await prisma.userProgress.findMany({
    where: { userId },
    include: { knowledgePoint: true },
  });

  const progressMap = new Map(userProgress.map(p => [p.knowledgePointId, p]));

  const kpWhere: Record<string, unknown> = { subject: 'math' };
  if (category) kpWhere.category = category;
  if (chapter) kpWhere.chapter = chapter;

  const knowledgePoints = await prisma.knowledgePoint.findMany({
    where: kpWhere,
    include: {
      questions: {
        include: {
          question: {
            include: {
              knowledgePoints: {
                include: { knowledgePoint: true },
              },
            },
          },
        },
      },
    },
  });

  const allQuestions = new Map<number, {
    id: number;
    content: string;
    difficulty: number;
    knowledgePoints: string[];
  }>();

  for (const kp of knowledgePoints) {
    for (const qkp of kp.questions) {
      if (!allQuestions.has(qkp.question.id)) {
        allQuestions.set(qkp.question.id, {
          id: qkp.question.id,
          content: qkp.question.content,
          difficulty: qkp.question.difficulty,
          knowledgePoints: qkp.question.knowledgePoints.map(k => k.knowledgePoint.name),
        });
      }
    }
  }

  const green: AiGuessResult[] = [];
  const orange: AiGuessResult[] = [];
  const red: AiGuessResult[] = [];

  for (const [, q] of allQuestions) {
    const relatedKps = knowledgePoints.filter(kp =>
      kp.questions.some(qkp => qkp.questionId === q.id)
    );

    let totalTheta = 0;
    let totalWeight = 0;

    for (const kp of relatedKps) {
      const progress = progressMap.get(kp.id);
      const weight = q.difficulty > 0 ? 1 / q.difficulty : 1;
      if (progress && progress.totalAttempts > 0) {
        totalTheta += progress.theta * weight;
        totalWeight += weight;
      }
    }

    const avgTheta = totalWeight > 0 ? totalTheta / totalWeight : -3;
    const level = getLevelFromTheta(avgTheta);

    let prediction: 'green' | 'orange' | 'red';
    let confidence: number;
    let reason: string;

    if (level >= 3) {
      prediction = 'green';
      confidence = Math.min(95, 70 + (level - 3) * 25);
      reason = `掌握度等级${level}，预计能够正确解答`;
    } else if (level >= 2) {
      prediction = 'orange';
      confidence = 50 + (level - 2) * 20;
      reason = `掌握度等级${level}，有一定基础但需巩固，建议练习`;
    } else {
      prediction = 'red';
      confidence = Math.max(10, 30 - Math.abs(avgTheta + 3) * 10);
      reason = `掌握度等级${level}，基础薄弱，建议先复习相关知识`;
    }

    const result: AiGuessResult = {
      questionId: q.id,
      content: q.content.length > 80 ? q.content.substring(0, 80) + '...' : q.content,
      difficulty: q.difficulty,
      knowledgePoints: q.knowledgePoints,
      prediction,
      confidence,
      reason,
    };

    if (prediction === 'green') green.push(result);
    else if (prediction === 'orange') orange.push(result);
    else red.push(result);
  }

  return {
    green,
    orange,
    red,
    summary: {
      total: allQuestions.size,
      canSkip: green.length,
      shouldDo: orange.length,
      mustReview: red.length,
    },
  };
}

export async function getAiGuessForBook(
  userId: number,
  bookName: string
): Promise<{
  bookName: string;
  prediction: AiGuessResult[];
  summary: { canSkip: number; shouldDo: number; mustReview: number; total: number };
  estimatedTimeSaved: string;
}> {
  const result = await predictExternalBookQuestions(userId, bookName);

  const prediction = [...result.green, ...result.orange, ...result.red];
  const totalEstimated = prediction.length * 3;
  const skippedTime = result.green.length * 3;
  const savedPercent = totalEstimated > 0 ? Math.round((skippedTime / totalEstimated) * 100) : 0;

  return {
    bookName,
    prediction,
    summary: result.summary,
    estimatedTimeSaved: `可节省约 ${savedPercent}% 的时间`,
  };
}