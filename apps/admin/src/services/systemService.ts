import { api } from './request';
import { SystemConfig } from '@/types';

// 获取系统配置
export async function getSystemConfig(): Promise<SystemConfig> {
  return api.get<SystemConfig>('/system/config');
}

// 更新系统配置
export async function updateSystemConfig(data: Partial<SystemConfig>): Promise<SystemConfig> {
  return api.put<SystemConfig>('/system/config', data);
}

// 测试邮件配置
export async function testEmailConfig(email: string): Promise<{ success: boolean; message: string }> {
  return api.post('/system/test-email', { email });
}

// 测试短信配置
export async function testSmsConfig(phone: string): Promise<{ success: boolean; message: string }> {
  return api.post('/system/test-sms', { phone });
}

// 获取系统日志
export async function getSystemLogs(params: {
  page?: number;
  pageSize?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  list: {
    id: string;
    type: string;
    content: string;
    operator: string;
    createdAt: string;
  }[];
  total: number;
}> {
  return api.get('/system/logs', { params });
}

// 清理系统缓存
export async function clearCache(): Promise<void> {
  return api.post('/system/clear-cache');
}

// 获取系统信息
export async function getSystemInfo(): Promise<{
  version: string;
  uptime: number;
  memory: { used: number; total: number };
  cpu: number;
  database: { type: string; version: string };
}> {
  return api.get('/system/info');
}

// 备份数据库
export async function backupDatabase(): Promise<{ taskId: string; message: string }> {
  return api.post('/system/backup');
}

// 获取备份列表
export async function getBackupList(): Promise<{
  id: string;
  filename: string;
  size: number;
  createdAt: string;
}[]> {
  return api.get('/system/backups');
}

// 恢复数据库
export async function restoreDatabase(backupId: string): Promise<{ taskId: string; message: string }> {
  return api.post(`/system/restore/${backupId}`);
}
