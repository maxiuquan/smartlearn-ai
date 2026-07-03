import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { api } from '../api/client';
import { toast } from '../store/toast';
import {
  BookOpen, Plus, Search, Check, X, RotateCcw, Upload,
  BookMarked, BarChart3, ChevronRight, Brain, Flame,
  Target, ArrowRight, ArrowLeft, Zap, Sparkles, Clock, CheckCircle2
} from 'lucide-react';
import { ListSkeleton } from '../components/Skeleton';
import { WordBankImport } from '../components/WordBankImport';

interface Word {
  id: number;
  word: string;
  phonetic: string | null;
  definition: string;
  exampleSentence: string | null;
  partOfSpeech: string | null;
  difficulty: number;
  category: string | null;
}

interface UserWord extends Word {
  memoryLevel: number;
  lastReviewAt: string | null;
  nextReviewAt: string | null;
  reviewCount: number;
}

const MEMORY_DOT_COLORS = [
  'bg-gray-300',
  'bg-orange-400',
  'bg-yellow-400',
  'bg-blue-400',
  'bg-green-400',
  'bg-emerald-500',
];

const MEMORY_LEVELS = [
  { level: 0, label: '新词', color: 'bg-gray-200', textColor: 'text-gray-500', dotColor: 'bg-gray-300' },
  { level: 1, label: '见过', color: 'bg-orange-300', textColor: 'text-orange-600', dotColor: 'bg-orange-400' },
  { level: 2, label: '模糊', color: 'bg-yellow-400', textColor: 'text-yellow-700', dotColor: 'bg-yellow-400' },
  { level: 3, label: '熟悉', color: 'bg-blue-400', textColor: 'text-blue-600', dotColor: 'bg-blue-400' },
  { level: 4, label: '掌握', color: 'bg-green-400', textColor: 'text-green-600', dotColor: 'bg-green-400' },
  { level: 5, label: '精通', color: 'bg-emerald-500', textColor: 'text-emerald-600', dotColor: 'bg-emerald-500' },
];

const SRS_INTERVALS = [0, 1, 3, 7, 15, 30];

