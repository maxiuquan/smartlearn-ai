import { useState, useEffect, useCallback } from 'react';
import FormulaText from '../components/FormulaText';

/** 试卷元数据 */
interface ExamPaper {
  id: string;
  year: string;
  subject: string;
  category: string;
  paper_name: string;
  questions: ExamQuestion[];
}

/** 试卷集合 */
interface ExamPaperSet {
  subject: string;
  subject_code: string;
  papers: ExamPaper[];
}

/** 试题 */
interface ExamQuestion {
  id: string;
  number: number;
  type: string;
  score: number;
  content: string;
  options: Record<string, string>;
  answer: string;
  solution: string;
  analysis: string;
  knowledge_points: string[];
  difficulty: number;
  tags: string[];
}

/** 可选试卷列表项 */
interface PaperOption {
  file: string;
  title: string;
  emoji: string;
}

const PAPER_OPTIONS: PaperOption[] = [
  { file: '/exam-papers/math-sample.json', title: '考研数学真题', emoji: '🔢' },
  { file: '/exam-papers/english-sample.json', title: '考研英语真题', emoji: '📖' },
];

const QUESTION_TYPE_LABELS: Record<string, string> = {
  choice: '选择题',
  fill: '填空题',
  calculation: '计算题',
  proof: '证明题',
};

/**
 * 真题模拟页面。
 * 试卷选择列表 → fetch 样例卷 JSON → 逐题答题 → 查看解析。
 * 数学题用 FormulaText 渲染 LaTeX。
 */
