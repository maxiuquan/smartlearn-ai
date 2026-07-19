import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/auth';

/**
 * 登录页面。
 * 用户名/密码表单，提交调 auth.login()，成功后导航到 dashboard（或来源页面）。
 * 同时提供注册入口。
 */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = (location.state as { from?: string } | null)?.from || '/dashboard';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'login') {
      if (!username.trim() || !password.trim()) {
        setError('请输入用户名和密码');
        return;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError('请输入邮箱和密码');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
        navigate(from, { replace: true });
      } else {
        // 注册后自动登录
        await authApi.register({
          email: email.trim(),
          password,
          nickname: nickname.trim() || undefined,
        });
        // 注册成功后用 email 作为用户名登录
        await login(email.trim(), password);
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        (mode === 'login' ? '登录失败，请检查用户名和密码' : '注册失败，请稍后重试')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-3xl font-bold text-gray-800">SmartLearn AI</h1>
          <p className="text-gray-500 mt-2">智能学习平台 · 学生端</p>
        </div>

        {/* 表单卡片 */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {/* 模式切换 */}
          <div className="flex gap-2 mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all
                ${mode === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
            >
              登录
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all
                ${mode === 'register' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'login' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    用户名
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg
                      focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100
                      transition-colors"
                    placeholder="请输入用户名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    密码
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg
                      focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100
                      transition-colors"
                    placeholder="请输入密码"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    邮箱
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg
                      focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100
                      transition-colors"
                    placeholder="请输入邮箱"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    昵称 <span className="text-gray-400 text-xs">（选填）</span>
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg
                      focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100
                      transition-colors"
                    placeholder="请输入昵称"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    密码
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg
                      focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100
                      transition-colors"
                    placeholder="请设置密码"
                  />
                </div>
              </>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium
                hover:bg-blue-600 transition-colors disabled:opacity-50
                disabled:cursor-not-allowed shadow-md shadow-blue-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'login' ? '登录中...' : '注册中...'}
                </span>
              ) : (
                mode === 'login' ? '登 录' : '注 册'
              )}
            </button>
          </form>

          {/* 返回首页 */}
          <div className="mt-6 text-center">
            <Link to="/games" className="text-sm text-gray-400 hover:text-blue-500 transition-colors">
              ← 直接进入游戏大厅
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
