import { format, differenceInDays, parseISO, addDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const formatDate = (date: Date | string, formatStr: string = 'yyyy-MM-dd'): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: zhCN });
};

export const getDaysUntil = (targetDate: Date | string): number => {
  const target = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate;
  return differenceInDays(target, new Date());
};

export const isOverdue = (dueDate: Date | string): boolean => {
  return getDaysUntil(dueDate) < 0;
};

export const getDateRange = (days: number): { start: Date; end: Date } => {
  const start = new Date();
  const end = addDays(start, days);
  return { start, end };
};

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
};

export const formatTimeAgo = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return formatDate(d);
};
