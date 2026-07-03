import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, url } = req;

  _res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = _res;
    const logLine = `[${new Date().toISOString()}] ${method} ${url} ${statusCode} ${duration}ms`;
    if (statusCode >= 400) {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }
  });

  next();
}