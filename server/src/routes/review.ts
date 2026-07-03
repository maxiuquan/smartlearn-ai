import { Router } from 'express';
import { getReviewTasks, completeReviewTask, getYellowDotStatus } from '../services/review-scheduler';

export const reviewRoutes = Router();

reviewRoutes.get('/queue/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const result = await getReviewTasks(userId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取复习队列失败';
    res.status(500).json({ error: message });
  }
});

reviewRoutes.post('/complete', async (req, res) => {
  try {
    const { knowledgePointId, userId } = req.body;
    if (!knowledgePointId || !userId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    await completeReviewTask(Number(knowledgePointId), Number(userId));
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '完成复习任务失败';
    res.status(500).json({ error: message });
  }
});

reviewRoutes.get('/yellow-dot/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const result = await getYellowDotStatus(userId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取小黄点状态失败';
    res.status(500).json({ error: message });
  }
});