import { prisma } from '../db';
import { updateMastery, calculateDecay, getLevelFromTheta, getLevelLabel, INITIAL_THETA, type MasteryState } from './mastery-engine';

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export interface AnalysisResult {
  isCorrect: boolean;
  correctAnswer: string;
  analysis: string;
  weakPoints: {
    id: number;
    name: string;
    category: string;
    reason: string;
  }[];
  prerequisiteGaps: {
    id: number;
    name: string;
    category: string;
    masteryLevel: number;
  }[];
  recommendedQuestions: number[];
  updatedLevel: number;
  updatedLevelLabel: string;
  nextReviewIn: string;
}

async function findPrerequisiteGaps(
  knowledgePointIds: number[],
  userId: number
): Promise<{ id: number; name: string; category: string; masteryLevel: number }[]> {
  const gaps: { id: number; name: string; category: string; masteryLevel: number }[] = [];

  for (const kpId of knowledgePointIds) {
    const prerequisites = await prisma.knowledgePointRelation.findMany({
      where: { knowledgePointId: kpId },
      include: { prerequisite: true },
    });

    for (const rel of prerequisites) {
      const progress = await prisma.userProgress.findUnique({
        where: {
          userId_knowledgePointId: {
            userId,
            knowledgePointId: rel.prerequisiteId,
          },
        },
      });

      const mastery = progress?.masteryLevel ?? 0;
      if (mastery < 0.6) {
        if (!gaps.find(g => g.id === rel.prerequisite.id)) {
          gaps.push({
            id: rel.prerequisite.id,
            name: rel.prerequisite.name,
            category: rel.prerequisite.category,
            masteryLevel: mastery,
          });
        }
      }
    }
  }

  return gaps.sort((a, b) => a.masteryLevel - b.masteryLevel);
}

async function findWeakPoints(
  knowledgePointIds: number[],
  userId: number,
  isCorrect: boolean
): Promise<{ id: number; name: string; category: string; reason: string }[]> {
  const weakPoints: { id: number; name: string; category: string; reason: string }[] = [];

  if (isCorrect) return [];

  const candidateIds = knowledgePointIds;

  for (const kpId of candidateIds) {
    const progress = await prisma.userProgress.findUnique({
      where: {
        userId_knowledgePointId: { userId, knowledgePointId: kpId },
      },
    });
    const kp = await prisma.knowledgePoint.findUnique({ where: { id: kpId } });
    if (!kp) continue;

    const mastery = progress?.masteryLevel ?? 0;
    const totalAttempts = progress?.totalAttempts ?? 0;

    let reason = '';
    if (mastery < 0.3) {
      reason = `知识点「${kp.name}」掌握程度较低（${Math.round(mastery * 100)}%），建议从基础概念开始复习`;
    } else if (mastery < 0.6 && totalAttempts >= 3) {
      reason = `知识点「${kp.name}」多次练习仍未达标，可能存在概念理解偏差`;
    } else if (totalAttempts < 2) {
      reason = `知识点「${kp.name}」练习次数不足，需要加强训练`;
    } else {
      reason = `知识点「${kp.name}」需要进一步巩固`;
    }

    weakPoints.push({
      id: kp.id,
      name: kp.name,
      category: kp.category,
      reason,
    });
  }

  for (const kpId of candidateIds) {
    const dependentKps = await prisma.knowledgePointRelation.findMany({
      where: { prerequisiteId: kpId },
      include: { knowledgePoint: true },
    });

    for (const rel of dependentKps) {
      const progress = await prisma.userProgress.findUnique({
        where: {
          userId_knowledgePointId: {
            userId,
            knowledgePointId: rel.knowledgePointId,
          },
        },
      });
      if (progress && progress.masteryLevel < 0.5) {
        if (!weakPoints.find(w => w.id === rel.knowledgePoint.id)) {
          weakPoints.push({
            id: rel.knowledgePoint.id,
            name: rel.knowledgePoint.name,
            category: rel.knowledgePoint.category,
            reason: `作为「${rel.knowledgePoint.name}」的前置知识点，掌握不足影响后续学习`,
          });
        }
      }
    }
  }

  return weakPoints;
}

