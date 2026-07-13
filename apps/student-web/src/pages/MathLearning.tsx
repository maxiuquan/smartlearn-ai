import { useState, useEffect, useCallback } from 'react';
import FormulaText from '../components/FormulaText';
import AIAssistant from '../components/AIAssistant';
import HandwritingPad from '../components/HandwritingPad';
import ScratchPad from '../components/ScratchPad';
import {
  questionsApi,
  type QuestionItem,
  type AttemptResult,
} from '../api/questions';

/** 数学章节 */
const MATH_CHAPTERS = [
  { id: '函数、极限、连续', label: '函数、极限、连续', emoji: '📈' },
  { id: '一元函数微分学', label: '一元函数微分学', emoji: '📉' },
  { id: '一元函数积分学', label: '一元函数积分学', emoji: '∫' },
  { id: '多元函数微积分学', label: '多元函数微积分学', emoji: '∬' },
  { id: '无穷级数', label: '无穷级数', emoji: '∑' },
  { id: '常微分方程', label: '常微分方程', emoji: '微分' },
  { id: '线性代数', label: '线性代数', emoji: '矩阵' },
  { id: '概率论与数理统计', label: '概率论与数理统计', emoji: '🎲' },
];

/** 难度选项 */
const DIFFICULTY_OPTIONS = [
  { value: '', label: '全部难度' },
  { value: '1', label: '简单' },
  { value: '2', label: '中等' },
  { value: '3', label: '困难' },
  { value: '4', label: '较难' },
  { value: '5', label: '困难' },
];

/**
 * 数学学习模块。
 * 按章节选择数学题目进行练习，支持难度筛选。
 * 类似词汇学习模块的结构化学习方式。
 */
