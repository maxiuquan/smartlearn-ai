import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, BarChart3, Settings,
  CreditCard, LogOut, Shield
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const menuItems = [
  { path: '/admin/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { path: '/admin/users', icon: Users, label: '用户管理' },
  { path: '/admin/content', icon: BookOpen, label: '内容管理' },
  { path: '/admin/payments', icon: CreditCard, label: '支付管理' },
  { path: '/admin/analytics', icon: BarChart3, label: '数据分析' },
  { path: '/admin/settings', icon: Settings, label: '系统设置' },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex">
      <aside className="w-64 bg-[#12141A] border-r border-gray-800 flex flex-col fixed h-full">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Shield className="w-7 h-7 text-[#00FF9C]" />
            <div>
              <h1 className="text-white font-bold text-sm">LexiStrike</h1>
              <p className="text-[#00FF9C] text-xs">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;