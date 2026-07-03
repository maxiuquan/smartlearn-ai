import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { Send, Check, Download, X, Flame, Clock, BookOpen, Sparkles } from 'lucide-react';
import { toast } from '../store/toast';

interface StudyShareProps {
  onClose: () => void;
}

const MOTO_QUOTES = [
  '学如逆水行舟，不进则退',
  '千里之行，始于足下',
  '温故而知新，可以为师矣',
  '业精于勤，荒于嬉',
  '不积跬步，无以至千里',
  '书山有路勤为径，学海无涯苦作舟',
  '纸上得来终觉浅，绝知此事要躬行',
  '天行健，君子以自强不息',
];

export default function StudyShare({ onClose }: StudyShareProps) {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const todayMinutes = Math.floor((Number(localStorage.getItem('today_time_spent') || 0)) / 60);
  const todayQuestions = Number(localStorage.getItem('today_question_count') || 0);
  const todayCards = Number(localStorage.getItem('today_card_count') || 0);
  const streak = Number(localStorage.getItem('streak_days') || 0);
  const currentKp = localStorage.getItem('last_study_kp') || '知识探索';
  const quote = MOTO_QUOTES[Math.floor(Math.random() * MOTO_QUOTES.length)];

  const initials = (user?.username || '同学').slice(0, 2).toUpperCase();
  const todayDate = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

  const shareText = `📚 LexiStrike 学习卡\n\n👤 ${user?.username || '同学'}\n📅 ${todayDate}\n\n⏱ 今日学习 ${todayMinutes} 分钟\n📝 ${todayQuestions} 题 | 📇 ${todayCards} 个知识卡片\n🔥 连续学习 ${streak} 天\n\n🎯 正在攻克：${currentKp}\n\n💬 "${quote}"\n\n—— 来自 LexiStrike 智能学习平台`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success('学习卡已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleSave = () => {
    const blob = new Blob([shareText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LexiStrike学习卡_${todayDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('学习卡已保存');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Send size={20} className="text-primary-600" />
              学习卡
            </h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          <div className="bg-gradient-to-br from-primary-50 via-blue-50 to-purple-50 rounded-2xl p-6 border border-primary-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {initials}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{user?.username || '同学'}</p>
                  <p className="text-xs text-gray-500">{todayDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full">
                <Flame size={14} />
                <span className="text-sm font-bold">{streak}天</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-primary-600 mb-1">
                  <Clock size={14} />
                </div>
                <p className="text-lg font-bold text-gray-900">{todayMinutes}</p>
                <p className="text-xs text-gray-500">分钟</p>
              </div>
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                  <BookOpen size={14} />
                </div>
                <p className="text-lg font-bold text-gray-900">{todayQuestions}</p>
                <p className="text-xs text-gray-500">题</p>
              </div>
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
                  <Sparkles size={14} />
                </div>
                <p className="text-lg font-bold text-gray-900">{todayCards}</p>
                <p className="text-xs text-gray-500">卡片</p>
              </div>
            </div>

            <div className="bg-white/60 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">正在攻克</p>
              <p className="font-semibold text-gray-900">{currentKp}</p>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500 italic">"{quote}"</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleCopy}
              className="flex-1 btn-secondary flex items-center justify-center gap-2 py-2.5"
            >
              {copied ? <span className="text-green-600 text-sm font-medium">已复制 ✓</span> : (
                <>
                  <Check size={16} />
                  <span className="text-sm">分享到微信</span>
                </>
              )}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5"
            >
              <Download size={16} />
              <span className="text-sm">保存图片</span>
            </button>
          </div>

          <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs text-gray-400 leading-relaxed break-all">
              {shareText.split('\n').map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}