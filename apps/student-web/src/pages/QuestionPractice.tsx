import { useState, useEffect, useCallback } from 'react';
import FormulaText from '../components/FormulaText';
import AIAssistant from '../components/AIAssistant';
import {
  questionsApi,
  type QuestionItem,
  type AttemptResult,
  type GetQuestionsParams,
} from '../api/questions';

/** 学科选项 */
const SUBJECT_OPTIONS = [
  { value: '', label: '全部学科' },
  { value: 'math', label: '数学' },
  { value: 'english', label: '英语' },
];

/** 题型选项 */
const TYPE_OPTIONS = [
  { value: '', label: '全部题型' },
  { value: 'choice', label: '选择题' },
  { value: 'fill', label: '填空题' },
  { value: 'calculation', label: '计算题' },
];

/** 难度选项 */
const DIFFICULTY_OPTIONS = [
  { value: '', label: '全部难度' },
  { value: '1', label: '简单' },
  { value: '2', label: '中等' },
  { value: '3', label: '困难' },
];

/**
 * 题库练习页面。
 * 学科/题型/难度筛选器；题目列表分页加载；点击题目进入答题；提交后展示正误+解析。
 */
export default function QuestionPractice() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 筛选条件
  const [subject, setSubject] = useState('');
  const [type, setType] = useState('');
  const [difficulty, setDifficulty] = useState('');

  // 答题状态
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionItem | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState('');

  const pageSize = 10;

  /** 加载题目列表 */
  const loadQuestions = useCallback(
    async (pageNum: number, filters: GetQuestionsParams) => {
      try {
        setLoading(true);
        setError('');
        const data = await questionsApi.getQuestions({
          ...filters,
          page: pageNum,
        });
        setQuestions(data.items);
        setTotal(data.total);
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || '无法加载题目列表');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 初始加载
  useEffect(() => {
    loadQuestions(1, { subject, type, difficulty });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 筛选条件变化时重新加载 */
  function handleFilter() {
    setPage(1);
    setSelectedQuestion(null);
    loadQuestions(1, { subject, type, difficulty });
  }

  /** 翻页 */
  function handlePageChange(newPage: number) {
    setPage(newPage);
    loadQuestions(newPage, { subject, type, difficulty });
  }

  /** 选择题目进入答题 */
  function handleSelectQuestion(q: QuestionItem) {
    setSelectedQuestion(q);
    setUserAnswer('');
    setAttemptResult(null);
    setAnswerError('');
  }

  /** 提交答案 */
  async function handleSubmitAnswer() {
    if (!selectedQuestion || !userAnswer.trim()) {
      setAnswerError('请输入答案');
      return;
    }
    setSubmitting(true);
    setAnswerError('');
    try {
      const result = await questionsApi.submitAttempt(
        selectedQuestion.id,
        userAnswer.trim(),
        0
      );
      setAttemptResult(result);
    } catch (err: any) {
      setAnswerError(
        err?.response?.data?.detail || err?.message || '提交失败，请重试'
      );
    } finally {
      setSubmitting(false);
    }
  }

  /** 返回列表 */
  function handleBackToList() {
    setSelectedQuestion(null);
    setAttemptResult(null);
    setUserAnswer('');
  }

  // ─── 答题视图 ───
  if (selectedQuestion) {
    const isChoice = selectedQuestion.type === 'choice';
    const options = selectedQuestion.options;
    // 解析选项：支持数组 ["A. xxx"] 和对象 {"A": "xxx"} 两种格式
    // 当为数组且值含 "X. " 前缀时，提取字母作为 key，去掉前缀避免重复显示
    const optionEntries: [string, string][] =
      options && !Array.isArray(options)
        ? Object.entries(options)
        : Array.isArray(options)
        ? options.map((o, i) => {
            const match = String(o).match(/^([A-Z])[.、)]\s*(.*)/);
            if (match) return [match[1], match[2]];
            return [String.fromCharCode(65 + i), String(o)];
          })
        : [];

    return (
      <div className="max-w-2xl mx-auto">
        {/* 返回按钮 */}
        <button
          onClick={handleBackToList}
          className="mb-4 text-sm text-gray-500 hover:text-blue-500 transition-colors"
        >
          ← 返回题目列表
        </button>

        {/* 题目卡片 */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-medium">
              {SUBJECT_OPTIONS.find((s) => s.value === selectedQuestion.subject)?.label || selectedQuestion.subject}
            </span>
            <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded font-medium">
              {TYPE_OPTIONS.find((t) => t.value === selectedQuestion.type)?.label || selectedQuestion.type}
            </span>
            {selectedQuestion.difficulty && (
              <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded font-medium">
                {DIFFICULTY_OPTIONS.find((d) => d.value === String(selectedQuestion.difficulty))?.label || selectedQuestion.difficulty}
              </span>
            )}
          </div>

          {/* 题目标签（title 作为分类标签） */}
          {selectedQuestion.title && (
            <div className="mb-3">
              <span className="text-xs bg-gray-50 text-gray-500 px-2 py-1 rounded">
                {selectedQuestion.title}
              </span>
            </div>
          )}

          {/* 题目正文（content 为真正题干，回退到 title） */}
          <p className="text-lg text-gray-800 mb-4">
            <FormulaText text={selectedQuestion.content || selectedQuestion.title} />
          </p>

          {/* 选择题选项 */}
          {isChoice && optionEntries.length > 0 && (
            <div className="space-y-2 mb-4">
              {optionEntries.map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setUserAnswer(key)}
                  disabled={!!attemptResult}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all
                    ${
                      userAnswer === key
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }
                    ${attemptResult ? 'cursor-default' : 'cursor-pointer'}
                    disabled:opacity-70`}
                >
                  <span className="inline-block w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-center leading-7 mr-3 text-sm font-bold">
                    {key}
                  </span>
                  <FormulaText text={val} />
                </button>
              ))}
            </div>
          )}

          {/* 非选择题 — 输入框 */}
          {!isChoice && !attemptResult && (
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                disabled={submitting}
                placeholder="请输入答案..."
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none text-lg"
              />
            </div>
          )}

          {answerError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              {answerError}
            </div>
          )}

          {/* 提交按钮 */}
          {!attemptResult && (
            <button
              onClick={handleSubmitAnswer}
              disabled={submitting || !userAnswer.trim()}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {submitting ? '提交中...' : '提交答案'}
            </button>
          )}

          {/* 判分结果 */}
          {attemptResult && (
            <div className="mt-4 space-y-3">
              <div
                className={`p-4 rounded-lg border ${
                  attemptResult.correct
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <p className={`font-bold text-lg ${attemptResult.correct ? 'text-green-600' : 'text-red-500'}`}>
                  {attemptResult.correct ? '✅ 回答正确！' : '❌ 回答错误'}
                </p>
                {!attemptResult.correct && (
                  <p className="text-sm text-gray-600 mt-1">
                    正确答案：<FormulaText text={attemptResult.correct_answer ?? ''} />
                  </p>
                )}
              </div>

              {attemptResult.solution && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <p className="font-medium text-gray-700 mb-2">📝 解析</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    <FormulaText text={attemptResult.solution} />
                  </p>
                </div>
              )}

              <button
                onClick={handleBackToList}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
              >
                返回列表
              </button>
            </div>
          )}
        </div>

        {/* AI 助手 — 答题时提供题目相关辅导 */}
        <AIAssistant
          context={selectedQuestion ? `当前题目：${selectedQuestion.content || selectedQuestion.title}（${selectedQuestion.subject}学科，${selectedQuestion.type}题型）` : '题库练习'}
          buttonTitle="AI 题目辅导"
        />
      </div>
    );
  }

  // ─── 列表视图 ───
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">✏️ 题库练习</h1>

      {/* 筛选器 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">学科</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
            >
              {SUBJECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">题型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">难度</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
            >
              {DIFFICULTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleFilter}
              className="px-5 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              筛选
            </button>
          </div>
        </div>
      </div>

      {/* 题目列表 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4" />
          <p className="text-gray-500">正在加载题目...</p>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">😵</p>
          <p className="text-red-500 text-lg mb-4">{error}</p>
          <button
            onClick={handleFilter}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            重新加载
          </button>
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">📭</p>
          <p className="text-gray-500 text-lg">暂无符合条件的题目</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-3">共 {total} 题</p>
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                onClick={() => handleSelectQuestion(q)}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer
                  hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-400">
                        {(page - 1) * pageSize + idx + 1}.
                      </span>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                        {SUBJECT_OPTIONS.find((s) => s.value === q.subject)?.label || q.subject}
                      </span>
                      <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded">
                        {TYPE_OPTIONS.find((t) => t.value === q.type)?.label || q.type}
                      </span>
                      {q.difficulty && (
                        <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded">
                          {DIFFICULTY_OPTIONS.find((d) => d.value === String(q.difficulty))?.label || q.difficulty}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      <FormulaText text={q.content || q.title} />
                    </p>
                  </div>
                  <span className="text-gray-300 text-sm flex-shrink-0">→</span>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
              >
                上一页
              </button>
              <span className="text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
