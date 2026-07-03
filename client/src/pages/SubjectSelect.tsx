import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';
import {
  FunctionSquare, Languages, ChevronRight, CheckCircle,
  Sparkles, Brain, Target, BarChart3, BookOpen, LineChart,
  Lightbulb, Clock, Zap, Star, Gamepad2, BookMarked
} from 'lucide-react';

interface Subject {
  id: string;
  name: string;
  icon: React.ReactNode;
  desc: string;
  features: { text: string; icon: React.ReactNode }[];
  color: string;
  bgGradient: string;
  borderColor: string;
  tagColor: string;
}

const SUBJECTS: Subject[] = [
  {
    id: 'math',
    name: '数学',
    icon: <FunctionSquare size={40} />,
    desc: '考研数学系统训练',
    features: [
      { text: '智能诊断 - AI精准定位薄弱环节', icon: <Target size={14} /> },
      { text: '知识图谱 - 可视化知识点关联网络', icon: <BookOpen size={14} /> },
      { text: '真题模拟 - 历年真题全覆盖训练', icon: <BarChart3 size={14} /> },
      { text: '错题分析 - 智能归因、精准推题', icon: <Lightbulb size={14} /> },
      { text: '小黄点复习 - 基于遗忘曲线科学复习', icon: <Clock size={14} /> },
    ],
    color: 'from-blue-500 to-indigo-600',
    bgGradient: 'from-blue-50 via-indigo-50 to-white',
    borderColor: 'border-blue-200 hover:border-blue-400',
    tagColor: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'english',
    name: '英语',
    icon: <Languages size={40} />,
    desc: '英语实战训练舱 · 游戏化攻克考研/四六级',
    features: [
      { text: '趣味单词游戏 - 消消乐/拼图/速拼', icon: <Gamepad2 size={14} /> },
      { text: '智能分级 - 根据水平自动调整难度', icon: <Brain size={14} /> },
      { text: '阅读训练 - AI生成个性化文章', icon: <BookMarked size={14} /> },
      { text: '学习路径 - 系统化单词记忆曲线', icon: <LineChart size={14} /> },
      { text: '正反馈激励 - 成就系统、连续打卡', icon: <Star size={14} /> },
    ],
    color: 'from-purple-500 to-pink-600',
    bgGradient: 'from-purple-50 via-pink-50 to-white',
    borderColor: 'border-purple-200 hover:border-purple-400',
    tagColor: 'bg-purple-100 text-purple-600',
  },
];

export default function SubjectSelect() {
  const navigate = useNavigate();
  const { userId } = useAuthStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelect = async (subjectId: string) => {
    if (loading) return;
    setSelected(subjectId);
    setLoading(true);
    try {
      await fetch('/api/subject/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subject: subjectId }),
      });
      if (subjectId === 'math') {
        navigate('/math-home');
      } else {
        navigate('/english-home');
      }
    } catch {
      toast.error('选择失败，请重试');
      setLoading(false);
      setSelected(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl animate-fade-in">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">LexiVerse 选择训练科目</h1>
          <p className="text-gray-500 text-lg">开启你的个性化学习之旅</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {SUBJECTS.map((subject) => (
            <button
              key={subject.id}
              onClick={() => handleSelect(subject.id)}
              disabled={loading}
              className={`group relative overflow-hidden rounded-2xl border-2 p-8 text-left transition-all duration-500
                ${subject.borderColor}
                bg-gradient-to-br ${subject.bgGradient}
                hover:shadow-xl hover:-translate-y-1
                ${selected === subject.id ? 'ring-4 ring-opacity-50 scale-[1.02]' : ''}
                ${selected === subject.id && subject.id === 'math' ? 'ring-blue-300' : ''}
                ${selected === subject.id && subject.id === 'english' ? 'ring-purple-300' : ''}
                disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md`}
            >
              {selected === subject.id && (
                <div className="absolute top-4 right-4 animate-scale-in">
                  <CheckCircle className={`${subject.id === 'math' ? 'text-blue-500' : 'text-purple-500'}`} size={24} />
                </div>
              )}

              <div className="flex items-center gap-4 mb-5">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${subject.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  {subject.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{subject.name}</h2>
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${subject.tagColor}`}>
                    考研{subject.name}
                  </span>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-6 leading-relaxed">{subject.desc}</p>

              <div className="space-y-2.5">
                {subject.features.map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 text-sm text-gray-600 group-hover:text-gray-700 transition-colors"
                    style={{ transitionDelay: `${i * 50}ms` }}
                  >
                    <span className={`${subject.id === 'math' ? 'text-blue-500' : 'text-purple-500'} shrink-0`}>
                      {feature.icon}
                    </span>
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>

              <div className={`mt-6 flex items-center gap-1 text-sm font-medium ${subject.id === 'math' ? 'text-blue-600' : 'text-purple-600'} opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-1`}>
                开始学习 <ChevronRight size={16} />
              </div>

              <div className={`absolute -bottom-6 -right-6 w-32 h-32 rounded-full opacity-5 bg-gradient-to-br ${subject.color} group-hover:scale-150 transition-transform duration-700`} />
            </button>
          ))}
        </div>

        <p className="text-center text-gray-400 text-xs mt-8">
          选择后可在设置中切换科目
        </p>
      </div>
    </div>
  );
}