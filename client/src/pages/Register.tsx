import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, Check, X, BookOpen } from 'lucide-react';
import { toast } from '../store/toast';

const PASSWORD_RULES = [
  { label: '至少8个字符', test: (v: string) => v.length >= 8 },
  { label: '包含大写字母', test: (v: string) => /[A-Z]/.test(v) },
  { label: '包含小写字母', test: (v: string) => /[a-z]/.test(v) },
  { label: '包含数字', test: (v: string) => /\d/.test(v) },
  { label: '包含特殊字符', test: (v: string) => /[!@#$%^&*]/.test(v) },
];

const EXAM_TYPES = ['考研数学一', '考研数学二', '考研数学三'];

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [targetExam, setTargetExam] = useState('考研数学一');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const passwordStrength = PASSWORD_RULES.filter(r => r.test(password)).length;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!username.trim()) newErrors.username = '请输入用户名';
    else if (username.length < 3) newErrors.username = '用户名至少3个字符';
    if (!email.trim()) newErrors.email = '请输入邮箱';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = '请输入有效的邮箱地址';
    if (!password) newErrors.password = '请输入密码';
    else if (passwordStrength < 3) newErrors.password = '密码强度不足';
    if (password !== confirmPassword) newErrors.confirmPassword = '两次密码不一致';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, targetExam }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '注册失败');
      toast.success('注册成功，请登录');
      navigate('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-200">
            <UserPlus className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">创建账号</h1>
          <p className="text-gray-500 mt-1">开始你的考研数学学习之旅</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                type="text"
                className={`input-field ${errors.username ? 'border-red-300 focus:ring-red-100' : ''}`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
              />
              {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                className={`input-field ${errors.email ? 'border-red-300 focus:ring-red-100' : ''}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">考试类型</label>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`input-field pr-10 ${errors.password ? 'border-red-300 focus:ring-red-100' : ''}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${i <= passwordStrength ? (passwordStrength <= 2 ? 'bg-red-400' : passwordStrength <= 3 ? 'bg-yellow-400' : 'bg-green-400') : 'bg-gray-200'}`}
                      />
                    ))}
                  </div>
                  {PASSWORD_RULES.map((rule) => (
                    <div key={rule.label} className="flex items-center gap-1.5 text-xs">
                      {rule.test(password) ? (
                        <Check size={12} className="text-green-500" />
                      ) : (
                        <X size={12} className="text-gray-300" />
                      )}
                      <span className={rule.test(password) ? 'text-green-600' : 'text-gray-400'}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
              <input
                type="password"
                className={`input-field ${errors.confirmPassword ? 'border-red-300 focus:ring-red-100' : ''}`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
              />
              {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  注册中...
                </div>
              ) : '注册'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          已有账号？{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">
            立即登录
          </Link>
        </p>
      </div>
    </div>
  );
}