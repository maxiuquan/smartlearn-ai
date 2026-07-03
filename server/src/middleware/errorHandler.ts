import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational: boolean = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    });
  }

  console.error('[UNHANDLED ERROR]', err);

  return res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : err.message || '服务器内部错误',
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: '接口不存在' });
}