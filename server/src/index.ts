import express from 'express';
import cors from 'cors';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import { securityHeaders } from './middleware/security';
import { knowledgeRoutes } from './routes/knowledge';
import { questionRoutes } from './routes/questions';
import { practiceRoutes } from './routes/practice';
import { englishRoutes } from './routes/english';
import { userRoutes } from './routes/user';
import { reviewRoutes } from './routes/review';
import { aiGuessRoutes } from './routes/ai-guess';
import { scaffoldRoutes } from './routes/scaffold';
import { studyPlanRoutes } from './routes/study-plan';
import { achievementRoutes } from './routes/achievements';
import { checkinRoutes } from './routes/checkin';
import { subjectRoutes } from './routes/subject';
import { englishGamesRoutes } from './routes/english-games';
import { englishPathRoutes } from './routes/english-path';
import { wordImportRoutes } from './routes/word-import';
import { stopPointRoutes } from './routes/stop-point';
import { mathBankRoutes } from './routes/math-bank';
import { englishBankRoutes } from './routes/english-bank';
import { adminRoutes } from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(securityHeaders);
app.use(requestLogger);
app.use(rateLimiter);

app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/english', englishRoutes);
app.use('/api/user', userRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/ai-guess', aiGuessRoutes);
app.use('/api/scaffold', scaffoldRoutes);
app.use('/api/study-plan', studyPlanRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/subject', subjectRoutes);
app.use('/api/english-games', englishGamesRoutes);
app.use('/api/english-path', englishPathRoutes);
app.use('/api/word-import', wordImportRoutes);
app.use('/api/stop-point', stopPointRoutes);
app.use('/api/math-bank', mathBankRoutes);
app.use('/api/english-bank', englishBankRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage().heapUsed,
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
});