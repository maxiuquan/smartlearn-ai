import { Router } from 'express';
import { prisma } from '../db';

export const studyPlanRoutes = Router();

studyPlanRoutes.get('/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const plan = await prisma.studyPlan.findFirst({
      where: { userId },
      include: {
        items: {
          include: { knowledgePoint: true },
          orderBy: { weekNumber: 'asc' },
        },
      },
    });

    if (!plan) {
      return res.json({ plan: null, message: '暂无学习计划' });
    }

    res.json({ plan });
  } catch (error) {
    res.status(500).json({ error: '获取学习计划失败' });
  }
});

studyPlanRoutes.post('/create', async (req, res) => {
  try {
    const { userId, examType, startDate, endDate, totalWeeks } = req.body;

    if (!userId || !examType || !totalWeeks) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const existing = await prisma.studyPlan.findFirst({
      where: { userId: Number(userId) },
    });

    if (existing) {
      await prisma.studyPlan.delete({ where: { id: existing.id } });
    }

    const plan = await prisma.studyPlan.create({
      data: {
        userId: Number(userId),
        examType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalWeeks: Number(totalWeeks),
        currentWeek: 1,
      },
    });

    const allKps = await prisma.knowledgePoint.findMany({
      where: { subject: 'math' },
      orderBy: { difficulty: 'asc' },
    });

    const kpsPerWeek = Math.ceil(allKps.length / Number(totalWeeks));

    const items = [];
    for (let i = 0; i < allKps.length; i++) {
      const weekNumber = Math.floor(i / kpsPerWeek) + 1;
      items.push({
        planId: plan.id,
        knowledgePointId: allKps[i].id,
        weekNumber: Math.min(weekNumber, Number(totalWeeks)),
        status: 'pending',
      });
    }

    await prisma.studyPlanItem.createMany({ data: items });

    const fullPlan = await prisma.studyPlan.findUnique({
      where: { id: plan.id },
      include: {
        items: {
          include: { knowledgePoint: true },
          orderBy: { weekNumber: 'asc' },
        },
      },
    });

    res.json({ plan: fullPlan });
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建学习计划失败';
    res.status(500).json({ error: message });
  }
});

studyPlanRoutes.post('/update-week', async (req, res) => {
  try {
    const { userId, currentWeek } = req.body;
    const plan = await prisma.studyPlan.findFirst({
      where: { userId: Number(userId) },
    });
    if (!plan) {
      return res.status(404).json({ error: '未找到学习计划' });
    }
    await prisma.studyPlan.update({
      where: { id: plan.id },
      data: { currentWeek: Number(currentWeek) },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新进度失败' });
  }
});