export default function PastExam() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [paperSet, setPaperSet] = useState<ExamPaperSet | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<ExamPaper | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 答题状态
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);

  /** 加载试卷集合 */
  const loadPaperSet = useCallback(async (file: string) => {
    try {
      setLoading(true);
      setError('');
      setSelectedFile(file);
      setSelectedPaper(null);
      setShowResult(false);
      setUserAnswers({});

      const res = await fetch(file);
      if (!res.ok) throw new Error(`加载失败: ${res.status}`);
      const data: ExamPaperSet = await res.json();
      setPaperSet(data);
    } catch (err: any) {
      setError(err?.message || '无法加载试卷数据');
    } finally {
      setLoading(false);
    }
  }, []);

  /** 选择具体试卷 */
  function handleSelectPaper(paper: ExamPaper) {
    setSelectedPaper(paper);
    setCurrentQIndex(0);
    setUserAnswers({});
    setShowResult(false);
  }

  /** 返回试卷选择 */
  function handleBackToPapers() {
    setSelectedPaper(null);
    setShowResult(false);
  }

  /** 返回试卷科目选择 */
  function handleBackToSubjects() {
    setSelectedFile(null);
    setPaperSet(null);
    setSelectedPaper(null);
    setShowResult(false);
  }

  /** 检查答案是否正确 */
  function isAnswerCorrect(q: ExamQuestion): boolean {
    const userAns = userAnswers[q.id];
    if (!userAns) return false;
    return userAns.trim().toLowerCase() === q.answer.trim().toLowerCase();
  }

  // ─── 加载态 ───
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-gray-500">正在加载试卷...</p>
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
          onClick={handleBackToSubjects}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          返回选择
        </button>
      </div>
    );
  }

  // ─── 科目选择视图 ───
  if (!selectedFile) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">📝 真题模拟</h1>
        <p className="text-gray-500 mb-6">选择科目开始模拟考试</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {PAPER_OPTIONS.map((opt) => (
            <div
              key={opt.file}
              onClick={() => loadPaperSet(opt.file)}
              className="bg-white rounded-xl shadow-md border border-gray-100 p-6 cursor-pointer
                hover:border-blue-300 hover:shadow-lg transition-all"
            >
              <div className="text-4xl mb-3">{opt.emoji}</div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">{opt.title}</h3>
              <p className="text-sm text-gray-500">点击开始答题</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── 试卷列表视图 ───
  if (paperSet && !selectedPaper) {
    return (
      <div>
        <button
          onClick={handleBackToSubjects}
          className="mb-4 text-sm text-gray-500 hover:text-blue-500 transition-colors"
        >
          ← 返回科目选择
        </button>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          {paperSet.subject} 真题列表
        </h1>
        <div className="space-y-4">
          {paperSet.papers.map((paper) => (
            <div
              key={paper.id}
              onClick={() => handleSelectPaper(paper)}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer
                hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-800">{paper.paper_name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {paper.questions.length} 题 · {paper.year} 年
                  </p>
                </div>
                <span className="text-gray-300 text-2xl">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── 答题结果视图 ───
  if (selectedPaper && showResult) {
    const correctCount = selectedPaper.questions.filter(isAnswerCorrect).length;
    const totalScore = selectedPaper.questions.reduce(
      (sum, q) => sum + (isAnswerCorrect(q) ? q.score : 0),
      0
    );
    const maxScore = selectedPaper.questions.reduce((sum, q) => sum + q.score, 0);

    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={handleBackToPapers}
          className="mb-4 text-sm text-gray-500 hover:text-blue-500 transition-colors"
        >
          ← 返回试卷列表
        </button>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">{selectedPaper.paper_name}</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-green-600">{correctCount}</p>
              <p className="text-xs text-gray-500">答对题数</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-blue-600">{totalScore}</p>
              <p className="text-xs text-gray-500">得分</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-2xl font-bold text-gray-600">{maxScore}</p>
              <p className="text-xs text-gray-500">满分</p>
            </div>
          </div>
        </div>

        {/* 逐题解析 */}
        <div className="space-y-4">
          {selectedPaper.questions.map((q, idx) => {
            const correct = isAnswerCorrect(q);
            const userAns = userAnswers[q.id] || '未作答';
            return (
              <div
                key={q.id}
                className={`bg-white rounded-xl shadow-sm border p-5 ${
                  correct ? 'border-green-200' : 'border-red-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    correct ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                  }`}>
                    {correct ? '✅ 正确' : '❌ 错误'}
                  </span>
                  <span className="text-xs text-gray-400">
                    第 {idx + 1} 题 · {QUESTION_TYPE_LABELS[q.type] || q.type} · {q.score} 分
                  </span>
                </div>

                <p className="text-gray-800 mb-3">
                  <FormulaText text={q.content} />
                </p>

                {Object.keys(q.options).length > 0 && (
                  <div className="space-y-1 mb-3">
                    {Object.entries(q.options).map(([key, val]) => (
                      <div
                        key={key}
                        className={`text-sm px-3 py-1.5 rounded ${
                          key === q.answer
                            ? 'bg-green-50 text-green-700 font-medium'
                            : key === userAns
                            ? 'bg-red-50 text-red-600'
                            : 'text-gray-600'
                        }`}
                      >
                        <span className="font-bold mr-2">{key}.</span>
                        <FormulaText text={val} />
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-sm space-y-1">
                  <p className="text-gray-600">
                    <span className="font-medium">你的答案：</span>
                    <FormulaText text={userAns} />
                  </p>
                  {!correct && (
                    <p className="text-green-600">
                      <span className="font-medium">正确答案：</span>
                      <FormulaText text={q.answer} />
                    </p>
                  )}
                </div>

                {q.solution && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">解题过程</p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      <FormulaText text={q.solution} />
                    </p>
                  </div>
                )}
                {q.analysis && (
                  <div className="mt-2 bg-blue-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-500 mb-1">考点分析</p>
                    <p className="text-sm text-gray-600">
                      <FormulaText text={q.analysis} />
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setUserAnswers({});
              setShowResult(false);
              setCurrentQIndex(0);
            }}
            className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            重新答题
          </button>
          <button
            onClick={handleBackToPapers}
            className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            返回试卷列表
          </button>
        </div>
      </div>
    );
  }

  // ─── 逐题答题视图 ───
  if (selectedPaper) {
    const currentQ = selectedPaper.questions[currentQIndex];
    const isChoice = currentQ.type === 'choice';
    const hasOptions = Object.keys(currentQ.options).length > 0;
    const isMath = selectedPaper.category.startsWith('math');

    function setAnswer(qid: string, answer: string) {
      setUserAnswers((prev) => ({ ...prev, [qid]: answer }));
    }

    function handleNext() {
      if (currentQIndex < selectedPaper!.questions.length - 1) {
        setCurrentQIndex((i) => i + 1);
      } else {
        setShowResult(true);
      }
    }

    function handlePrev() {
      if (currentQIndex > 0) {
        setCurrentQIndex((i) => i - 1);
      }
    }

    return (
      <div className="max-w-2xl mx-auto">
        <button
          onClick={handleBackToPapers}
          className="mb-4 text-sm text-gray-500 hover:text-blue-500 transition-colors"
        >
          ← 返回试卷列表
        </button>

        {/* 试卷信息 + 进度 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">{selectedPaper.paper_name}</h2>
          <span className="text-sm text-gray-400">
            {currentQIndex + 1} / {selectedPaper.questions.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6 overflow-hidden">
          <div
            className="bg-blue-500 h-full rounded-full transition-all"
            style={{
              width: `${((currentQIndex + 1) / selectedPaper.questions.length) * 100}%`,
            }}
          />
        </div>

        {/* 题目卡片 */}
        <div className={`bg-white rounded-xl shadow-md p-6 border ${isMath ? 'border-orange-100' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium text-gray-500">
              第 {currentQ.number} 题
            </span>
            <span className={`text-xs px-2 py-1 rounded font-medium ${
              isMath ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
            }`}>
              {QUESTION_TYPE_LABELS[currentQ.type] || currentQ.type}
            </span>
            <span className="text-xs text-gray-400">{currentQ.score} 分</span>
          </div>

          {/* 题目内容 — 数学题用 FormulaText 渲染 LaTeX */}
          <div className="mb-6">
            <p className="text-lg text-gray-800">
              {isMath ? <FormulaText text={currentQ.content} /> : currentQ.content}
            </p>
          </div>

          {/* 选择题选项 */}
          {isChoice && hasOptions && (
            <div className="space-y-2">
              {Object.entries(currentQ.options).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setAnswer(currentQ.id, key)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    userAnswers[currentQ.id] === key
                      ? isMath
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="inline-block w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-center leading-7 mr-3 text-sm font-bold">
                    {key}
                  </span>
                  {isMath ? <FormulaText text={val} /> : val}
                </button>
              ))}
            </div>
          )}

          {/* 非选择题 — 输入框 */}
          {!isChoice && (
            <div>
              <input
                type="text"
                value={userAnswers[currentQ.id] || ''}
                onChange={(e) => setAnswer(currentQ.id, e.target.value)}
                placeholder="请输入答案..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none text-lg"
              />
            </div>
          )}
        </div>

        {/* 导航按钮 */}
        <div className="flex justify-between mt-6">
          <button
            onClick={handlePrev}
            disabled={currentQIndex === 0}
            className="px-5 py-2.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
          >
            ← 上一题
          </button>
          <button
            onClick={handleNext}
            className="px-5 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            {currentQIndex < selectedPaper.questions.length - 1 ? '下一题 →' : '提交试卷'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