async function recommendQuestions(
  weakPointIds: number[],
  prerequisiteGapIds: number[],
  userId: number
): Promise<number[]> {
  const allPointIds = [...new Set([...weakPointIds, ...prerequisiteGapIds])];
  if (allPointIds.length === 0) return [];

  const questionKps = await prisma.questionKnowledgePoint.findMany({
    where: { knowledgePointId: { in: allPointIds } },
    include: { question: true },
    orderBy: { question: { difficulty: 'asc' } },
    take: 10,
  });

  const answeredIds = new Set(
    (await prisma.answerRecord.findMany({
      where: { userId },
      select: { questionId: true },
    })).map(r => r.questionId)
  );

  return questionKps
    .map(qk => qk.questionId)
    .filter(id => !answeredIds.has(id))
    .slice(0, 5);
}

function formatNextReview(intervalHours: number): string {
  if (intervalHours < 1) return '不到1小时';
  if (intervalHours < 24) return `${Math.round(intervalHours)}小时后`;
  const days = Math.round(intervalHours / 24);
  return `${days}天后`;
}

export async function analyzeAnswer(
  userId: number,
  questionId: number,
  userAnswer: string,
  timeSpent?: number
): Promise<AnalysisResult> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { knowledgePoints: { include: { knowledgePoint: true } } },
  });

  if (!question) {
    throw new Error('Question not found');
  }

  const isCorrect = userAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();
  const kpIds = question.knowledgePoints.map(kp => kp.knowledgePointId);

  const weakPoints = await findWeakPoints(kpIds, userId, isCorrect);
  const prerequisiteGaps = isCorrect
    ? []
    : await findPrerequisiteGaps(kpIds, userId);

  let analysis: string;
  if (isCorrect) {
    analysis = `回答正确！本题考察${question.knowledgePoints.map(k => k.knowledgePoint.name).join('、')}，你已经掌握了相关知识点。`;
  } else {
    const weakPointNames = weakPoints.map(w => w.name).join('、');
    const gapNames = prerequisiteGaps.map(g => g.name).join('、');
    analysis = `回答错误。正确答案是：${question.answer}。\n\n`;
    analysis += `错误原因分析：本题涉及的知识点「${weakPointNames}」掌握不足。`;
    if (prerequisiteGaps.length > 0) {
      analysis += `\n前置知识点薄弱：「${gapNames}」，建议先巩固这些基础内容。`;
    }
    analysis += `\n\n解题思路：${question.solution}`;
  }

  const allWeakIds = [...weakPoints.map(w => w.id), ...prerequisiteGaps.map(g => g.id)];
  const recommended = await recommendQuestions(
    weakPoints.map(w => w.id),
    prerequisiteGaps.map(g => g.id),
    userId
  );

  await prisma.answerRecord.create({
    data: {
      userId,
      questionId,
      userAnswer,
      isCorrect,
      timeSpent: timeSpent ?? null,
      analysis,
      weakPointIds: JSON.stringify(allWeakIds),
    },
  });

  let updatedLevel = 0;
  let updatedLevelLabel = '';
  let nextReviewIn = '';

  const pointIds = question.knowledgePoints.map(kp => kp.knowledgePointId);
  for (const kpId of pointIds) {
    const existing = await prisma.userProgress.findUnique({
      where: { userId_knowledgePointId: { userId, knowledgePointId: kpId } },
    });

    const currentState: MasteryState = {
      theta: existing?.theta ?? INITIAL_THETA,
      level: existing?.level ?? 0,
      masteryLevel: existing?.masteryLevel ?? 0,
      totalAttempts: existing?.totalAttempts ?? 0,
      correctAttempts: existing?.correctAttempts ?? 0,
      reviewInterval: existing?.reviewInterval ?? 0,
      reviewCount: existing?.reviewCount ?? 0,
      lastPracticedAt: existing?.lastPracticedAt ?? null,
      nextReviewAt: existing?.nextReviewAt ?? null,
    };

    const decayed = calculateDecay(currentState);
    const updated = updateMastery(decayed, isCorrect, question.difficulty, timeSpent);

    if (existing) {
      await prisma.userProgress.update({
        where: { id: existing.id },
        data: {
          theta: updated.theta,
          masteryLevel: updated.masteryLevel,
          totalAttempts: updated.totalAttempts,
          correctAttempts: updated.correctAttempts,
          level: updated.level,
          lastPracticedAt: updated.lastPracticedAt,
          nextReviewAt: updated.nextReviewAt,
          reviewInterval: updated.reviewInterval,
          reviewCount: updated.reviewCount,
        },
      });
    } else {
      await prisma.userProgress.create({
        data: {
          userId,
          knowledgePointId: kpId,
          theta: updated.theta,
          masteryLevel: updated.masteryLevel,
          totalAttempts: updated.totalAttempts,
          correctAttempts: updated.correctAttempts,
          level: updated.level,
          lastPracticedAt: updated.lastPracticedAt,
          nextReviewAt: updated.nextReviewAt,
          reviewInterval: updated.reviewInterval,
          reviewCount: updated.reviewCount,
        },
      });
    }

    updatedLevel = updated.level;
    updatedLevelLabel = getLevelLabel(updated.theta);
    nextReviewIn = formatNextReview(updated.reviewInterval);
  }

  return {
    isCorrect,
    correctAnswer: question.answer,
    analysis,
    weakPoints,
    prerequisiteGaps,
    recommendedQuestions: recommended,
    updatedLevel,
    updatedLevelLabel,
    nextReviewIn,
  };
}

