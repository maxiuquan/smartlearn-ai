import { api } from './request';
import { SystemConfig, FeatureStatus, TestResult } from '@/types';

// 获取系统配置
export async function getSystemConfig(): Promise<SystemConfig> {
  return api.get<SystemConfig>('/system/config');
}

// 更新系统配置
export async function updateSystemConfig(data: Partial<SystemConfig>): Promise<SystemConfig> {
  return api.put<SystemConfig>('/system/config', data);
}

// 测试邮件配置
export async function testEmail(): Promise<TestResult> {
  return api.post<TestResult>('/system/test-email');
}

// 测试短信配置
export async function testSms(): Promise<TestResult> {
  return api.post<TestResult>('/system/test-sms');
}

// 获取系统日志
export async function getSystemLogs(params: {
  page?: number;
  page_size?: number;
  level?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
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
export async function backup(): Promise<{ taskId: string; message: string }> {
  return api.post('/system/backup');
}

// 获取备份列表
export async function getBackups(): Promise<{
  id: string;
  filename: string;
  size: number;
  createdAt: string;
}[]> {
  return api.get('/system/backups');
}

// 恢复数据库
export async function restore(backupId: string): Promise<{ taskId: string; message: string }> {
  return api.post(`/system/restore/${backupId}`);
}

// 获取功能状态
export async function getFeatureStatus(): Promise<Record<string, FeatureStatus>> {
  return api.get<Record<string, FeatureStatus>>('/system/features');
}
