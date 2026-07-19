import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  // P0-01: 跨域请求携带 Cookie（用于 HttpOnly refresh_token）
  withCredentials: true,
});

// P0-01 (R4): access_token 纯内存存储 — 不再使用 localStorage
// Token 由 AuthContext 通过 setAccessToken() 注入
let _memoryAccessToken: string | null = null;

/** P0-01 (R4): AuthContext 调用此方法注入内存 token */
export function setAccessToken(token: string | null): void {
  _memoryAccessToken = token;
}

/** P0-01 (R4): 获取当前内存 token */
export function getAccessToken(): string | null {
  return _memoryAccessToken;
}

// ─── 请求拦截器：从内存读取 access_token 并注入 Authorization 头 ───
client.interceptors.request.use(
  (config) => {
    // P0-01 (R4): 从内存读取，不再使用 localStorage
    if (_memoryAccessToken) {
      config.headers.Authorization = `Bearer ${_memoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── P0-01 (R4): 响应拦截器 — 单飞 refresh + 请求队列 ───
// 全局 refreshPromise：首个 401 触发 refresh，其余并发请求 await 同一 Promise
let _refreshPromise: Promise<string | null> | null = null;

/**
 * P0-01 (R4): 单飞 refresh — 确保多个并发 401 只触发一次 refresh
 * 成功后重放所有排队请求，失败后只执行一次 logout
 */
async function _singleFlightRefresh(): Promise<string | null> {
  // 已有 refresh 进行中，复用同一 Promise
  if (_refreshPromise) {
    return _refreshPromise;
  }

  _refreshPromise = (async () => {
    try {
      const refreshRes = await axios.post(
        `${client.defaults.baseURL}/api/v1/auth/refresh`,
        {},
        { withCredentials: true }
      );
      const newToken = refreshRes.data.access_token;
      _memoryAccessToken = newToken;
      return newToken;
    } catch {
      // refresh 失败 — 清除内存 token
      _memoryAccessToken = null;
      return null;
    } finally {
      // 清除 promise 引用，允许后续 refresh
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;

    // 非 401 错误直接拒绝
    if (error?.response?.status !== 401) {
      return Promise.reject(error);
    }

    // P0-01 (R4): 避免对 /auth/refresh 和 /auth/login 本身的 401 重试（防止死循环）
    if (
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/login')
    ) {
      _memoryAccessToken = null;
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // P0-01 (R4): 单飞 refresh — 所有并发 401 共享同一个 refresh Promise
    const newToken = await _singleFlightRefresh();

    if (newToken) {
      // 重试原请求
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return client(originalRequest);
    }

    // refresh 失败，跳转登录
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── 游戏 API（新三段式 /api/v1/games/* 链路）───
// 旧 /word-games/* 链路已下线，由后端 API Service 统一返回 interaction_type。

// 开始游戏：POST /api/v1/games/{gameId}/sessions/start
export interface StartGameParams {
  gameId: string;
  difficulty?: string;
}

export async function startGame(params: StartGameParams) {
  const res = await client.post(
    `/api/v1/games/${params.gameId}/sessions/start`,
    {
      game_id: params.gameId,
      difficulty: params.difficulty,
    }
  );
  return res.data;
}

// 提交答案：POST /api/v1/games/{gameId}/sessions/{sessionId}/answers
export interface SubmitAnswerParams {
  gameId: string;
  sessionId: number;
  questionId: string;
  answer?: string;
  structuredAnswer?: Record<string, unknown>;
  sequence: number;
  idempotencyKey: string;
  timeSpentSeconds?: number;
}

export async function submitAnswer(params: SubmitAnswerParams) {
  const res = await client.post(
    `/api/v1/games/${params.gameId}/sessions/${params.sessionId}/answers`,
    {
      question_id: params.questionId,
      answer: params.answer,
      structured_answer: params.structuredAnswer,
      sequence: params.sequence,
      idempotency_key: params.idempotencyKey,
    }
  );
  return res.data;
}

// 结束游戏：POST /api/v1/games/{gameId}/sessions/{sessionId}/finish
export interface FinishGameParams {
  gameId: string;
  sessionId: number;
}

export async function finishGame(params: FinishGameParams) {
  const res = await client.post(
    `/api/v1/games/${params.gameId}/sessions/${params.sessionId}/finish`,
    {}
  );
  return res.data;
}

// 获取游戏总结：GET /api/v1/games/{gameId}/sessions/{sessionId}/summary
export async function getGameSummary(gameId: string, sessionId: number) {
  const res = await client.get(
    `/api/v1/games/${gameId}/sessions/${sessionId}/summary`
  );
  return res.data;
}

// 获取好友排行榜：GET /api/v1/games/leaderboards/friends
export async function getLeaderboard(limit = 10) {
  const res = await client.get('/api/v1/games/leaderboards/friends', {
    params: { limit },
  });
  return res.data;
}

/** P0-03 (R3): 检查支付功能是否可用（未配置凭证时后端返回 {enabled:false}） */
export async function checkPaymentEnabled(): Promise<boolean> {
  try {
    const res = await client.get('/api/v1/payments/status');
    return res.data?.enabled === true;
  } catch {
    return false;
  }
}

export default client;
