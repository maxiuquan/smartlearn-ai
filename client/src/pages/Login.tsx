import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { api } from '../api/client';
import { Brain, Mail, Lock, User, BookOpen } from 'lucide-react';

const EXAM_TYPES = ['考研数学一', '考研数学二', '考研数学三'];

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('testuser');
  const [password, setPassword] = useState('123456');
  const [email, setEmail] = useState('');
  const [targetExam, setTargetExam] = useState('考研数学一');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await api.register({ username, email, password, targetExam });
        const result = await api.login(username, password);
        login({ ...result, examType: targetExam });
        navigate('/');
      } else {
        const result = await api.login(username, password);
        login(result);
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">智能学习平台</h1>
          <p className="text-gray-500 mt-2">考研数学 · 英语智能学习系统</p>
        </div>

        <div className="card">
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isRegister ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}
              onClick={() => setIsRegister(false)}
            >
              登录
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isRegister ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}
              onClick={() => setIsRegister(true)}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                className="input-field pl-10"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            {isRegister && (
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  className="input-field pl-10"
                  placeholder="邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            )}

            {isRegister && (
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <select
                  className="input-field pl-10 appearance-none"
                  value={targetExam}
                  onChange={(e) => setTargetExam(e.target.value)}
                >
                  {EXAM_TYPES.map((exam) => (
                    <option key={exam} value={exam}>{exam}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="password"
                className="input-field pl-10"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? '处理中...' : isRegister ? '注册' : '登录'}
            </button>
          </form>

          {!isRegister && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700 flex items-center gap-1">
                <BookOpen size={14} />
                测试账号：testuser / 123456
              </p>
            </div>
          )}

          {isRegister && (
            <p className="text-center text-sm text-gray-500 mt-4">
              已有账号？{' '}
              <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">
                立即登录
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}