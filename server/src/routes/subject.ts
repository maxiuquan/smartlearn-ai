import { Router } from 'express';
import { prisma } from '../db';

export const subjectRoutes = Router();

subjectRoutes.get('/:userId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.userId) },
      select: { currentSubject: true, englishLevel: true, targetExam: true },
    });
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: '获取科目信息失败' });
  }
});

subjectRoutes.post('/select', async (req, res) => {
  try {
    const { userId, subject } = req.body;
    if (!userId || !subject) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    if (!['math', 'english'].includes(subject)) {
      return res.status(400).json({ error: '无效的科目' });
    }
    const user = await prisma.user.update({
      where: { id: Number(userId) },
      data: { currentSubject: subject },
      select: { id: true, currentSubject: true, englishLevel: true, targetExam: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: '设置科目失败' });
  }
});

subjectRoutes.post('/set-english-level', async (req, res) => {
  try {
    const { userId, level } = req.body;
    if (!userId || !level) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
      return res.status(400).json({ error: '无效的等级' });
    }
    const user = await prisma.user.update({
      where: { id: Number(userId) },
      data: { englishLevel: level },
      select: { id: true, englishLevel: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: '设置英语等级失败' });
  }
});

subjectRoutes.post('/set-target-exam', async (req, res) => {
  try {
    const { userId, targetExam } = req.body;
    if (!userId || !targetExam) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    const user = await prisma.user.update({
      where: { id: Number(userId) },
      data: { targetExam },
      select: { id: true, targetExam: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: '设置考试目标失败' });
  }
});