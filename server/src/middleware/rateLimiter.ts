import { Request, Response, NextFunction } from 'express';

const requestCounts = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 200;

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  if (entry.count >= MAX_REQUESTS) {
    return res.status(429).json({
      error: '请求过于频繁，请稍后再试',
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    });
  }

  entry.count++;
  return next();
}