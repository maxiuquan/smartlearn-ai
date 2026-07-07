import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { authApi, type UserInfo } from '../api/auth';

const TOKEN_KEY = 'smartlearn_token';
const REFRESH_TOKEN_KEY = 'smartlearn_refresh_token';

interface AuthContextValue {
  user: UserInfo | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  getToken: () => string | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * 应用启动时尝试从 localStorage 恢复登录态。
   * 如果 token 存在则调 /auth/me 获取用户信息；
   * 若 token 无效（401）则清除。
   */
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return;
    }

    setToken(storedToken);
    (async () => {
      try {
        const me = await authApi.getMe(storedToken);
        setUser(me);
      } catch {
        // token 无效或过期，清除
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /**
   * 登录：调 /auth/login 获取 token，存 localStorage，再调 /auth/me 获取用户信息。
   */
  const login = useCallback(async (username: string, password: string) => {
    const data = await authApi.login(username, password);
    localStorage.setItem(TOKEN_KEY, data.access_token);
    if (data.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }
    setToken(data.access_token);

    // 登录成功后获取用户信息
    const me = await authApi.getMe(data.access_token);
    setUser(me);
  }, []);

  /**
   * 退出登录：清除 localStorage + 重置状态。
   */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const getToken = useCallback(() => {
    return localStorage.getItem(TOKEN_KEY);
  }, []);

  /**
   * 重新获取用户信息（用于 Profile 页刷新）。
   */
  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
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
