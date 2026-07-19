import { useState, useEffect, useCallback } from 'react';
import { vocabApi, type VocabWord, type VocabProgress, type WordEvent } from '../api/vocab';
import AIAssistant from '../components/AIAssistant';

/** 词书/分类选项（与后端 tags 数据对齐） */
const CATEGORY_OPTIONS = [
  { value: '', label: '全部', emoji: '📚' },
  { value: 'CET4', label: '英语四级', emoji: '📘' },
  { value: 'CET6', label: '英语六级', emoji: '📗' },
  { value: '考研', label: '考研英语', emoji: '📕' },
  { value: '学术词汇', label: '学术词汇', emoji: '📙' },
  { value: '高频', label: '高频词汇', emoji: '🔥' },
];

/**
 * 词汇学习页面。
 * 翻卡界面：正面单词+音标，背面释义+例句。
 * 「认识/不认识」按钮调 submitWordEvent。
 * 侧栏展示今日待复习词（调 getDueWords）。
 * 底部进度条（调 getProgress）。
 */
export default function VocabLearning() {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 待复习词汇
  const [dueWords, setDueWords] = useState<VocabWord[]>([]);
  const [progress, setProgress] = useState<VocabProgress | null>(null);
  // 翻页
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // 当前选中的词书分类（tag）
  const [category, setCategory] = useState('');

  const currentWord = words[currentIndex] || null;

  /** 加载词汇列表 */
  const loadWords = useCallback(async (pageNum: number, tag?: string) => {
    try {
      setLoading(true);
      setError('');
      const data = await vocabApi.getWords({ page: pageNum, page_size: 20, tag: tag || undefined });
      if (pageNum === 1) {
        setWords(data.items);
      } else {
        setWords((prev) => [...prev, ...data.items]);
      }
      setHasMore(data.items.length >= 20);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || '无法加载词汇列表');
    } finally {
      setLoading(false);
    }
  }, []);

  /** 加载进度和待复习 */
  const loadProgressAndDue = useCallback(async () => {
    try {
      const [prog, due] = await Promise.all([
        vocabApi.getProgress(),
        vocabApi.getDueWords(),
      ]);
      setProgress(prog);
      setDueWords(due);
    } catch {
      // 非阻断性错误，静默处理
    }
  }, []);

  useEffect(() => {
    loadWords(1, category);
    loadProgressAndDue();
  }, [loadWords, loadProgressAndDue, category]);

  /** 切换词书分类 */
  function handleCategoryChange(tag: string) {
    setCategory(tag);
    setCurrentIndex(0);
    setFlipped(false);
    setPage(1);
    loadWords(1, tag);
  }

  /** 处理认识/不认识 */
  const handleWordEvent = useCallback(
    async (event: WordEvent) => {
      if (!currentWord || submitting) return;
      setSubmitting(true);
      try {
        await vocabApi.submitWordEvent(currentWord.word_id, event);
        // 更新进度
        loadProgressAndDue();
      } catch {
        // 非阻断性错误
      } finally {
        setSubmitting(false);
      }

      // 翻到下一张
      setFlipped(false);
      setTimeout(() => {
        if (currentIndex < words.length - 1) {
          setCurrentIndex((i) => i + 1);
        } else if (hasMore) {
          // 加载更多
          const nextPage = page + 1;
          setPage(nextPage);
          loadWords(nextPage, category);
          setCurrentIndex(words.length);
        } else {
          // 已到末尾
          setCurrentIndex(0);
        }
      }, 300);
    },
    [currentWord, submitting, currentIndex, words.length, hasMore, page, loadWords, loadProgressAndDue, category]
  );

  // ─── 加载态 ───
  if (loading && words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-gray-500">正在加载词汇...</p>
      </div>
    );
  }

  // ─── 错误态 ───
  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">😵</p>
        <p className="text-red-500 text-lg mb-4">{error}</p>
        <button
          onClick={() => loadWords(1, category)}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          重新加载
        </button>
      </div>
    );
  }

  // ─── 空数据态 ───
  if (!currentWord) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">📭</p>
        <p className="text-gray-500 text-lg mb-4">暂无词汇数据</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 主区域 — 翻卡 */}
      <div className="lg:col-span-2">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">📖 词汇学习</h1>

        {/* 词书分类选择器 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleCategoryChange(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${category === opt.value
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>

        {/* 翻卡容器 */}
        <div
          className="relative cursor-pointer mb-6"
          style={{ perspective: '1000px' }}
          onClick={() => setFlipped(!flipped)}
        >
          <div
            className="relative w-full transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: '320px',
            }}
          >
            {/* 正面 — 单词 + 音标 */}
            <div
              className="absolute inset-0 bg-white rounded-2xl shadow-lg border border-blue-100 p-8 flex flex-col items-center justify-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <p className="text-5xl font-bold text-gray-800 mb-4">
                {currentWord.headword}
              </p>
              {currentWord.phonetic && (
                <p className="text-xl text-gray-400 mb-6">/{currentWord.phonetic}/</p>
              )}
              {currentWord.tags && currentWord.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {currentWord.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-sm text-gray-400 mt-4">点击卡片查看释义 →</p>
            </div>

            {/* 背面 — 释义 + 例句 */}
            <div
              className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl shadow-lg border border-purple-100 p-8 flex flex-col items-center justify-center overflow-y-auto"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <p className="text-2xl font-bold text-gray-800 mb-3">
                {currentWord.headword}
              </p>
              <p className="text-lg text-gray-700 mb-4 text-center">
                {currentWord.meaning}
              </p>
              {currentWord.synonyms && currentWord.synonyms.length > 0 && (
                <div className="text-sm text-gray-500 mb-2">
                  <span className="font-medium">同义词：</span>
                  {currentWord.synonyms.join(', ')}
                </div>
              )}
              {currentWord.antonyms && currentWord.antonyms.length > 0 && (
                <div className="text-sm text-gray-500 mb-2">
                  <span className="font-medium">反义词：</span>
                  {currentWord.antonyms.join(', ')}
                </div>
              )}
              {currentWord.examples && currentWord.examples.length > 0 && (
                <div className="mt-4 w-full">
                  {currentWord.examples.map((ex, i) => (
                    <div
                      key={i}
                      className="bg-white/60 rounded-lg p-3 mb-2"
                    >
                      <p className="text-sm text-gray-700">{ex.en}</p>
                      <p className="text-xs text-gray-500 mt-1">{ex.zh}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 翻卡按钮 */}
        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={() => setFlipped(!flipped)}
            className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            {flipped ? '看正面' : '看背面'}
          </button>
        </div>

        {/* 认识 / 不认识 按钮 */}
        <div className="flex gap-4">
          <button
            onClick={() => handleWordEvent('known')}
            disabled={submitting}
            className="flex-1 py-4 bg-green-500 text-white rounded-xl font-bold text-lg
              hover:bg-green-600 transition-colors disabled:opacity-50 shadow-md shadow-green-200"
          >
            ✅ 认识
          </button>
          <button
            onClick={() => handleWordEvent('unknown')}
            disabled={submitting}
            className="flex-1 py-4 bg-orange-500 text-white rounded-xl font-bold text-lg
              hover:bg-orange-600 transition-colors disabled:opacity-50 shadow-md shadow-orange-200"
          >
            🤔 不认识
          </button>
        </div>

        {/* 进度指示 */}
        <div className="mt-6 flex items-center justify-between text-sm text-gray-400">
          <span>
            第 {currentIndex + 1} / {words.length} 词
            {hasMore && '（可继续加载）'}
          </span>
          {hasMore && currentIndex >= words.length - 3 && (
            <button
              onClick={() => {
                const next = page + 1;
                setPage(next);
                loadWords(next, category);
              }}
              className="text-blue-500 hover:underline"
            >
              加载更多 →
            </button>
          )}
        </div>
      </div>

      {/* 侧栏 — 今日待复习 + 进度 */}
      <div className="lg:col-span-1">
        {/* 进度卡片 */}
        {progress && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h3 className="font-bold text-gray-700 mb-4">📊 学习进度</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">总词汇</span>
                <span className="font-bold text-gray-800">{progress.total_words}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-600">已掌握</span>
                <span className="font-bold text-green-600">{progress.mastered}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-600">学习中</span>
                <span className="font-bold text-blue-600">{progress.learning}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">新词</span>
                <span className="font-bold text-gray-500">{progress.new_words}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-orange-600">今日待复习</span>
                <span className="font-bold text-orange-600">{progress.due_today}</span>
              </div>
              {progress.avg_mastery !== undefined && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-400">平均掌握度</span>
                    <span className="text-xs text-gray-600">
                      {Math.round(progress.avg_mastery * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-purple-500 h-full rounded-full"
                      style={{ width: `${Math.round(progress.avg_mastery * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 今日待复习词 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-700 mb-4">⏰ 今日待复习</h3>
          {dueWords.length > 0 ? (
            <div className="space-y-2">
              {dueWords.slice(0, 10).map((word, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-orange-50 rounded-lg"
                >
                  <div>
                    <span className="font-medium text-gray-800">{word.headword}</span>
                    {word.phonetic && (
                      <span className="text-xs text-gray-400 ml-2">/{word.phonetic}/</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 truncate max-w-[120px]">
                    {word.meaning}
                  </span>
                </div>
              ))}
              {dueWords.length > 10 && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  还有 {dueWords.length - 10} 个待复习词...
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-sm text-gray-400">暂无待复习词汇</p>
            </div>
          )}
        </div>
      </div>

      {/* AI 助手浮动面板 — 上下文为当前单词 */}
      <AIAssistant
        context={currentWord ? `当前学习单词：${currentWord.headword}（${currentWord.meaning}）` : '词汇学习'}
        buttonTitle="AI 词汇助手"
      />
    </div>
  );
}
