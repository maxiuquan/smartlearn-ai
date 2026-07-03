import { Router } from 'express';
import { prisma } from '../db';

export const stopPointRoutes = Router();

interface StopPoint {
  knowledgePointId: number;
  name: string;
  category: string;
  chapter: string;
  totalAttempts: number;
  wrongAttempts: number;
  wrongRate: number;
  lastWrongAt: Date | null;
  severity: 'warning' | 'critical' | 'blocker';
  masteryLevel: number;
  recommendedActions: string[];
  upstreamStoppers: { id: number; name: string; mastery: number }[];
}

interface ErrorPattern {
  pattern: string;
  occurrences: number;
  examples: { questionId: number; userAnswer: string; correctAnswer: string; weakPoint: string }[];
  classification: 'misconception' | 'careless' | 'knowledge_gap' | 'method_missing';
  rootCauseHypothesis: string;
}

stopPointRoutes.post('/detect', async (req, res) => {
  try {
    const { userId, windowDays = 14, minAttempts = 3 } = req.body as { userId: number; windowDays?: number; minAttempts?: number };
    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }

    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const records = await prisma.answerRecord.findMany({
      where: { userId: Number(userId), createdAt: { gte: since } },
      include: {
        question: {
          include: { knowledgePoints: { include: { knowledgePoint: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const kpStats = new Map<number, { total: number; wrong: number; lastWrong: Date | null; name: string; category: string; chapter: string }>();
    for (const r of records) {
      for (const qkp of r.question.knowledgePoints) {
        const kp = qkp.knowledgePoint;
        if (!kp) continue;
        const existing = kpStats.get(kp.id) || { total: 0, wrong: 0, lastWrong: null, name: kp.name, category: kp.category, chapter: kp.chapter };
        existing.total++;
        if (!r.isCorrect) {
          existing.wrong++;
          if (!existing.lastWrong || r.createdAt > existing.lastWrong) existing.lastWrong = r.createdAt;
        }
        kpStats.set(kp.id, existing);
      }
    }

    const userProgress = await prisma.userProgress.findMany({
      where: { userId: Number(userId) },
    });
    const progressMap = new Map(userProgress.map(p => [p.knowledgePointId, p.masteryLevel]));

    const stopPoints: StopPoint[] = [];
    for (const [kpId, stat] of kpStats.entries()) {
      if (stat.total < minAttempts) continue;
      const wrongRate = stat.wrong / stat.total;
      if (wrongRate < 0.3) continue;
      const mastery = progressMap.get(kpId) ?? 0;
      const severity: StopPoint['severity'] = wrongRate >= 0.7 ? 'blocker' : wrongRate >= 0.5 ? 'critical' : 'warning';
      const upstream = await prisma.knowledgePointRelation.findMany({
        where: { knowledgePointId: kpId },
        include: { prerequisite: true },
      });
      const upstreamStoppers = await Promise.all(
        upstream
          .filter(u => (progressMap.get(u.prerequisiteId) ?? 0) < 0.5)
          .map(async u => ({
            id: u.prerequisite.id,
            name: u.prerequisite.name,
            mastery: progressMap.get(u.prerequisiteId) ?? 0,
          }))
      );

      const recommendedActions: string[] = [];
      if (upstreamStoppers.length > 0) {
        recommendedActions.push(`先巩固前置知识：${upstreamStoppers[0].name}`);
      }
      if (severity === 'blocker') {
        recommendedActions.push('立即暂停同类题训练，转入「断点突破」模式');
        recommendedActions.push('启用5-Why根因分析，定位错误模式');
      } else if (severity === 'critical') {
        recommendedActions.push('建议做5-10道同类型基础题巩固');
        recommendedActions.push('查看AI分步支架教学');
      } else {
        recommendedActions.push('继续练习，AI将自适应调低难度');
      }

      stopPoints.push({
        knowledgePointId: kpId,
        name: stat.name,
        category: stat.category,
        chapter: stat.chapter,
        totalAttempts: stat.total,
        wrongAttempts: stat.wrong,
        wrongRate: Math.round(wrongRate * 100),
        lastWrongAt: stat.lastWrong,
        severity,
        masteryLevel: mastery,
        recommendedActions,
        upstreamStoppers,
      });
    }

    stopPoints.sort((a, b) => {
      const sevOrder = { blocker: 0, critical: 1, warning: 2 };
      if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity];
      return b.wrongRate - a.wrongRate;
    });

    res.json({ stopPoints, generatedAt: new Date() });
  } catch (error) {
    console.error('断点检测失败', error);
    res.status(500).json({ error: '断点检测失败：' + (error as Error).message });
  }
});

stopPointRoutes.post('/analyze-errors', async (req, res) => {
  try {
    const { userId, knowledgePointId, limit = 20 } = req.body as { userId: number; knowledgePointId: number; limit?: number };
    if (!userId || !knowledgePointId) {
      return res.status(400).json({ error: '缺少参数' });
    }

    const records = await prisma.answerRecord.findMany({
      where: {
        userId: Number(userId),
        isCorrect: false,
        question: { knowledgePoints: { some: { knowledgePointId: Number(knowledgePointId) } } },
      },
      include: { question: { include: { knowledgePoints: { include: { knowledgePoint: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });

    const questionTypeErrors = new Map<string, number>();
    const wpErrors = new Map<string, number>();
    for (const r of records) {
      questionTypeErrors.set(r.question.questionType, (questionTypeErrors.get(r.question.questionType) || 0) + 1);
      for (const qkp of r.question.knowledgePoints) {
        wpErrors.set(qkp.knowledgePoint.name, (wpErrors.get(qkp.knowledgePoint.name) || 0) + 1);
      }
    }

    const patterns: ErrorPattern[] = [];

    if (records.length >= 3) {
      const choiceErrors = records.filter(r => r.question.questionType === 'choice' && r.userAnswer && r.question.answer);
      if (choiceErrors.length >= 2) {
        const distractorMap = new Map<string, number>();
        for (const r of choiceErrors) {
          if (r.userAnswer !== r.question.answer) {
            const distractor = r.userAnswer;
            distractorMap.set(distractor, (distractorMap.get(distractor) || 0) + 1);
          }
        }
        const topDistractor = [...distractorMap.entries()].sort((a, b) => b[1] - a[1])[0];
        if (topDistractor && topDistractor[1] >= 2) {
          patterns.push({
            pattern: '反复选择同一错误选项',
            occurrences: topDistractor[1],
            examples: choiceErrors.slice(0, 2).map(r => ({
              questionId: r.questionId,
              userAnswer: r.userAnswer,
              correctAnswer: r.question.answer,
              weakPoint: r.question.knowledgePoints.map(qk => qk.knowledgePoint.name).join(', '),
            })),
            classification: 'misconception',
            rootCauseHypothesis: `可能存在对干扰项的特定误解，建议对照正确答案和解析，理解 ${topDistractor[0]} 与正确答案的本质区别。`,
          });
        }
      }

      const fillErrors = records.filter(r => r.question.questionType === 'fill_in');
      if (fillErrors.length >= 2) {
        patterns.push({
          pattern: '填空题反复错误',
          occurrences: fillErrors.length,
          examples: fillErrors.slice(0, 2).map(r => ({
            questionId: r.questionId,
            userAnswer: r.userAnswer,
            correctAnswer: r.question.answer,
            weakPoint: r.question.knowledgePoints.map(qk => qk.knowledgePoint.name).join(', '),
          })),
          classification: 'knowledge_gap',
          rootCauseHypothesis: '可能是公式记忆不牢或步骤跳跃，建议查看支架教学一步步重做。',
        });
      }
    }

    const topWp = [...wpErrors.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topWp) {
      patterns.push({
        pattern: `薄弱知识点集中：${topWp[0]}`,
        occurrences: topWp[1],
        examples: [],
        classification: 'knowledge_gap',
        rootCauseHypothesis: `建议优先攻克「${topWp[0]}」，这是断点所在。`,
      });
    }

    res.json({
      knowledgePointId,
      totalErrors: records.length,
      patterns,
      questionTypeBreakdown: Object.fromEntries(questionTypeErrors),
      weakPointBreakdown: Object.fromEntries(wpErrors),
      fiveWhyTemplate: [
        { q: '为什么错了？', a: records.length > 0 ? `最近${records.length}次同类题答错` : '无错误记录' },
        { q: '为什么这类题会错？', a: '知识结构有缺口' },
        { q: '为什么有缺口？', a: '可能前置知识点没掌握' },
        { q: '为什么前置没掌握？', a: '基础阶段训练不足' },
        { q: '为什么基础训练不足？', a: '建议回到基础阶段专项训练' },
      ],
    });
  } catch (error) {
    console.error('错误分析失败', error);
    res.status(500).json({ error: '错误分析失败' });
  }
});

stopPointRoutes.get('/recovery-plan/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const records = await prisma.answerRecord.findMany({
      where: { userId, createdAt: { gte: since } },
      include: { question: { include: { knowledgePoints: { include: { knowledgePoint: true } } } } },
    });

    const wrongByKp = new Map<number, number>();
    for (const r of records) {
      if (r.isCorrect) continue;
      for (const qkp of r.question.knowledgePoints) {
        wrongByKp.set(qkp.knowledgePointId, (wrongByKp.get(qkp.knowledgePointId) || 0) + 1);
      }
    }

    const topKps = [...wrongByKp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const plan: { day: number; focus: string; questions: number; type: string }[] = [];
    for (let i = 0; i < topKps.length; i++) {
      const [kpId, wrongCount] = topKps[i];
      const kp = await prisma.knowledgePoint.findUnique({ where: { id: kpId } });
      if (!kp) continue;
      plan.push({
        day: i + 1,
        focus: kp.name,
        questions: Math.min(10, wrongCount * 2),
        type: '断点突破',
      });
    }
    if (plan.length < 7) {
      for (let i = plan.length; i < 7; i++) {
        plan.push({ day: i + 1, focus: '综合训练', questions: 5, type: '混合练习' });
      }
    }

    res.json({ plan, generatedAt: new Date() });
  } catch (error) {
    console.error('生成恢复计划失败', error);
    res.status(500).json({ error: '生成恢复计划失败' });
  }
});
