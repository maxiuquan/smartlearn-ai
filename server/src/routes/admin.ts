import { Router, Request, Response } from 'express';

const router = Router();

const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'lexistrike2024',
};

const generateToken = () => {
  const payload = { role: 'admin', exp: Date.now() + 24 * 60 * 60 * 1000 };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

const verifyToken = (token: string): boolean => {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    return payload.role === 'admin' && payload.exp > Date.now();
  } catch {
    return false;
  }
};

const authMiddleware = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未授权' });
  }
  const token = authHeader.split(' ')[1];
  if (!verifyToken(token)) {
    return res.status(401).json({ message: '令牌无效或已过期' });
  }
  next();
};

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    const token = generateToken();
    res.json({ token, message: '登录成功' });
  } else {
    res.status(401).json({ message: '账号或密码错误' });
  }
});

router.get('/verify', authMiddleware, (_req: Request, res: Response) => {
  res.json({ valid: true });
});

router.get('/stats', authMiddleware, (_req: Request, res: Response) => {
  res.json({
    totalUsers: 1250,
    activeUsers: 342,
    totalRevenue: 15800,
    newUsersToday: 28,
    mathQuestions: 2500,
    englishWords: 5000,
    gamesPlayed: 8920,
    avgScore: 72,
  });
});

router.get('/users', authMiddleware, (_req: Request, res: Response) => {
  res.json([
    {
      id: '1', username: '张同学', email: 'zhang@example.com',
      role: 'user', isVip: true, createdAt: '2024-01-15',
      lastLoginAt: '2024-06-02', mathScore: 85, englishScore: 72,
    },
    {
      id: '2', username: '李同学', email: 'li@example.com',
      role: 'user', isVip: false, createdAt: '2024-03-20',
      lastLoginAt: '2024-06-01', mathScore: 60, englishScore: 55,
    },
    {
      id: '3', username: '王同学', email: 'wang@example.com',
      role: 'user', isVip: true, createdAt: '2024-02-10',
      lastLoginAt: '2024-06-02', mathScore: 92, englishScore: 88,
    },
  ]);
});

router.post('/users/:id/ban', authMiddleware, (req: Request, res: Response) => {
  res.json({ message: `用户 ${req.params.id} 已被封禁` });
});

export { router as adminRoutes };