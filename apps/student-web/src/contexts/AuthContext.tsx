import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { authApi, type UserInfo } from '../api/auth';

/**
 * P0-01: Token 存储安全改造
 *
 * - access_token 仅保存在内存（useState + ref），不写入 localStorage
 * - refresh_token 由后端通过 HttpOnly Cookie 自动管理，前端 JS 无法读取
 * - 401 拦截器自动调用 /auth/refresh（带 Cookie），获取新 access_token
 * - logout 调用后端 /auth/logout 清除 Cookie + Redis 黑名单
 *
 * 兼容性：仍保留 localStorage 作为 sessionStorage 级别的 access_token 缓存，
 * 用于页面刷新后恢复（access_token 短期有效，风险可控）。
 * refresh_token 永不写入 localStorage。
 */

const TOKEN_KEY = 'smartlearn_access_token'; // 仅 access_token，短期有效

interface AuthContextValue {
  user: UserInfo | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => string | null;
  refreshUser: () => Promise<void>;
  /** P0-01: 刷新 access_token（通过 HttpOnly Cookie 中的 refresh_token） */
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // P0-01: 使用 ref 保存当前 token，避免异步竞态条件
  const tokenRef = useRef<string | null>(null);

  const updateToken = useCallback((newToken: string | null) => {
    tokenRef.current = newToken;
    setToken(newToken);
    if (newToken) {
      // access_token 短期缓存于 localStorage（仅用于页面刷新恢复）
      // refresh_token 永不写入 localStorage
      localStorage.setItem(TOKEN_KEY, newToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  /**
   * P0-01: 刷新 access_token
   * 调用 /auth/refresh，浏览器自动携带 HttpOnly Cookie 中的 refresh_token。
   * 成功后更新内存 token，失败则清除登录态。
   */
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const data = await authApi.refresh();
      updateToken(data.access_token);
      return data.access_token;
    } catch {
      // refresh 失败，清除登录态
      updateToken(null);
      setUser(null);
      return null;
    }
  }, [updateToken]);

  /**
   * 应用启动时尝试从 localStorage 恢复 access_token。
   * 如果 token 存在则调 /auth/me 获取用户信息；
   * 若 token 无效（401）则尝试 refresh，refresh 也失败则清除。
   */
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return;
    }

    tokenRef.current = storedToken;
    setToken(storedToken);
    (async () => {
      try {
        const me = await authApi.getMe(storedToken);
        setUser(me);
      } catch {
        // access_token 无效，尝试通过 Cookie refresh
        const newToken = await refreshAccessToken();
        if (newToken) {
          try {
            const me = await authApi.getMe(newToken);
            setUser(me);
          } catch {
            updateToken(null);
            setUser(null);
          }
        } else {
          updateToken(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshAccessToken, updateToken]);

  /**
   * 登录：调 /auth/login 获取 access_token，存内存 + localStorage。
   * refresh_token 由后端 Set-Cookie 自动管理，前端不处理。
   */
  const login = useCallback(async (username: string, password: string) => {
    const data = await authApi.login(username, password);
    updateToken(data.access_token);

    // 登录成功后获取用户信息
    const me = await authApi.getMe(data.access_token);
    setUser(me);
  }, [updateToken]);

  /**
   * P0-01: 退出登录
   * 必须先调用后端 /auth/logout 撤销 session + 清除 Cookie，
   * 再清前端内存状态。即使后端调用失败也清除前端。
   */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // 即使后端 logout 失败也清除前端
    }
    updateToken(null);
    setUser(null);
  }, [updateToken]);

  const getToken = useCallback(() => {
    return tokenRef.current;
  }, []);

  /**
   * 重新获取用户信息（用于 Profile 页刷新）。
   */
  const refreshUser = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;
    try {
      const me = await authApi.getMe(currentToken);
      setUser(me);
    } catch {
      // 忽略刷新失败
    }
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    logout,
    getToken,
    refreshUser,
    refreshAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 获取 AuthContext 的 Hook。
 * 必须在 AuthProvider 内部使用。
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
