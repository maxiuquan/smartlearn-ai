import client from './client';

/** 登录响应 */
export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

/** 用户信息 */
export interface UserInfo {
  id: string;
  email: string;
  role: string;
  nickname: string;
  avatar?: string;
  vip_level?: string;
}

/** 注册请求参数 */
export interface RegisterParams {
  email: string;
  password: string;
  nickname?: string;
  phone?: string;
}

/**
 * 认证 API 封装层。
 * 所有方法直接使用 axios client 实例，请求拦截器会自动注入 Authorization。
 */
export const authApi = {
  /**
   * 登录：POST /api/v1/auth/login
   * 返回 access_token / refresh_token。
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await client.post('/api/v1/auth/login', { username, password });
    return res.data;
  },

  /**
   * 注册：POST /api/v1/auth/register
   */
  async register(params: RegisterParams): Promise<UserInfo> {
    const res = await client.post('/api/v1/auth/register', params);
    return res.data;
  },

  /**
   * 获取当前用户信息：GET /api/v1/auth/me
   * 支持传入 token（用于登录后立即获取用户信息，此时拦截器可能还未更新）。
   */
  async getMe(overrideToken?: string): Promise<UserInfo> {
    const headers = overrideToken
      ? { Authorization: `Bearer ${overrideToken}` }
      : undefined;
    const res = await client.get('/api/v1/auth/me', { headers });
    return res.data;
  },

  /**
   * P0-01: 刷新 access_token — POST /api/v1/auth/refresh
   * 浏览器自动携带 HttpOnly Cookie 中的 refresh_token，无需手动传参。
   * 后端返回新的 access_token，并 Set-Cookie 新的 refresh_token。
   */
  async refresh(): Promise<LoginResponse> {
    const res = await client.post('/api/v1/auth/refresh', {}, { withCredentials: true });
    return res.data;
  },

  /**
   * 退出登录：POST /api/v1/auth/logout
   * P0-01: 后端撤销 session + 清除 HttpOnly Cookie。
   */
  async logout(): Promise<void> {
    try {
      await client.post('/api/v1/auth/logout', {}, { withCredentials: true });
    } catch {
      // 即使后端 logout 失败也不影响前端清除
    }
  },
};