export default function EnglishStudy() {
  const navigate = useNavigate();
  const { userId } = useAuthStore();
  const [tab, setTab] = useState<'learn' | 'review' | 'mywords'>('learn');
  const [words, setWords] = useState<Word[]>([]);
  const [userWords, setUserWords] = useState<UserWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [difficulty, setDifficulty] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWords, setSelectedWords] = useState<Word[]>([]);
  const [category, setCategory] = useState('');
  const [showImport, setShowImport] = useState(false);

  const [reviewQueue, setReviewQueue] = useState<UserWord[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const [dragX, setDragX] = useState(0);

  const [reviewFeedback, setReviewFeedback] = useState<'remembered' | 'forgotten' | null>(null);
  const [reviewCelebration, setReviewCelebration] = useState(false);

  const [stats, setStats] = useState({
    total: 0, mastered: 0, reviewing: 0, newWords: 0,
    todayLearned: 0, todayGoal: 20, streak: 0,
  });

  const loadWords = async (diff?: number, cat?: string) => {
    setLoading(true);
    try {
      const d = diff ?? difficulty;
      const params: Record<string, string> = { difficulty: String(d), limit: '200' };
      if (cat) params.category = cat;
      const data = await api.getWords(params);
      setWords((data as { words: Word[] }).words);
    } catch {
      toast.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUserWords = async () => {
    if (!userId) return;
    try {
      const data = await api.getUserWords(userId);
      const uw = ((data as { words: UserWord[] }).words || []) as UserWord[];
      setUserWords(uw);
      const masteredCount = uw.filter((w: UserWord) => w.memoryLevel >= 4).length;
      const reviewingCount = uw.filter((w: UserWord) => w.memoryLevel >= 1 && w.memoryLevel < 4).length;
      const newCount = uw.filter((w: UserWord) => w.memoryLevel === 0).length;
      const todayCount = uw.filter((w: UserWord) => {
        if (!w.lastReviewAt) return false;
        const today = new Date();
        const lastReview = new Date(w.lastReviewAt);
        return lastReview.toDateString() === today.toDateString();
      }).length;
      setStats(prev => ({
        ...prev,
        total: uw.length,
        mastered: masteredCount,
        reviewing: reviewingCount,
        newWords: newCount,
        todayLearned: todayCount,
      }));
    } catch {
      // silent
    }
  };

  const getSRSInterval = (level: number): number => {
    return SRS_INTERVALS[Math.min(level, SRS_INTERVALS.length - 1)] || 30;
  };

  const getDaysUntilReview = (word: UserWord): number | null => {
    if (!word.nextReviewAt) return null;
    const now = new Date();
    const next = new Date(word.nextReviewAt);
    const diffMs = next.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const loadReviewQueue = useCallback(() => {
    const due = userWords.filter(w => {
      if (!w.nextReviewAt) return true;
      return new Date(w.nextReviewAt) <= new Date();
    });
    due.sort((a, b) => (a.memoryLevel || 0) - (b.memoryLevel || 0));
    setReviewQueue(due);
    setReviewIndex(0);
    setShowAnswer(false);
    setReviewFeedback(null);
    setReviewCelebration(false);
  }, [userWords]);

  useEffect(() => {
    loadWords();
    loadUserWords();
  }, [userId]);

  useEffect(() => {
    if (tab === 'review') loadReviewQueue();
  }, [tab, loadReviewQueue]);

  const handleReview = async (wordId: number, remembered: boolean) => {
    if (!userId || swiping) return;
    setSwiping(true);
    setReviewFeedback(remembered ? 'remembered' : 'forgotten');
    try {
      await api.reviewWord({ userId, wordId, remembered });
      await loadUserWords();
    } catch {
      toast.error('操作失败');
    } finally {
      setSwiping(false);
      setShowAnswer(false);
      setSwipeDir(null);
      setDragX(0);

      setTimeout(() => {
        setReviewFeedback(null);
        const nextIdx = reviewIndex + 1;
        if (nextIdx < reviewQueue.length) {
          setReviewIndex(nextIdx);
        } else {
          setReviewQueue([]);
          setReviewIndex(0);
          setReviewCelebration(true);
        }
      }, 600);
    }
  };

  const handleSwipeStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (showAnswer) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startX.current = clientX;
  };

  const handleSwipeMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (showAnswer) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const diff = clientX - startX.current;
    setDragX(diff);
    if (diff > 80) setSwipeDir('right');
    else if (diff < -80) setSwipeDir('left');
    else setSwipeDir(null);
  };

  const handleSwipeEnd = () => {
    if (!showAnswer) {
      if (swipeDir === 'right') {
        setShowAnswer(true);
      } else if (swipeDir === 'left') {
        setShowAnswer(true);
      }
    }
    setDragX(0);
    setSwipeDir(null);
  };

  const handleGenerateArticle = async () => {
    if (!userId) return;
    try {
      toast.info('正在生成个性化阅读文章...');
      const res = await api.generateArticle({ userId });
      navigate(`/english/article/${(res as { id: number }).id}`);
    } catch {
      toast.error('生成文章失败，请先学习一些单词');
    }
  };

  const handleAddWords = async () => {
    if (!userId || selectedWords.length === 0) return;
    try {
      for (const w of selectedWords) {
        await api.reviewWord({ userId, wordId: w.id, remembered: false });
      }
      toast.success(`已添加 ${selectedWords.length} 个单词到学习计划`);
      setSelectedWords([]);
      loadUserWords();
    } catch {
      toast.error('添加失败');
    }
  };

  const filteredWords = searchTerm
    ? words.filter(w => w.word.toLowerCase().includes(searchTerm.toLowerCase()) || w.definition.includes(searchTerm))
    : words;

  const currentReviewWord = reviewQueue.length > 0 ? reviewQueue[Math.min(reviewIndex, reviewQueue.length - 1)] : null;

  const dailyProgress = Math.min(Math.round((stats.todayLearned / stats.todayGoal) * 100), 100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="text-primary-600" />
            英语学习
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {stats.streak > 0 ? (
              <span className="flex items-center gap-1">
                <Flame size={14} className="text-orange-500" />
                已连续学习 {stats.streak} 天
              </span>
            ) : '每天坚持，积少成多'}
          </p>
        </div>
        {userWords.length > 0 && (
          <button onClick={handleGenerateArticle} className="btn-primary text-sm">
            <Sparkles size={16} className="mr-1" />
            生成阅读文章
          </button>
        )}
        <button
          onClick={() => setShowImport(true)}
          className="ml-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-medium hover:bg-blue-100 flex items-center gap-1.5"
        >
          <Upload size={14} />
          导入词库
        </button>
      </div>

      {showImport && (
        <WordBankImport
          onClose={() => setShowImport(false)}
          onSuccess={() => { loadWords(); loadUserWords(); }}
        />
      )}

      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'learn' as const, label: '学习新词', icon: Plus },
          { key: 'review' as const, label: '复习巩固', icon: RotateCcw },
          { key: 'mywords' as const, label: '我的词库', icon: BookMarked },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {userWords.length > 0 && (
        <>
          <div className="card bg-gradient-to-r from-primary-50 to-blue-50 border-primary-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-primary-600" />
                <span className="text-sm font-medium text-gray-700">今日目标</span>
              </div>
              <span className="text-sm font-bold text-primary-700">
                {stats.todayLearned} / {stats.todayGoal} 词
              </span>
            </div>
            <div className="w-full bg-white rounded-full h-3 overflow-hidden border border-primary-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-700"
                style={{ width: `${dailyProgress}%` }}
              />
            </div>
            {dailyProgress >= 100 && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <Check size={12} /> 今日目标已完成！
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card text-center p-4">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">总词数</p>
            </div>
            <div className="card text-center p-4">
              <p className="text-2xl font-bold text-green-600">{stats.mastered}</p>
              <p className="text-xs text-gray-500 mt-1">已掌握</p>
            </div>
            <div className="card text-center p-4">
              <p className="text-2xl font-bold text-orange-600">{stats.reviewing}</p>
              <p className="text-xs text-gray-500 mt-1">复习中</p>
            </div>
            <div className="card text-center p-4">
              <p className="text-2xl font-bold text-blue-600">{stats.newWords}</p>
              <p className="text-xs text-gray-500 mt-1">新词</p>
            </div>
          </div>
        </>
      )}

      {reviewQueue.length > 0 && tab !== 'review' && (
        <div className="card border-orange-200 bg-orange-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <Zap className="text-orange-600" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">待复习单词</h3>
                <p className="text-sm text-gray-500">有 {reviewQueue.length} 个单词需要复习巩固</p>
              </div>
            </div>
            <button onClick={() => setTab('review')} className="btn-primary text-sm">
              开始复习
            </button>
          </div>
        </div>
      )}

      {tab === 'learn' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 relative min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="input-field pl-10"
                  placeholder="搜索单词..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">分类</label>
                <select
                  className="input-field w-24"
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); loadWords(difficulty, e.target.value || undefined); }}
                >
                  <option value="">全部</option>
                  <option value="考研核心">考研核心</option>
                  <option value="高频词汇">高频词汇</option>
                  <option value="基础词汇">基础词汇</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">难度</label>
                <select
                  className="input-field w-24"
                  value={difficulty}
                  onChange={(e) => { setDifficulty(Number(e.target.value)); loadWords(Number(e.target.value), category || undefined); }}
                >
                  <option value={0}>全部</option>
                  <option value={1}>基础</option>
                  <option value={2}>进阶</option>
                  <option value={3}>高级</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <ListSkeleton count={8} />
          ) : (
            <div className="space-y-2">
              {filteredWords.map((word) => {
                const alreadyAdded = userWords.some(uw => uw.id === word.id);
                const isSelected = selectedWords.some(w => w.id === word.id);
                return (
                  <div
                    key={word.id}
                    className={`card flex items-center justify-between p-4 cursor-pointer transition-all ${isSelected ? 'border-primary-300 bg-primary-50/30' : ''} ${alreadyAdded ? 'opacity-60' : 'hover:border-gray-200'}`}
                    onClick={() => {
                      if (alreadyAdded) return;
                      setSelectedWords(prev =>
                        prev.some(w => w.id === word.id)
                          ? prev.filter(w => w.id !== word.id)
                          : [...prev, word]
                      );
                    }}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary-100' : 'bg-gray-100'}`}>
                        {alreadyAdded ? <Check size={15} className="text-green-500" /> : isSelected ? <Check size={15} className="text-primary-600" /> : <Plus size={15} className="text-gray-400" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 truncate">{word.word}</p>
                          {word.phonetic && <span className="text-xs text-gray-400 shrink-0">{word.phonetic}</span>}
                          {word.partOfSpeech && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{word.partOfSpeech}</span>}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{word.definition}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">
                      {word.category && <span className="mr-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{word.category}</span>}
                      {'★'.repeat(word.difficulty)}{'☆'.repeat(3 - word.difficulty)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {selectedWords.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
              <button onClick={handleAddWords} className="btn-primary shadow-xl px-8 py-3 animate-slide-up">
                <Plus size={18} className="mr-2" />
                添加 {selectedWords.length} 个单词到学习计划
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'review' && (
        <div className="space-y-4">
          {reviewCelebration ? (
            <div className="card text-center py-12">
              <div className="text-6xl mb-4 animate-bounce">🎉</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">全部复习完成！</h2>
              <p className="text-gray-500 mb-6">太厉害了！你已经掌握了所有待复习的单词</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setTab('learn')} className="btn-primary">
                  <Plus size={16} className="mr-1" />
                  学习新词
                </button>
                {userWords.length > 0 && (
                  <button onClick={handleGenerateArticle} className="btn-secondary">
                    <Brain size={16} className="mr-1" />
                    生成文章
                  </button>
                )}
              </div>
            </div>
          ) : currentReviewWord ? (
            <div className="max-w-md mx-auto space-y-6">
              <div className="card bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Clock className="text-orange-600" size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">今日待复习 <span className="text-orange-600">{reviewQueue.length}</span> 词</h3>
                    <p className="text-xs text-gray-500">当前第 {reviewIndex + 1} 个</p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div
                    className="h-1.5 rounded-full bg-primary-500 transition-all"
                    style={{ width: `${((reviewIndex + 1) / reviewQueue.length) * 100}%` }}
                  />
                </div>
              </div>

              {reviewFeedback && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none`}>
                  <div className={`animate-fade-in flex items-center gap-2 px-6 py-3 rounded-2xl shadow-lg ${
                    reviewFeedback === 'remembered' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {reviewFeedback === 'remembered' ? (
                      <><CheckCircle2 size={28} /> 记住了！</>
                    ) : (
                      <><X size={28} /> 再练一次</>
                    )}
                  </div>
                </div>
              )}

              <div
                ref={cardRef}
                className="card min-h-[280px] flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none relative overflow-hidden"
                style={{ transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`, transition: dragX === 0 ? 'transform 0.3s ease' : 'none' }}
                onMouseDown={handleSwipeStart}
                onMouseMove={handleSwipeMove}
                onMouseUp={handleSwipeEnd}
                onMouseLeave={handleSwipeEnd}
                onTouchStart={handleSwipeStart}
                onTouchMove={handleSwipeMove}
                onTouchEnd={handleSwipeEnd}
              >
                {swipeDir === 'right' && !showAnswer && (
                  <div className="absolute top-4 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-fade-in">
                    认识
                  </div>
                )}
                {swipeDir === 'left' && !showAnswer && (
                  <div className="absolute top-4 left-4 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-fade-in">
                    显示释义
                  </div>
                )}

                <div className="text-center py-6 space-y-4 w-full">
                  <div>
                    <p className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">{currentReviewWord.word}</p>
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {currentReviewWord.phonetic && (
                        <span className="text-sm text-gray-400">{currentReviewWord.phonetic}</span>
                      )}
                      {currentReviewWord.partOfSpeech && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{currentReviewWord.partOfSpeech}</span>
                      )}
                      <span className="text-sm text-gray-400">
                        {'★'.repeat(currentReviewWord.difficulty)}{'☆'.repeat(3 - currentReviewWord.difficulty)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${MEMORY_LEVELS[currentReviewWord.memoryLevel || 0]?.color || 'bg-gray-200'} text-white`}>
                        {MEMORY_LEVELS[currentReviewWord.memoryLevel || 0]?.label || '新词'}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      {[0, 1, 2, 3, 4, 5].map((level) => {
                        const currentLevel = currentReviewWord.memoryLevel || 0;
                        const isActive = level <= currentLevel;
                        return (
                          <div
                            key={level}
                            className={`w-3 h-3 rounded-full transition-all ${isActive ? MEMORY_DOT_COLORS[level] : 'bg-gray-200'}`}
                            title={`记忆等级 ${level}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {showAnswer ? (
                    <div className="animate-fade-in space-y-6">
                      <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                        <p className="text-lg text-gray-700 font-medium">{currentReviewWord.definition}</p>
                        {currentReviewWord.exampleSentence && (
                          <div className="pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-400 mb-1">例句</p>
                            <p className="text-sm text-gray-600 italic">{currentReviewWord.exampleSentence}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-center gap-4">
                        <button
                          onClick={() => handleReview(currentReviewWord.id, false)}
                          disabled={swiping}
                          className="btn-secondary flex items-center gap-2 px-6"
                        >
                          <X size={16} /> 还不认识
                        </button>
                        <button
                          onClick={() => handleReview(currentReviewWord.id, true)}
                          disabled={swiping}
                          className="btn-primary flex items-center gap-2 px-6"
                        >
                          <Check size={16} /> 认识了
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-gray-400">← 左滑显示释义 · 右滑标记认识 →</p>
                      <div className="flex justify-center gap-4">
                        <button
                          onClick={() => handleReview(currentReviewWord.id, false)}
                          disabled={swiping}
                          className="btn-secondary text-sm"
                        >
                          <X size={16} className="mr-1" />
                          不认识
                        </button>
                        <button
                          onClick={() => setShowAnswer(true)}
                          className="btn-primary text-sm"
                        >
                          显示释义
                        </button>
                        <button
                          onClick={() => handleReview(currentReviewWord.id, true)}
                          disabled={swiping}
                          className="btn-secondary text-sm"
                        >
                          <Check size={16} className="mr-1" />
                          认识
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {currentReviewWord.nextReviewAt && (
                <div className="text-center text-xs text-gray-400 flex items-center justify-center gap-4">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    下次复习：{getSRSInterval(currentReviewWord.memoryLevel || 0)}天后
                  </span>
                </div>
              )}

              <div className="text-center text-xs text-gray-400 flex items-center justify-center gap-4">
                <span className="flex items-center gap-1"><ArrowLeft size={12} /> 左滑/点"不认识"</span>
                <span className="flex items-center gap-1">右滑/点"认识" <ArrowRight size={12} /></span>
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">复习完成！</h2>
              <p className="text-gray-500 mb-6">当前没有需要复习的单词，去学习新词吧</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setTab('learn')} className="btn-primary">
                  <Plus size={16} className="mr-1" />
                  学习新词
                </button>
                {userWords.length > 0 && (
                  <button onClick={handleGenerateArticle} className="btn-secondary">
                    <Brain size={16} className="mr-1" />
                    生成文章
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'mywords' && (
        <div className="space-y-4">
          {loading ? (
            <ListSkeleton count={8} />
          ) : userWords.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-6xl mb-4">📖</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">词库为空</h2>
              <p className="text-gray-500 mb-4">去学习新词，建立你的词库吧</p>
              <button onClick={() => setTab('learn')} className="btn-primary">
                <Plus size={16} className="mr-1" />
                学习新词
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                <span>共 {userWords.length} 个单词</span>
                <div className="flex items-center gap-1 text-xs">
                  排序：<span className="text-gray-700 font-medium">按记忆等级</span>
                </div>
              </div>
              {[...userWords]
                .sort((a, b) => (b.memoryLevel || 0) - (a.memoryLevel || 0))
                .map((uw) => {
                  const memConfig = MEMORY_LEVELS[uw.memoryLevel || 0] || MEMORY_LEVELS[0];
                  const daysUntil = getDaysUntilReview(uw);
                  return (
                    <div key={uw.id} className="card flex items-center justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{uw.word}</p>
                          {uw.phonetic && <span className="text-xs text-gray-400">{uw.phonetic}</span>}
                          {uw.partOfSpeech && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{uw.partOfSpeech}</span>}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${memConfig.color} text-white`}>
                            {memConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{uw.definition}</p>
                        {uw.exampleSentence && (
                          <p className="text-xs text-gray-400 mt-1 truncate italic">{uw.exampleSentence}</p>
                        )}
                        {uw.nextReviewAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            下次复习：{new Date(uw.nextReviewAt).toLocaleDateString('zh-CN')}
                            {daysUntil !== null && daysUntil > 0 && (
                              <span className="ml-1">({daysUntil}天后)</span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <div className="flex items-center gap-0.5">
                          {[0, 1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={`w-2 h-2 rounded-full transition-all ${level <= (uw.memoryLevel || 0) ? MEMORY_DOT_COLORS[level] : 'bg-gray-200'}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}