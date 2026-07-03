import { Router } from 'express';
import { createScaffoldSession, getNextHint, revealSolution } from '../services/scaffold-practice';

export const scaffoldRoutes = Router();

const sessions = new Map<string, ReturnType<typeof createScaffoldSession> extends Promise<infer T> ? T : never>();

scaffoldRoutes.post('/start', async (req, res) => {
  try {
    const { questionId, chapter } = req.body;
    if (!questionId) {
      return res.status(400).json({ error: '缺少题目ID' });
    }
    const session = await createScaffoldSession(Number(questionId), chapter);
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(sessionId, session);
    res.json({
      sessionId,
      questionContent: session.questionContent,
      knowledgePoints: session.knowledgePoints,
      difficulty: session.difficulty,
      currentHintStep: session.currentHintStep,
      totalHints: session.hints.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建引导训练失败';
    res.status(500).json({ error: message });
  }
});

scaffoldRoutes.post('/hint', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(400).json({ error: '无效的会话ID' });
    }
    const session = sessions.get(sessionId)!;
    const result = await getNextHint(session);
    sessions.set(sessionId, result.session);
    if (!result.hint) {
      const solution = await revealSolution(result.session);
      return res.json({
        hint: null,
        solution: solution.solution,
        answer: solution.answer,
        currentStep: result.session.currentHintStep,
        allHintsUsed: true,
      });
    }
    res.json({
      hint: result.hint,
      currentStep: result.session.currentHintStep,
      totalHints: result.session.hints.length,
      allHintsUsed: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取提示失败';
    res.status(500).json({ error: message });
  }
});

scaffoldRoutes.post('/reveal', (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(400).json({ error: '无效的会话ID' });
    }
    const session = sessions.get(sessionId)!;
    res.json({
      solution: session.solution,
      answer: session.answer,
    });
  } catch (error) {
    res.status(500).json({ error: '获取答案失败' });
  }
});