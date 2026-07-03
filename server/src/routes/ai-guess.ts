import { Router } from 'express';
import { getAiGuessForBook } from '../services/ai-guess';

export const aiGuessRoutes = Router();

aiGuessRoutes.get('/book/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const bookName = String(req.query.book || '考研数学复习全书');
    const result = await getAiGuessForBook(userId, bookName);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI猜失败';
    res.status(500).json({ error: message });
  }
});