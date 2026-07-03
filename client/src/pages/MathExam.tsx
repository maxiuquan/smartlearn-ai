import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Award, Target, BookOpen, ChevronRight, Brain, TrendingUp, Calendar } from 'lucide-react';

interface CategoryInfo {
  name: string;
  topics: string[];
  examWeight: Record<string, string>;
}

interface MockExam {
  id: string;
  name: string;
  categories: string[];
  duration: number;
  totalScore: number;
  sections?: { type: string; count: number; scorePer: number | string; total: number }[];
}

interface RealExam {
  year: number;
  name: string;
  categories: string[];
}

export default function MathExamPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'mock' | 'real' | 'categories'>('mock');
  const [categories, setCategories] = useState<Record<string, CategoryInfo>>({});
  const [mockExams, setMockExams] = useState<MockExam[]>([]);
  const [realExams, setRealExams] = useState<RealExam[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('math1');

  useEffect(() => {
    fetch('/api/math-bank/categories').then(r => r.json()).then(setCategories).catch(() => {});
    fetch('/api/math-bank/mock-exams').then(r => r.json()).then(setMockExams).catch(() => {});
    fetch('/api/math-bank/real-exams').then(r => r.json()).then(setRealExams).catch(() => {});
  }, []);

  const categoryNames: Record<string, string> = { math1: '数学一', math2: '数学二', math3: '数学三' };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/math-home')} className="text-gray-500 hover:text-white">
            ← 返回
          </button>
          <h1 className="text-2xl font-bold">考研数学 · 真题与模拟</h1>
        </div>

        <div className="flex gap-2 mb-6 bg-[#12141A] rounded-xl p-1 w-fit">
          {[
            { key: 'mock', label: '模拟卷', icon: Target },
            { key: 'real', label: '历年真题', icon: Calendar },
            { key: 'categories', label: '数一/二/三', icon: BookOpen },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key ? 'bg-[#00FF9C]/10 text-[#00FF9C]' : 'text-gray-500 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="flex gap-2">
              {Object.entries(categories).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`flex-1 p-4 rounded-xl border transition-colors ${
                    selectedCategory === key
                      ? 'bg-[#00FF9C]/10 border-[#00FF9C]/30'
                      : 'bg-[#12141A] border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="text-lg font-bold">{cat.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {cat.topics.join(' / ')}
                  </div>
                  {cat.examWeight && Object.entries(cat.examWeight).map(([k, v]) => (
                    <div key={k} className="text-xs text-gray-600 mt-1">
                      {k === 'advanced' ? '高数' : k === 'linear' ? '线代' : '概率'}: {v}
                    </div>
                  ))}
                </button>
              ))}
            </div>

            {selectedCategory && categories[selectedCategory] && (
              <div className="bg-[#12141A] border border-gray-800 rounded-xl p-5">
                <h3 className="text-white font-bold mb-4">{categories[selectedCategory].name} 考试范围</h3>
                <div className="space-y-2">
                  {categories[selectedCategory].topics.map((topic, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#0D0F14]">
                      <Brain className="w-4 h-4 text-[#00FF9C]" />
                      <span className="text-gray-300">{topic}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'mock' && (
          <div className="grid gap-4">
            {mockExams.map((exam) => (
              <div
                key={exam.id}
                className="bg-[#12141A] border border-gray-800 rounded-xl p-5 hover:border-[#00FF9C]/30 transition-colors cursor-pointer group"
                onClick={() => navigate(`/mock-exam/${exam.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-bold group-hover:text-[#00FF9C] transition-colors">{exam.name}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Clock size={14} /> {exam.duration}分钟</span>
                      <span className="flex items-center gap-1"><Award size={14} /> {exam.totalScore}分</span>
                      <span className="flex items-center gap-1">
                        <BookOpen size={14} />
                        {exam.categories.map(c => categoryNames[c] || c).join(' / ')}
                      </span>
                    </div>
                    {exam.sections && (
                      <div className="flex gap-3 mt-2">
                        {exam.sections.map((sec, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[#0D0F14] text-gray-500">
                            {sec.type} ×{sec.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-[#00FF9C] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'real' && (
          <div className="grid grid-cols-3 gap-4">
            {realExams.map((exam) => (
              <div
                key={exam.year}
                className="bg-[#12141A] border border-gray-800 rounded-xl p-5 hover:border-[#00FF9C]/30 transition-colors cursor-pointer group"
                onClick={() => navigate(`/real-exam/${exam.year}`)}
              >
                <div className="text-3xl font-bold text-[#00FF9C] group-hover:scale-110 transition-transform">
                  {exam.year}
                </div>
                <div className="text-white text-sm mt-2">{exam.name}</div>
                <div className="flex gap-1 mt-2">
                  {exam.categories.map(c => (
                    <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-[#0D0F14] text-gray-500">
                      {categoryNames[c] || c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}