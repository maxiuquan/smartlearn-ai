import { useState } from 'react';
import { CreditCard, Wallet, CheckCircle, XCircle, Clock, Download } from 'lucide-react';

interface Order {
  id: string;
  username: string;
  plan: string;
  amount: number;
  status: 'completed' | 'pending' | 'cancelled';
  createdAt: string;
}

export default function AdminPayments() {
  const [orders] = useState<Order[]>([
    { id: 'ORD001', username: '张同学', plan: 'VIP月卡', amount: 29.9, status: 'completed', createdAt: '2024-06-01' },
    { id: 'ORD002', username: '李同学', plan: 'VIP年卡', amount: 299, status: 'completed', createdAt: '2024-06-01' },
    { id: 'ORD003', username: '王同学', plan: 'VIP季卡', amount: 79.9, status: 'pending', createdAt: '2024-06-02' },
    { id: 'ORD004', username: '赵同学', plan: 'VIP月卡', amount: 29.9, status: 'cancelled', createdAt: '2024-06-02' },
    { id: 'ORD005', username: '刘同学', plan: '题库解锁', amount: 19.9, status: 'completed', createdAt: '2024-06-03' },
  ]);

  const statusConfig = {
    completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: '已支付' },
    pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: '待支付' },
    cancelled: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: '已取消' },
  };

  const totalRevenue = orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">支付管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理所有订单和支付</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#12141A] border border-gray-700 text-gray-400 text-sm hover:text-white">
          <Download className="w-4 h-4" /> 导出报表
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-4">
          <CreditCard className="w-5 h-5 text-[#FFD700] mb-2" />
          <div className="text-xl font-bold text-white">¥{totalRevenue.toFixed(0)}</div>
          <div className="text-gray-500 text-xs">总收入</div>
        </div>
        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-green-400 mb-2" />
          <div className="text-xl font-bold text-white">{orders.filter(o => o.status === 'completed').length}</div>
          <div className="text-gray-500 text-xs">已完成订单</div>
        </div>
        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-4">
          <Clock className="w-5 h-5 text-yellow-400 mb-2" />
          <div className="text-xl font-bold text-white">{orders.filter(o => o.status === 'pending').length}</div>
          <div className="text-gray-500 text-xs">待处理</div>
        </div>
        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-4">
          <Wallet className="w-5 h-5 text-blue-400 mb-2" />
          <div className="text-xl font-bold text-white">¥{(totalRevenue * 0.7).toFixed(0)}</div>
          <div className="text-gray-500 text-xs">可提现</div>
        </div>
      </div>

      <div className="bg-[#12141A] border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left p-4 text-gray-500 text-xs font-medium">订单号</th>
              <th className="text-left p-4 text-gray-500 text-xs font-medium">用户</th>
              <th className="text-left p-4 text-gray-500 text-xs font-medium">方案</th>
              <th className="text-left p-4 text-gray-500 text-xs font-medium">金额</th>
              <th className="text-left p-4 text-gray-500 text-xs font-medium">状态</th>
              <th className="text-left p-4 text-gray-500 text-xs font-medium">时间</th>
              <th className="text-left p-4 text-gray-500 text-xs font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const status = statusConfig[order.status];
              const StatusIcon = status.icon;
              return (
                <tr key={order.id} className="border-b border-gray-800/50 hover:bg-white/5">
                  <td className="p-4 text-white text-sm font-mono">{order.id}</td>
                  <td className="p-4 text-white text-sm">{order.username}</td>
                  <td className="p-4 text-gray-300 text-sm">{order.plan}</td>
                  <td className="p-4 text-white font-bold text-sm">¥{order.amount}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${status.color} ${status.bg}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-xs">{order.createdAt}</td>
                  <td className="p-4">
                    <button className="px-3 py-1.5 rounded-lg text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
                      查看详情
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}