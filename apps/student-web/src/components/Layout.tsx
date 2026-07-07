import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** 导航项配置 */
const NAV_ITEMS = [
  { path: '/dashboard', label: '仪表盘', emoji: '📊' },
  { path: '/vocab', label: '词汇学习', emoji: '📖' },
  { path: '/practice', label: '题库练习', emoji: '✏️' },
  { path: '/exam', label: '真题模拟', emoji: '📝' },
  { path: '/ai-tutor', label: 'AI 辅导', emoji: '🤖' },
  { path: '/games', label: '游戏大厅', emoji: '🎮' },
  { path: '/profile', label: '个人中心', emoji: '👤' },
];

/**
 * 全局导航布局组件。
 * 顶部导航栏：Logo + 功能入口 + 用户头像/退出。
 * 所有受保护页面共享此布局。
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2 flex-shrink-0">
              <span className="text-2xl">🎓</span>
              <span className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors hidden sm:inline">
                SmartLearn AI
              </span>
            </Link>

            {/* 桌面端导航 */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <span className="mr-1">{item.emoji}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* 用户区域 */}
            <div className="flex items-center gap-3">
              {user && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white text-sm font-bold">
                    {user.nickname?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm text-gray-600">{user.nickname || '同学'}</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors px-2 py-1"
                title="退出登录"
              >
                退出
              </button>
              {/* 移动端菜单按钮 */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                aria-label="菜单"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                </svg>
              </button>
            </div>
          </div>

          {/* 移动端展开菜单 */}
          {mobileMenuOpen && (
            <nav className="md:hidden pb-3 flex flex-wrap gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all
                      ${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <span className="mr-1">{item.emoji}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      {/* 内容区 */}
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