export async function getSmartRecommendations(userId: number): Promise<{
  weakPoints: { id: number; name: string; category: string; mastery: number; level: number }[];
  nextToLearn: { id: number; name: string; category: string; reason: string }[];
}> {
  const progress = await prisma.userProgress.findMany({
    where: { userId },
    include: { knowledgePoint: true },
  });

  const weakPoints = progress
    .filter(p => p.masteryLevel < 0.6)
    .sort((a, b) => a.masteryLevel - b.masteryLevel)
    .slice(0, 10)
    .map(p => ({
      id: p.knowledgePointId,
      name: p.knowledgePoint.name,
      category: p.knowledgePoint.category,
      mastery: p.masteryLevel,
      level: p.level,
    }));

  const allKnowledgePoints = await prisma.knowledgePoint.findMany({
    where: { subject: 'math' },
  });

  const learnedIds = new Set(progress.map(p => p.knowledgePointId));
  const nextToLearn: { id: number; name: string; category: string; reason: string }[] = [];

  for (const kp of allKnowledgePoints) {
    if (learnedIds.has(kp.id)) continue;

    const prerequisites = await prisma.knowledgePointRelation.findMany({
      where: { knowledgePointId: kp.id },
    });

    if (prerequisites.length === 0) {
      nextToLearn.push({
        id: kp.id,
        name: kp.name,
        category: kp.category,
        reason: '无前置依赖，可以直接开始学习',
      });
      continue;
    }

    const allPrereqsMet = prerequisites.every(rel => {
      const p = progress.find(pp => pp.knowledgePointId === rel.prerequisiteId);
      return p && p.masteryLevel >= 0.7;
    });

    if (allPrereqsMet) {
      nextToLearn.push({
        id: kp.id,
        name: kp.name,
        category: kp.category,
        reason: '前置知识点已掌握，可以进行学习',
      });
    }
  }

  return { weakPoints, nextToLearn: nextToLearn.slice(0, 10) };
}