export default function MathLearning() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 筛选
  const [chapter, setChapter] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');

  // 答题状态
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionItem | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState('');
  // 辅助工具面板：none/handwriting/scratch
  const [toolPanel, setToolPanel] = useState<'none' | 'handwriting' | 'scratch'>('none');

  const pageSize = 10;

  /** 加载题目 */
  const loadQuestions = useCallback(
    async (pageNum: number, chap: string, diff: string) => {
      try {
        setLoading(true);
        setError('');
        const data = await questionsApi.getQuestions({
          subject: 'math',
          kp_id: chap || undefined,
          difficulty: diff,
          page: pageNum,
        });
        setQuestions(data.items);
        setTotal(data.total);
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || '无法加载题目');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadQuestions(1, '', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilter() {
    setPage(1);
    setSelectedQuestion(null);
    loadQuestions(1, chapter, difficulty);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    loadQuestions(newPage, chapter, difficulty);
  }

  function handleSelectQuestion(q: QuestionItem) {
    setSelectedQuestion(q);
    setUserAnswer('');
    setAttemptResult(null);
    setAnswerError('');
  }

  async function handleSubmit() {
    if (!selectedQuestion) return;
    setSubmitting(true);
    setAnswerError('');
    try {
      const result = await questionsApi.attempt(selectedQuestion.id, userAnswer);
      setAttemptResult(result);
    } catch (err: any) {
      setAnswerError(err?.response?.data?.detail || err?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    setSelectedQuestion(null);
    setUserAnswer('');
    setAttemptResult(null);
    // 自动加载下一页
    if (questions.length > 0 && page * pageSize < total) {
      handlePageChange(page + 1);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📐 数学学习</h1>

      {!selectedQuestion ? (
        <>
          {/* 章节选择 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
            <p className="text-sm text-gray-500 mb-3">选择章节开始学习</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => { setChapter(''); setPage(1); loadQuestions(1, '', difficulty); }}
                className={`p-3 rounded-lg border text-center transition-all ${
                  !chapter ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="text-2xl mb-1">📋</div>
                <div className="text-xs font-medium">全部</div>
              </button>
              {MATH_CHAPTERS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => { setChapter(ch.id); setPage(1); loadQuestions(1, ch.id, difficulty); }}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    chapter === ch.id ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{ch.emoji}</div>
                  <div className="text-xs font-medium">{ch.label}</div>
                </button>
              ))}
            </div>

            {/* 难度筛选 */}
            <div className="flex items-center gap-3 mt-4">
              <label className="text-xs text-gray-500">难度：</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
              >
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={handleFilter}
                className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                筛选
              </button>
              <span className="text-sm text-gray-400 ml-auto">共 {total} 题</span>
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
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">📝</p>
              <p className="text-gray-500 text-lg">暂无题目，请选择其他章节</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    onClick={() => handleSelectQuestion(q)}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {(page - 1) * pageSize + idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 text-sm line-clamp-2">
                          <FormulaText text={q.content || q.title || ''} />
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-400">
                            {q.type === 'choice' ? '选择题' : q.type === 'fill' ? '填空题' : q.type === 'calculation' ? '计算题' : q.type}
                          </span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-400">难度 {q.difficulty}</span>
                        </div>
                      </div>
                      <span className="text-gray-300">→</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 分页 */}
              {total > pageSize && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:border-blue-300"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-gray-500">{page} / {Math.ceil(total / pageSize)}</span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page * pageSize >= total}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:border-blue-300"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* 答题视图 */
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setSelectedQuestion(null)}
            className="mb-4 text-sm text-gray-500 hover:text-blue-500 transition-colors"
          >
            ← 返回题目列表
          </button>

          <div className="bg-white rounded-xl shadow-md p-6 border border-orange-100">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium text-gray-500">
                {selectedQuestion.knowledge_points?.[0] || '数学题'}
              </span>
              <span className="text-xs px-2 py-1 rounded font-medium bg-orange-50 text-orange-600">
                难度 {selectedQuestion.difficulty}
              </span>
            </div>

            <div className="mb-4">
              <FormulaText text={selectedQuestion.content || selectedQuestion.title || ''} />
            </div>

            {selectedQuestion.options && Object.keys(selectedQuestion.options).length > 0 ? (
              <div className="space-y-2 mb-4">
                {Object.entries(selectedQuestion.options).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setUserAnswer(key)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all ${
                      userAnswer === key
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <span className="font-bold mr-2">{key}.</span>
                    <FormulaText text={String(val)} />
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="请输入你的答案..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:border-blue-400 focus:outline-none resize-y"
                rows={4}
              />
            )}

            {answerError && (
              <p className="text-red-500 text-sm mb-3">{answerError}</p>
            )}

            {attemptResult && (
              <div className={`rounded-lg p-4 mb-4 ${
                attemptResult.correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <p className={`font-medium mb-2 ${attemptResult.correct ? 'text-green-600' : 'text-red-500'}`}>
                  {attemptResult.correct ? '✅ 回答正确！' : '❌ 回答错误'}
                </p>
                {attemptResult.solution && (
                  <div className="text-sm text-gray-600 leading-relaxed">
                    <p className="font-medium mb-1">解题过程：</p>
                    <FormulaText text={attemptResult.solution} />
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={!userAnswer || submitting}
                className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-40"
              >
                {submitting ? '提交中...' : '提交答案'}
              </button>
              {attemptResult && (
                <button
                  onClick={handleNext}
                  className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  下一题
                </button>
              )}
            </div>

            {/* 辅助工具切换 */}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setToolPanel(toolPanel === 'handwriting' ? 'none' : 'handwriting')}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  toolPanel === 'handwriting'
                    ? 'border-purple-400 bg-purple-50 text-purple-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                ✍️ 手写答题
              </button>
              <button
                type="button"
                onClick={() => setToolPanel(toolPanel === 'scratch' ? 'none' : 'scratch')}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  toolPanel === 'scratch'
                    ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                📝 草稿纸
              </button>
            </div>

            {/* 手写答题区面板 */}
            {toolPanel === 'handwriting' && (
              <div className="mt-3">
                <HandwritingPad
                  questionContent={selectedQuestion.content || selectedQuestion.title || ''}
                  correctAnswer={attemptResult?.correct_answer || selectedQuestion.answer || ''}
                  questionType={selectedQuestion.type || 'calculation'}
                  options={selectedQuestion.options}
                  knowledgePoints={selectedQuestion.knowledge_points}
                  height={320}
                  onGraded={(result) => {
                    if (result.is_correct) {
                      setAttemptResult({
                        correct: true,
                        correct_answer: selectedQuestion.answer || '',
                        solution: result.feedback,
                      } as any);
                    }
                  }}
                />
                <p className="text-xs text-gray-400 mt-1">
                  手写答案后点击"提交批改"，AI 将识别手写内容并对照标准答案给分纠错
                </p>
              </div>
            )}

            {/* 草稿纸面板 */}
            {toolPanel === 'scratch' && (
              <div className="mt-3">
                <ScratchPad height={260} />
              </div>
            )}
          </div>

          {/* AI 辅导 */}
          <div className="mt-6">
            <AIAssistant context="数学学习" />
          </div>
        </div>
      )}
    </div>
  );
}
