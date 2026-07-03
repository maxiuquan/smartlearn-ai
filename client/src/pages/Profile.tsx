import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { api } from '../api/client';
import { toast } from '../store/toast';
import { User, Mail, Shield, Key, Save, LogOut, BookOpen, Calendar, Award, Star } from 'lucide-react';

const EXAM_TYPES = ['考研数学一', '考研数学二', '考研数学三'];

export default function Profile() {
  const { user, logout, examType, setExamType } = useAuthStore();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedExam, setSelectedExam] = useState(examType || '考研数学一');
  const [checkinDays, setCheckinDays] = useState(0);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [todayCheckedIn, setTodayCheckedIn] = useState(false);
  const [achievements, setAchievements] = useState<{ id: number; name: string; description: string; icon: string; unlockedAt: string | null }[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadCheckInStatus();
      loadAchievements();
    }
  }, [user?.id]);

  const loadCheckInStatus = async () => {
    try {
      const data = await api.getCheckInStatus(user!.id) as { streak: number; todayCheckedIn: boolean };
      setCheckinDays(data.streak || 0);
      setTodayCheckedIn(data.todayCheckedIn || false);
    } catch {
    }
  };

  const loadAchievements = async () => {
    try {
      const data = await api.getUserAchievements(user!.id) as { achievements: { id: number; name: string; description: string; icon: string; unlockedAt: string | null }[] };
      setAchievements(data.achievements || []);
    } catch {
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, username, email }),
      });
      if (!res.ok) throw new Error('保存失败');
      toast.success('个人信息已更新');
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.warning('请填写完整信息');
      return;
    }
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '修改失败');
      }
      toast.success('密码已修改');
      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '修改失败');
    }
  };

  const handleExamTypeChange = async (newExam: string) => {
    setSelectedExam(newExam);
    setExamType(newExam);
    try {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, targetExam: newExam }),
      });
      toast.success('考试类型已更新');
    } catch {
      toast.error('更新考试类型失败');
    }
  };

  const handleCheckIn = async () => {
    if (todayCheckedIn) {
      toast.info('今日已打卡');
      return;
    }
    setCheckinLoading(true);
    try {
      const data = await api.checkIn(user!.id) as { streak: number };
      setCheckinDays(data.streak || checkinDays + 1);
      setTodayCheckedIn(true);
      toast.success(`打卡成功！已连续 ${data.streak || checkinDays + 1} 天`);
    } catch {
      toast.error('打卡失败，请重试');
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.info('已退出登录');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <User className="text-primary-600" />
        个人中心
      </h1>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User size={18} />
          基本信息
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">用户名</label>
            <input
              type="text"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">邮箱</label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button onClick={handleSaveProfile} disabled={saving} className="btn-primary">
            <Save size={16} className="mr-1" />
            {saving ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BookOpen size={18} />
          考试类型
        </h2>
        <div className="relative">
          <select
            className="input-field appearance-none"
            value={selectedExam}
            onChange={(e) => handleExamTypeChange(e.target.value)}
          >
            {EXAM_TYPES.map((exam) => (
              <option key={exam} value={exam}>{exam}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar size={18} />
          每日打卡
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-primary-600">{checkinDays}</p>
            <p className="text-sm text-gray-500">连续打卡天数</p>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={checkinLoading || todayCheckedIn}
            className={todayCheckedIn ? 'btn-secondary' : 'btn-primary'}
          >
            {checkinLoading ? '打卡中...' : todayCheckedIn ? '今日已打卡' : '签到打卡'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Award size={18} />
          成就
        </h2>
        {achievements.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">暂无成就，继续加油！</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-3 rounded-xl border text-center transition-all ${achievement.unlockedAt ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200 opacity-50'}`}
              >
                <div className="text-2xl mb-1">{achievement.icon || <Star size={24} className="mx-auto text-gray-400" />}</div>
                <p className="text-sm font-medium text-gray-800">{achievement.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{achievement.description}</p>
                {achievement.unlockedAt && (
                  <p className="text-xs text-yellow-600 mt-1">
                    {new Date(achievement.unlockedAt).toLocaleDateString('zh-CN')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <button
          onClick={() => setShowPasswordForm(!showPasswordForm)}
          className="w-full flex items-center justify-between"
        >
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Key size={18} />
            修改密码
          </h2>
          <Shield size={18} className={`text-gray-400 transition-transform ${showPasswordForm ? 'rotate-180' : ''}`} />
        </button>

        {showPasswordForm && (
          <div className="mt-4 space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">当前密码</label>
              <input
                type="password"
                className="input-field"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">新密码</label>
              <input
                type="password"
                className="input-field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <button onClick={handleChangePassword} className="btn-primary">确认修改</button>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Mail size={18} />
          账号信息
        </h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p>注册时间：{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '未知'}</p>
          <p>用户ID：{user?.id}</p>
        </div>
      </div>

      <button onClick={handleLogout} className="btn-danger w-full flex items-center justify-center gap-2">
        <LogOut size={16} />
        退出登录
      </button>
    </div>
  );
}