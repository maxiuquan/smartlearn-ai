import { useState } from 'react';
import { TrendingUp, Users, Clock, Target, Download } from 'lucide-react';

export default function AdminAnalytics() {
  const [period, setPeriod] = useState('7d');

  const stats = [
    { label: '日活用户', value: 342, change: '+12%', icon: Users, color: '#00FF9C' },
    { label: '平均学习时长', value: '48分钟', change: '+5%', icon: Clock, color: '#0066FF' },
    { label: '题目完成率', value: '76%', change: '+3%', icon: Target, color: '#FFD700' },
    { label: '付费转化率', value: '8.5%', change: '+1.2%', icon: TrendingUp, color: '#FF4757' },
  ];

  const dailyData = [
    { date: '周一', users: 280, questions: 1250, revenue: 320 },
    { date: '周二', users: 310, questions: 1380, revenue: 450 },
    { date: '周三', users: 350, questions: 1420, revenue: 380 },
    { date: '周四', users: 330, questions: 1560, revenue: 520 },
    { date: '周五', users: 380, questions: 1680, revenue: 610 },
    { date: '周六', users: 420, questions: 1920, revenue: 780 },
    { date: '周日', users: 390, questions: 1750, revenue: 650 },
  ];

  const maxVal = Math.max(...dailyData.map(d => d.users));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">数据分析</h1>
          <p className="text-gray-500 text-sm mt-1">平台数据趋势分析</p>
        </div>
        <div className="flex gap-2">
          {['7d', '30d', '90d', '1y'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                period === p ? 'bg-[#00FF9C]/10 text-[#00FF9C]' : 'text-gray-500 hover:text-white'
              }`}
            >
              {p === '7d' ? '7天' : p === '30d' ? '30天' : p === '90d' ? '90天' : '1年'}
            </button>
          ))}
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#12141A] border border-gray-700 text-gray-400 text-sm hover:text-white">
            <Download className="w-4 h-4" /> 导出
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-[#12141A] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-5 h-5" style={{ color: stat.color }} />
                <span className="text-xs text-green-400">{stat.change}</span>
              </div>
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-gray-500 text-xs mt-1">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-[#12141A] border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">用户活跃趋势</h3>
          <div className="h-64 flex items-end gap-4">
            {dailyData.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs text-gray-500">{d.users}</span>
                <div
                  className="w-full bg-[#00FF9C]/30 rounded-t-lg hover:bg-[#00FF9C]/50 transition-colors"
                  style={{ height: `${(d.users / maxVal) * 200}px` }}
                />
                <span className="text-xs text-gray-600">{d.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">收入趋势</h3>
          <div className="space-y-3">
            {dailyData.map((d) => (
              <div key={d.date} className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">{d.date}</span>
                <div className="flex-1 mx-3">
                  <div className="h-2 bg-gray-800 rounded-full">
                    <div
                      className="h-full bg-[#FFD700] rounded-full"
                      style={{ width: `${(d.revenue / 780) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-white text-xs font-bold">¥{d.revenue}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}