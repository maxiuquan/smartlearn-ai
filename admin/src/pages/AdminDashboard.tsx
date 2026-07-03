import { useState, useEffect } from 'react';
import { Users, TrendingUp, BookOpen, Coins, Calendar, ArrowUp } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  newUsersToday: number;
  mathQuestions: number;
  englishWords: number;
  gamesPlayed: number;
  avgScore: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0, activeUsers: 0, totalRevenue: 0, newUsersToday: 0,
    mathQuestions: 0, englishWords: 0, gamesPlayed: 0, avgScore: 0,
  });

  useEffect(() => {
    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
    }).then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const cards = [
    { label: '总用户数', value: stats.totalUsers.toLocaleString(), icon: Users, color: '#00FF9C', change: `+${stats.newUsersToday} 今日` },
    { label: '活跃用户', value: stats.activeUsers.toLocaleString(), icon: TrendingUp, color: '#0066FF', change: '近7天' },
    { label: '总收入', value: `¥${stats.totalRevenue.toLocaleString()}`, icon: Coins, color: '#FFD700', change: '累计' },
    { label: '题目总量', value: (stats.mathQuestions + stats.englishWords).toLocaleString(), icon: BookOpen, color: '#FF4757', change: `${stats.mathQuestions}数学 + ${stats.englishWords}英语` },
    { label: '游戏次数', value: stats.gamesPlayed.toLocaleString(), icon: Calendar, color: '#9B59B6', change: '累计' },
    { label: '平均分', value: stats.avgScore.toFixed(0), icon: ArrowUp, color: '#00CC7A', change: '满分100' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">仪表盘</h1>
        <p className="text-gray-500 text-sm mt-1">平台运营数据概览</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-[#12141A] border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-500 text-sm">{card.label}</span>
                <Icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
              <div className="text-xs text-gray-600 mt-1">{card.change}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">最近注册用户</h3>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300">
                    U{i}
                  </div>
                  <div>
                    <p className="text-white text-sm">用户 {i}</p>
                    <p className="text-gray-600 text-xs">user{i}@example.com</p>
                  </div>
                </div>
                <span className="text-gray-500 text-xs">刚刚</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">最近订单</h3>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800/50">
                <div>
                  <p className="text-white text-sm">VIP会员 {i}个月</p>
                  <p className="text-gray-600 text-xs">用户 {i}</p>
                </div>
                <span className="text-[#FFD700] text-sm font-bold">¥{i * 29.9}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}