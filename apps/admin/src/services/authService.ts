import { api } from './request';
import { User, LoginParams, PaginatedResponse } from '@/types';

// 后端 TokenResponse 结构（FastAPI 直接返回，无 user 字段）
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// 登录：返回 token，user 需另外调用 getCurrentUser 获取
export async function login(params: LoginParams): Promise<TokenResponse> {
  return api.post<TokenResponse>('/auth/login', params);
}

// 获取当前用户信息
export async function getCurrentUser(): Promise<User> {
  return api.get<User>('/auth/me');
}

// 退出登录（即使失败也清本地）
export async function logout(): Promise<void> {
  try {
    await api.post<void>('/auth/logout');
  } catch (error) {
    // 即使请求失败也不抛出，调用方仍可清理本地状态
  }
}

// 修改密码
export async function changePassword(params: { old_password: string; new_password: string }): Promise<void> {
  return api.post<void>('/auth/change-password', params);
}

// 刷新 Token
export async function refreshToken(): Promise<TokenResponse> {
  return api.post<TokenResponse>('/auth/refresh');
}