export function generateArticleFromWords(
  words: { word: string; definition: string; exampleSentence?: string | null }[]
): { title: string; content: string } {
  if (words.length === 0) {
    return { title: '暂无文章', content: '请先学习一些单词。' };
  }

  const titleThemes = [
    `The Power of ${words[0]?.word || 'Learning'}`,
    `Understanding ${words.slice(0, 2).map(w => w.word).join(' and ')}`,
    `A Journey Through ${words[0]?.word || 'Knowledge'}`,
    `${words[0]?.word || 'Growth'}: A Path to Success`,
  ];
  const title = pick(titleThemes);

  const articleIntro = [
    `In today's rapidly evolving world, the pursuit of knowledge has never been more important. As we navigate through complex challenges, certain key concepts stand out as essential building blocks for deeper understanding.`,
    `Throughout history, great thinkers have emphasized the importance of continuous learning. The concepts we explore today form the foundation of modern thought and innovation.`,
    `Learning is a lifelong journey, and every new word or concept we master opens doors to greater understanding. Let us explore several important ideas that connect to form a broader picture.`,
  ];

  const articleOutro = [
    `In conclusion, mastering these concepts requires dedication, practice, and a willingness to engage deeply with the material. Each term we have explored represents not just a word, but a gateway to broader understanding and practical application.`,
    `As we reflect on these interconnected ideas, it becomes clear that learning is not merely about memorization—it is about building connections and developing insight that lasts a lifetime.`,
    `The journey of learning never truly ends. Each concept builds upon another, creating a rich tapestry of knowledge that empowers us to think more critically and act more wisely.`,
  ];

  const paragraphs: string[] = [];
  paragraphs.push(pick(articleIntro));

  const wordGroups: { word: string; definition: string; exampleSentence?: string | null }[][] = [];
  for (let i = 0; i < words.length; i += 3) {
    wordGroups.push(words.slice(i, i + 3));
  }

  for (const group of wordGroups) {
    const sentences: string[] = [];

    for (const w of group) {
      if (w.exampleSentence) {
        sentences.push(w.exampleSentence);
      } else {
        const wordTemplates = [
          `The concept of "${w.word}" (${w.definition}) plays a crucial role in this context.`,
          `One cannot overlook the significance of "${w.word}"—which means ${w.definition}—in understanding the broader picture.`,
          `Scholars often emphasize that "${w.word}", defined as ${w.definition}, is fundamental to making progress in this field.`,
          `When we consider "${w.word}" (${w.definition}), we begin to see how interconnected these ideas truly are.`,
          `The term "${w.word}" refers to ${w.definition}, and its applications extend far beyond what we might initially imagine.`,
        ];
        sentences.push(pick(wordTemplates));
      }
    }

    const bridge = [
      `These ideas are deeply interconnected, each reinforcing the other in meaningful ways.`,
      `Together, these concepts form a cohesive framework for deeper understanding.`,
      `When we examine these terms collectively, their relationships become increasingly clear.`,
    ];

    paragraphs.push(sentences.join(' ') + ' ' + pick(bridge));
  }

  paragraphs.push(pick(articleOutro));

  const wordHighlight = `\n\n【本文重点词汇】\n${words.map(w => `• ${w.word} — ${w.definition}`).join('\n')}`;

  return { title, content: paragraphs.join('\n\n') + wordHighlight };
}

export function generateWordQuestions(
  words: { word: string; definition: string }[]
): { question: string; options: string[]; answer: string }[] {
  if (words.length < 4) return [];

  const questions: { question: string; options: string[]; answer: string }[] = [];

  for (let i = 0; i < Math.min(words.length, 5); i++) {
    const correct = words[i];
    const others = words.filter((_, idx) => idx !== i).slice(0, 3);

    while (others.length < 3) {
      others.push({ word: `distractor_${others.length}`, definition: `干扰选项${others.length}` });
    }

    const options = [correct, ...others].sort(() => Math.random() - 0.5);

    questions.push({
      question: `单词 "${correct.word}" 的中文意思是？`,
      options: options.map(o => o.definition),
      answer: correct.definition,
    });
  }

  return questions;
}