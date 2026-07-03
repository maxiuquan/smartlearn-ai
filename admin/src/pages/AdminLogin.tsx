import { useState } from 'react';
import { Shield } from 'lucide-react';

interface AdminLoginProps {
  onLogin: () => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('admin_token', data.token);
        onLogin();
      } else {
        setError(data.message || '登录失败');
      }
    } catch {
      setError('网络错误，请重试');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Shield className="w-12 h-12 text-[#00FF9C]" />
          </div>
          <h1 className="text-2xl font-bold text-white">管理员登录</h1>
          <p className="text-gray-500 mt-1">LexiStrike Global Admin</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          <input
            type="text"
            placeholder="管理员账号"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#12141A] border border-gray-700 text-white placeholder-gray-500 focus:border-[#00FF9C] focus:outline-none"
          />
          <input
            type="password"
            placeholder="管理员密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#12141A] border border-gray-700 text-white placeholder-gray-500 focus:border-[#00FF9C] focus:outline-none"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#00FF9C] text-black font-bold hover:bg-[#00CC7A] transition-colors"
          >
            登录
          </button>
        </form>
      </div>
    </div>
  );
}