import { Router } from 'express';
import { prisma } from '../db';

export const checkinRoutes = Router();

checkinRoutes.post('/', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await prisma.checkIn.findFirst({
      where: {
        userId,
        date: { gte: today, lt: tomorrow },
      },
    });

    if (existing) {
      return res.json({
        checkedIn: false,
        alreadyCheckedIn: true,
        streak: existing.streak,
        date: existing.date,
      });
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayCheckin = await prisma.checkIn.findFirst({
      where: {
        userId,
        date: { gte: yesterday, lt: today },
      },
    });

    const streak = yesterdayCheckin ? yesterdayCheckin.streak + 1 : 1;

    const checkin = await prisma.checkIn.create({
      data: {
        userId,
        date: today,
        streak,
      },
    });

    res.json({
      checkedIn: true,
      streak,
      date: checkin.date,
    });
  } catch (error) {
    res.status(500).json({ error: '打卡失败' });
  }
});

checkinRoutes.get('/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCheckin = await prisma.checkIn.findFirst({
      where: {
        userId,
        date: { gte: today, lt: tomorrow },
      },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const checkIns = await prisma.checkIn.findMany({
      where: {
        userId,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'desc' },
    });

    let currentStreak = 0;
    if (checkIns.length > 0) {
      let checkDate = new Date(today);
      for (const ci of checkIns) {
        const ciDate = new Date(ci.date);
        ciDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((checkDate.getTime() - ciDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) {
          currentStreak++;
          checkDate = new Date(ciDate);
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const checkinDates = new Set(checkIns.map(c => c.date.toISOString().split('T')[0]));

    const history: { date: string; checkedIn: boolean }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      history.push({
        date: dateStr,
        checkedIn: checkinDates.has(dateStr),
      });
    }

    res.json({
      todayChecked: !!todayCheckin,
      streak: currentStreak,
      history,
    });
  } catch (error) {
    res.status(500).json({ error: '获取打卡状态失败' });
  }
});