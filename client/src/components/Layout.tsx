import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useProgressStore } from '../store/progress';
import { useMembershipStore } from '../store/membership';
import { BookOpen, Brain, LogOut, Home, Menu, X, Gamepad2, User, Star, GraduationCap } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/study-center', icon: BookOpen, label: '学习中心' },
  { to: '/english-games', icon: Gamepad2, label: '训练舱' },
  { to: '/membership', icon: Star, label: '会员' },
  { to: '/profile', icon: User, label: '个人中心' },
];

const mobileNavItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/study-center', icon: BookOpen, label: '学习中心' },
  { to: '/english-games', icon: Gamepad2, label: '训练舱' },
  { to: '/profile', icon: User, label: '我的' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { username, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { getLevel, getXPProgress, getLevelName, getStreakDays } = useProgressStore();
  const { tier, getTierName, getTierColor } = useMembershipStore();

  const isSubjectSelect = location.pathname === '/';
  const showBottomNav = !isSubjectSelect;

  const level = getLevel();
  const levelName = getLevelName();
  const xpPercent = getXPProgress();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderNavLink = (item: { to: string; icon: any; label: string }) => (
    <NavLink
      key={item.to + item.label}
      to={item.to}
      onClick={() => setMobileOpen(false)}
      className={({ isActive }) => clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all touch-target',
        isActive
          ? 'bg-[#00FF9C]/10 text-[#00FF9C]'
          : 'text-gray-400 hover:bg-[#1a1d24] hover:text-gray-200'
      )}
    >
      <item.icon size={20} className="shrink-0" />
      <span className="sidebar-label lg:opacity-100 lg:w-auto lg:ml-0">{item.label}</span>
    </NavLink>
  );

  const isActiveMembership = location.pathname === '/membership';

  return (
    <div className="min-h-screen bg-[#0D0F14] flex">
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-[#1a1d24] rounded-xl shadow-md border border-gray-700"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={24} className="text-gray-300" /> : <Menu size={24} className="text-gray-300" />}
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={clsx(
        'sidebar-group fixed md:sticky top-0 left-0 h-screen bg-[#0D0F14] border-r border-gray-800 z-40 flex flex-col shrink-0 transition-all duration-300',
        'w-64 md:w-16 lg:w-60',
        'md:hover:w-60 md:hover:shadow-xl',
        'transform',
        'md:transform-none',
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
      )}>
        <div className="p-4 lg:p-6 shrink-0">
          <h1 className="text-xl font-bold text-[#00FF9C] flex items-center gap-2">
            <Brain className="w-6 h-6 shrink-0" />
            <span className="sidebar-label lg:opacity-100 lg:w-auto">LexiStrike</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1 sidebar-label lg:opacity-100 lg:w-auto">
            考研 · 智能学习平台
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-20 md:pb-4">
          {navItems.map(renderNavLink)}
        </div>

        <div className="shrink-0 border-t border-gray-800 bg-[#0D0F14] px-3 py-3 z-10">
          <div className="flex items-center justify-between px-4 py-2 mt-1">
            <div className="text-sm min-w-0 flex-1 sidebar-label lg:opacity-100 lg:w-auto">
              <p className="font-medium text-gray-200 truncate flex items-center gap-1">
                {username}
                {tier !== 'free' && (
                  <Star size={12} className={clsx('shrink-0', tier === 'premium' ? 'text-purple-400' : 'text-yellow-400')} />
                )}
              </p>
              <p className="text-gray-500 text-xs">
                考研备考中
                <span className={clsx('ml-1', getTierColor())}>· {getTierName()}</span>
              </p>
            </div>
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-400 transition-colors shrink-0 rounded-lg hover:bg-[#1a1d24]" title="退出登录">
              <LogOut size={18} />
            </button>
          </div>
          <div className="px-4 mt-1">
            <p className="text-[10px] text-gray-600 sidebar-label lg:opacity-100 lg:w-auto">LexiStrike v1.0</p>
          </div>
        </div>
      </aside>

      <main className={clsx(
        'flex-1 p-4 md:p-8 pt-16 md:pt-8 max-w-5xl mx-auto w-full min-w-0',
        showBottomNav && 'pb-24 md:pb-8'
      )}>
        {children}
      </main>

      {showBottomNav && (
        <nav className="bottom-nav md:hidden bg-[#0D0F14] border-gray-800">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx(
                'nav-item',
                isActive && 'active'
              )}
            >
              <item.icon size={22} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }

        @media (min-width: 768px) {
          .sidebar-group .sidebar-label {
            opacity: 0;
            width: 0;
            margin-left: 0;
            overflow: hidden;
            transition: opacity 0.2s, width 0.2s, margin-left 0.2s;
            white-space: nowrap;
          }
          .sidebar-group:hover .sidebar-label {
            opacity: 1;
            width: auto;
            margin-left: 0;
          }
        }

        @media (min-width: 1024px) {
          .sidebar-group .sidebar-label {
            opacity: 1;
            width: auto;
            overflow: visible;
          }
          .sidebar-group:hover .sidebar-label {
            opacity: 1;
            width: auto;
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  );
}