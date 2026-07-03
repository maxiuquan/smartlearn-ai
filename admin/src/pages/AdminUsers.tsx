import { useState, useEffect } from 'react';
import { Search, Ban, CheckCircle, Mail, Crown } from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  isVip: boolean;
  createdAt: string;
  lastLoginAt: string;
  mathScore: number;
  englishScore: number;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
    }).then(r => r.json()).then(setUsers).catch(() => {});
  }, []);

  const filtered = users.filter(u => {
    if (filter === 'vip' && !u.isVip) return false;
    if (filter === 'normal' && u.isVip) return false;
    if (search && !u.username.includes(search) && !u.email.includes(search)) return false;
    return true;
  });

  const handleBanUser = async (id: string) => {
    await fetch(`/api/admin/users/${id}/ban`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
    });
    setUsers(users.filter(u => u.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">用户管理</h1>
          <p className="text-gray-500 text-sm mt-1">共 {users.length} 个用户</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="搜索用户名或邮箱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#12141A] border border-gray-700 text-white placeholder-gray-500 focus:border-[#00FF9C] focus:outline-none text-sm"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-[#12141A] border border-gray-700 text-white text-sm focus:border-[#00FF9C] focus:outline-none"
        >
          <option value="all">全部用户</option>
          <option value="vip">VIP用户</option>
          <option value="normal">普通用户</option>
        </select>
      </div>

      <div className="bg-[#12141A] border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left p-4 text-gray-500 text-xs font-medium">用户</th>
              <th className="text-left p-4 text-gray-500 text-xs font-medium">角色</th>
              <th className="text-left p-4 text-gray-500 text-xs font-medium">数学分</th>
              <th className="text-left p-4 text-gray-500 text-xs font-medium">英语分</th>
              <th className="text-left p-4 text-gray-500 text-xs font-medium">注册时间</th>
              <th className="text-left p-4 text-gray-500 text-xs font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b border-gray-800/50 hover:bg-white/5">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300">
                      {user.username[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm">{user.username}</span>
                        {user.isVip && <Crown className="w-3.5 h-3.5 text-yellow-500" />}
                      </div>
                      <span className="text-gray-600 text-xs">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {user.role === 'admin' ? '管理员' : '用户'}
                  </span>
                </td>
                <td className="p-4 text-white text-sm">{user.mathScore}</td>
                <td className="p-4 text-white text-sm">{user.englishScore}</td>
                <td className="p-4 text-gray-500 text-xs">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button className="p-2 rounded-lg hover:bg-green-500/10 text-green-400" title="发送消息">
                      <Mail className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleBanUser(user.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400" title="封禁用户">
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}