import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, BookOpen, Clock, CheckCircle, XCircle, ArrowLeft, BarChart3, ChevronDown, ChevronRight, Lightbulb, Zap, RefreshCw, Sparkles, Pen, Target, AlertTriangle, Bookmark, ArrowDown, Timer } from 'lucide-react';
import MathRenderer from '../components/MathRenderer';
import HandwritingCanvas from '../components/HandwritingCanvas';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';
import type { AiGuessResult } from '../types';

interface ExamQuestion {
  index: number;
  id: number;
  content: string;
  answer: string;
  solution?: string;
  questionType: string;
  options: string[] | null;
  difficulty: number;
  source: string | null;
  knowledgePoints: { id: number; name: string; category: string }[];
}

interface RealExamSource {
  source: string;
  count: number;
  questions: ExamQuestion[];
}

interface ExternalBook {
  name: string;
  publisher: string;
  year: number;
  description: string;
  questionCount: number;
}

interface GenerateForm {
  category: string;
  count: number;
  difficulty: string;
}

export default function MockExam() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'mock' | 'real' | 'external'>('mock');
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [realSources, setRealSources] = useState<RealExamSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<Record<number, { correct: boolean; analysis: string; solution?: string }>>({});
  const [timeLeft, setTimeLeft] = useState(180 * 60);
  const [expandedKp, setExpandedKp] = useState<number | null>(null);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [expandedSolution, setExpandedSolution] = useState<number | null>(null);

  const [externalBooks, setExternalBooks] = useState<ExternalBook[]>([]);
  const [externalQuestions, setExternalQuestions] = useState<ExamQuestion[] | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalBookName, setExternalBookName] = useState<string | null>(null);
  const [externalSubmitted, setExternalSubmitted] = useState(false);
  const [externalResults, setExternalResults] = useState<Record<number, { correct: boolean; analysis: string; solution?: string }>>({});
  const [externalDraft, setExternalDraft] = useState<Record<number, string>>({});
  const [chapter, setChapter] = useState('');
  const [availableChapters, setAvailableChapters] = useState<string[]>([]);

  const [generateForm, setGenerateForm] = useState<GenerateForm>({ category: '全部', count: 10, difficulty: '中等' });
  const [generateQuestions, setGenerateQuestions] = useState<ExamQuestion[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateSubmitted, setGenerateSubmitted] = useState(false);
  const [generateResults, setGenerateResults] = useState<Record<number, { correct: boolean; analysis: string; solution?: string }>>({});
  const [generateDraft, setGenerateDraft] = useState<Record<number, string>>({});

  const [timeUp, setTimeUp] = useState(false);
  const [addedToErrorBook, setAddedToErrorBook] = useState(false);
  const [errorBookCount, setErrorBookCount] = useState(0);
  const [totalTimeLimit, setTotalTimeLimit] = useState(180 * 60);
  const [timeUsed, setTimeUsed] = useState(0);

  const [aiGuess, setAiGuess] = useState<AiGuessResult | null>(null);
  const [aiGuessLoading, setAiGuessLoading] = useState(false);
  const [aiGuessBook, setAiGuessBook] = useState('');
  const { userId } = useAuthStore();

  const urlTab = searchParams.get('tab');
  const urlBook = searchParams.get('book');

  useEffect(() => {
    if (urlTab === 'external') {
      setTab('external');
    }
    if (urlTab === 'real') {
      setTab('real');
    }
  }, [urlTab]);

  const loadMockExam = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/questions/exam/mock');
      const data = await res.json();
      setQuestions(data.questions);
      const limit = data.timeLimit * 60;
      setTimeLeft(limit);
      setTotalTimeLimit(limit);
    } catch (err) {
      console.error('获取模拟卷失败', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRealExam = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/questions/exam/real');
      const data = await res.json();
      setRealSources(data.sources);
    } catch (err) {
      console.error('获取真题失败', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExternalBooks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/questions/books');
      const data = await res.json();
      setExternalBooks(data.books || []);
    } catch (err) {
      console.error('获取书籍列表失败', err);
    } finally {
      setLoading(false);
    }
  };

  const selectExternalBook = async (book: ExternalBook) => {
    setExternalLoading(true);
    setExternalBookName(book.name);
    setChapter('');
    setAvailableChapters([]);
    setAiGuess(null);
    try {
      const params = new URLSearchParams();
      params.set('source', book.name);
      if (chapter) params.set('chapter', chapter);
      const res = await fetch(`/api/questions/external?${params.toString()}`);
      const data = await res.json();
      setExternalQuestions(data.questions || []);
      setAvailableChapters(data.chapters || []);
      setAnswers({});
      setSubmitted(false);
      setResults({});
      setExternalSubmitted(false);
      setExternalResults({});
      setExternalDraft({});
    } catch (err) {
      console.error('获取外部题库失败', err);
    } finally {
      setExternalLoading(false);
    }
  };

  const handleAiGuess = async (bookName: string) => {
    if (!userId) return;
    setAiGuessLoading(true);
    setAiGuessBook(bookName);
    try {
      const res = await fetch(`/api/ai-guess/book/${userId}?book=${encodeURIComponent(bookName)}`);
      const data = await res.json();
      setAiGuess(data);
    } catch (err) {
      console.error('AI猜失败', err);
    } finally {
      setAiGuessLoading(false);
    }
  };

  const selectExternalChapter = async (selectedChapter: string) => {
    setChapter(selectedChapter);
    if (!externalBookName) return;
    setExternalLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('source', externalBookName);
      if (selectedChapter) params.set('chapter', selectedChapter);
      const res = await fetch(`/api/questions/external?${params.toString()}`);
      const data = await res.json();
      setExternalQuestions(data.questions || []);
      setAnswers({});
      setExternalSubmitted(false);
      setExternalResults({});
      setExternalDraft({});
    } catch (err) {
      console.error('获取章节题目失败', err);
    } finally {
      setExternalLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const params = new URLSearchParams();
      if (generateForm.category !== '全部') params.set('category', generateForm.category);
      params.set('count', String(generateForm.count));
      params.set('difficulty', generateForm.difficulty);
      const res = await fetch(`/api/questions/generate?${params.toString()}`);
      const data = await res.json();
      setGenerateQuestions(data.questions || []);
      setAnswers({});
      setGenerateSubmitted(false);
      setGenerateResults({});
      setGenerateDraft({});
    } catch (err) {
      console.error('生成题目失败', err);
    } finally {
      setGenerating(false);
    }
  };

  const submitGenerated = () => {
    setGenerateSubmitted(true);
    setGenerateDraft({});
    const newResults: Record<number, { correct: boolean; analysis: string; solution?: string }> = {};
    for (const q of (generateQuestions || [])) {
      const userAnswer = (answers[q.id] || '').trim().toLowerCase().replace(/\s+/g, '');
      const correctAns = (q.answer || '').trim().toLowerCase().replace(/\s+/g, '');
      const uaNum = parseFloat(userAnswer);
      const caNum = parseFloat(correctAns);
      const isCorrect = (!isNaN(uaNum) && !isNaN(caNum)) ? Math.abs(uaNum - caNum) < 0.001 : userAnswer === correctAns;
      newResults[q.id] = {
        correct: isCorrect,
        analysis: isCorrect ? '回答正确！' : `正确答案为：${q.answer}`,
        solution: q.solution || '',
      };
    }
    setGenerateResults(newResults);
  };

  useEffect(() => {
    if (tab === 'real') {
      loadRealExam();
    }
    if (tab === 'external') {
      loadExternalBooks();
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'external' && urlBook && externalBooks.length > 0) {
      const targetBook = externalBooks.find(b =>
        b.name.includes(urlBook) || urlBook.includes(b.name)
      );
      if (targetBook) {
        selectExternalBook(targetBook);
      }
    }
  }, [tab, urlBook, externalBooks]);

  useEffect(() => {
    if (!examStarted || submitted || timeUp || questions.length === 0) return;
    if (timeLeft <= 0) {
      setTimeUp(true);
      setTimeUsed(totalTimeLimit);
      submitExam();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [examStarted, submitted, timeUp, timeLeft, questions.length, totalTimeLimit]);

  const startMockExam = () => {
    loadMockExam();
    setExamStarted(true);
    setCurrentIndex(0);
    setAnswers({});
    setSubmitted(false);
    setResults({});
    setExpandedSolution(null);
    setTimeUp(false);
    setAddedToErrorBook(false);
    setErrorBookCount(0);
    setTimeUsed(0);
  };

  const handleAnswer = (questionId: number, answer: string) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const submitExam = () => {
    setSubmitted(true);
    setTimeUsed(totalTimeLimit - timeLeft);
    const newResults: Record<number, { correct: boolean; analysis: string; solution?: string }> = {};
    for (const q of questions) {
      const userAnswer = (answers[q.id] || '').trim().toLowerCase().replace(/\s+/g, '');
      const correctAns = (q.answer || '').trim().toLowerCase().replace(/\s+/g, '');
      const uaNum = parseFloat(userAnswer);
      const caNum = parseFloat(correctAns);
      const isCorrect = (!isNaN(uaNum) && !isNaN(caNum)) ? Math.abs(uaNum - caNum) < 0.001 : userAnswer === correctAns;
      newResults[q.id] = {
        correct: isCorrect,
        analysis: isCorrect ? '回答正确！' : `正确答案为：${q.answer}`,
        solution: q.solution || '',
      };
    }
    setResults(newResults);
  };

  const submitExternal = () => {
    setExternalSubmitted(true);
    setExternalDraft({});
    const newResults: Record<number, { correct: boolean; analysis: string; solution?: string }> = {};
    for (const q of (externalQuestions || [])) {
      const userAnswer = (answers[q.id] || '').trim().toLowerCase().replace(/\s+/g, '');
      const correctAns = (q.answer || '').trim().toLowerCase().replace(/\s+/g, '');
      const uaNum = parseFloat(userAnswer);
      const caNum = parseFloat(correctAns);
      const isCorrect = (!isNaN(uaNum) && !isNaN(caNum)) ? Math.abs(uaNum - caNum) < 0.001 : userAnswer === correctAns;
      newResults[q.id] = {
        correct: isCorrect,
        analysis: isCorrect ? '回答正确！' : `正确答案为：${q.answer}`,
        solution: q.solution || '',
      };
    }
    setExternalResults(newResults);
  };

  const correctCount = Object.values(results).filter(r => r.correct).length;
  const totalAnswered = Object.keys(answers).length;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getKpBreakdown = () => {
    const kpMap = new Map<number, { name: string; category: string; correct: number; total: number }>();
    for (const q of questions) {
      for (const kp of q.knowledgePoints) {
        if (!kpMap.has(kp.id)) {
          kpMap.set(kp.id, { name: kp.name, category: kp.category, correct: 0, total: 0 });
        }
        const entry = kpMap.get(kp.id)!;
        entry.total++;
        if (results[q.id]?.correct) {
          entry.correct++;
        }
      }
    }
    return Array.from(kpMap.entries()).map(([id, data]) => ({
      id,
      ...data,
      accuracy: data.total > 0 ? data.correct / data.total : 0,
    }));
  };

  const saveToErrorBook = () => {
    const wrongQuestions = questions.filter(q => results[q.id] && !results[q.id].correct);
    if (wrongQuestions.length === 0) return;
    try {
      const existing = JSON.parse(localStorage.getItem('exam_errors') || '[]');
      const now = new Date().toISOString();
      const newEntries = wrongQuestions.map(q => ({
        questionId: q.id,
        content: q.content,
        answer: q.answer,
        userAnswer: answers[q.id] || '',
        solution: q.solution || '',
        knowledgePoints: q.knowledgePoints,
        addedAt: now,
        examType: 'mock',
      }));
      const merged = [...existing, ...newEntries];
      localStorage.setItem('exam_errors', JSON.stringify(merged));
      setErrorBookCount(newEntries.length);
      setAddedToErrorBook(true);
      toast.success(`已添加 ${newEntries.length} 题到错题精炼本`);
    } catch {
      toast.error('添加失败，请重试');
    }
  };

  const getQuestionStatus = (q: ExamQuestion) => {
    if (results[q.id]) {
      return results[q.id].correct ? 'correct' : 'incorrect';
    }
    if (answers[q.id] !== undefined) return 'answered';
    return 'unanswered';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="text-primary-600" />
          真题与模拟
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setTab('mock'); setExamStarted(false); setSubmitted(false); setGenerateQuestions(null); setGenerateSubmitted(false); setExpandedSolution(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'mock' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            模拟卷
          </button>
          <button
            onClick={() => { setTab('real'); setExamStarted(false); setSubmitted(false); setExpandedSolution(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'real' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            历年真题
          </button>
          <button
            onClick={() => { setTab('external'); setExamStarted(false); setSubmitted(false); setExternalQuestions(null); setExternalBookName(null); setExpandedSolution(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'external' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            外部题库
          </button>
        </div>
      </div>

      {tab === 'mock' && !examStarted && !generateQuestions && (
        <div className="space-y-6">
          <div className="card text-center py-12 space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center">
              <FileText className="text-primary-600" size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">模拟考试</h2>
              <p className="text-gray-500 mt-2 max-w-md mx-auto">
                系统将随机生成一套模拟试卷，包含选择题、填空题和解答题，限时180分钟
              </p>
            </div>
            <div className="flex items-center justify-center gap-8 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <BookOpen size={16} />
                <span>约22题</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span>180 分钟</span>
              </div>
              <div className="flex items-center gap-1">
                <Target size={16} />
                <span>综合检测</span>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left max-w-md mx-auto">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={16} className="text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">考试提示</span>
              </div>
              <ul className="text-xs text-amber-700 space-y-1.5">
                <li>• 选择题点击选项即可作答，填空题和解答题在输入框中输入答案</li>
                <li>• 可使用草稿纸功能进行演算</li>
                <li>• 时间结束后系统将自动交卷</li>
                <li>• 提交后可查看每道题的解析和知识点</li>
              </ul>
            </div>
            <button onClick={startMockExam} className="btn-primary text-lg px-10 py-4 shadow-lg shadow-primary-200" disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                  生成试卷中...
                </>
              ) : (
                <>
                  <Zap size={20} className="mr-1" />
                  开始考试
                </>
              )}
            </button>
          </div>

          <div className="card space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary-600" size={20} />
              <h2 className="text-lg font-bold text-gray-900">智能生成题目</h2>
            </div>
            <p className="text-sm text-gray-500">根据你的需求，AI 智能生成针对性练习题</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">科目分类</label>
                <select
                  value={generateForm.category}
                  onChange={(e) => setGenerateForm(prev => ({ ...prev, category: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="全部">全部</option>
                  <option value="高等数学">高等数学</option>
                  <option value="线性代数">线性代数</option>
                  <option value="概率论">概率论</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">题目数量</label>
                <select
                  value={generateForm.count}
                  onChange={(e) => setGenerateForm(prev => ({ ...prev, count: Number(e.target.value) }))}
                  className="input-field w-full"
                >
                  <option value={5}>5 题</option>
                  <option value={10}>10 题</option>
                  <option value={20}>20 题</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">难度等级</label>
                <select
                  value={generateForm.difficulty}
                  onChange={(e) => setGenerateForm(prev => ({ ...prev, difficulty: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="简单">简单</option>
                  <option value="中等">中等</option>
                  <option value="困难">困难</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary flex items-center gap-2"
            >
              {generating ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  智能生成题目
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {tab === 'mock' && !examStarted && generateQuestions && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setGenerateQuestions(null); setGenerateSubmitted(false); setAnswers({}); }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft size={16} />
                返回
              </button>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="text-primary-600" size={20} />
                智能生成题目
              </h2>
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">
                {generateForm.category} · {generateForm.difficulty} · {generateQuestions.length}题
              </span>
            </div>
            {!generateSubmitted && (
              <button onClick={submitGenerated} className="btn-primary text-sm">
                提交
              </button>
            )}
          </div>

          {generateSubmitted && (
            <div className="card bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
                    <BarChart3 className="text-primary-600" size={28} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">练习结果</h3>
                    <p className="text-sm text-gray-500">
                      正确 {Object.values(generateResults).filter(r => r.correct).length} / {generateQuestions.length} 题
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary-600">
                    {generateQuestions.length > 0 ? Math.round((Object.values(generateResults).filter(r => r.correct).length / generateQuestions.length) * 100) : 0}
                  </div>
                  <div className="text-xs text-gray-400">得分</div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {generateQuestions.map((q, idx) => (
              <div key={q.id} className={`card ${generateResults[q.id] ? (generateResults[q.id].correct ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30') : ''}`}>
                <div className="flex items-start gap-4">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${generateResults[q.id] ? (generateResults[q.id].correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-primary-100 text-primary-700'}`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${q.questionType === 'choice' ? 'bg-blue-100 text-blue-700' : q.questionType === 'fill_in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {q.questionType === 'choice' ? '选择' : q.questionType === 'fill_in' ? '填空' : '解答'}
                      </span>
                      <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded flex items-center gap-1">
                        <Zap size={10} />
                        来源：智能生成
                      </span>
                    </div>
                    <p className="text-gray-800"><MathRenderer content={q.content} /></p>

                    {q.questionType === 'choice' && q.options && (
                      <div className="space-y-2">
                        {q.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleAnswer(q.id, opt)}
                            disabled={generateSubmitted}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              answers[q.id] === opt
                                ? generateSubmitted
                                  ? generateResults[q.id]?.correct ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
                                  : 'border-primary-400 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span className="text-sm">{String.fromCharCode(65 + i)}. {opt}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {(q.questionType === 'fill_in' || q.questionType === 'essay') && (
                      <div>
                        <input
                          type="text"
                          value={answers[q.id] || ''}
                          onChange={(e) => handleAnswer(q.id, e.target.value)}
                          disabled={generateSubmitted}
                          placeholder={q.questionType === 'essay' ? '请输入解答过程或答案...' : '请输入答案...'}
                          className={`w-full p-3 border rounded-lg text-sm ${generateResults[q.id] ? (generateResults[q.id].correct ? 'border-green-400' : 'border-red-400') : 'border-gray-200'}`}
                        />
                      </div>
                    )}

                    {!generateSubmitted && (
                      <details className="mt-3">
                        <summary className="flex items-center gap-1 text-xs font-medium text-gray-500 cursor-pointer hover:text-primary-600">
                          <Pen size={14} />
                          草稿纸
                        </summary>
                        <div className="mt-2">
                          <HandwritingCanvas
                            className="h-48"
                            onExport={(dataUrl) => setGenerateDraft(prev => ({ ...prev, [q.id]: dataUrl }))}
                          />
                          {generateDraft[q.id] && (
                            <div className="mt-2">
                              <img src={generateDraft[q.id]} alt="草稿" className="max-h-32 rounded border" />
                            </div>
                          )}
                        </div>
                      </details>
                    )}

                    {generateSubmitted && generateResults[q.id] && (
                      <div className={`p-3 rounded-lg ${generateResults[q.id].correct ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        <div className="flex items-center gap-2 text-sm font-medium mb-1">
                          {generateResults[q.id].correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                          {generateResults[q.id].correct ? '回答正确' : '回答错误'}
                        </div>
                        {generateResults[q.id].analysis && (
                          <p className="text-xs mt-1 opacity-80">{generateResults[q.id].analysis}</p>
                        )}
                        {generateResults[q.id].solution && (
                          <div className="mt-2">
                            <button
                              onClick={() => setExpandedSolution(expandedSolution === q.id ? null : q.id)}
                              className="flex items-center gap-1 text-xs font-medium text-inherit hover:opacity-80"
                            >
                              <Lightbulb size={12} />
                              解题步骤
                              <ChevronDown size={12} className={`transition-transform ${expandedSolution === q.id ? 'rotate-180' : ''}`} />
                            </button>
                            {expandedSolution === q.id && (
                              <div className="mt-2 p-3 bg-white/60 rounded-lg text-xs leading-relaxed">
                                <MathRenderer content={generateResults[q.id].solution!} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {q.knowledgePoints.length > 0 && (
                      <div>
                        <button
                          onClick={() => setExpandedKp(expandedKp === q.id ? null : q.id)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                        >
                          <Lightbulb size={12} />
                          涉及 {q.knowledgePoints.length} 个知识点
                          <ChevronDown size={12} className={`transition-transform ${expandedKp === q.id ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedKp === q.id && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {q.knowledgePoints.map(kp => (
                              <span key={kp.id} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                                {kp.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {generateSubmitted && (
            <div className="flex justify-center gap-4">
              <button onClick={handleGenerate} className="btn-primary flex items-center gap-2">
                <RefreshCw size={16} />
                重新生成
              </button>
              <button onClick={() => { setGenerateQuestions(null); setGenerateSubmitted(false); }} className="btn-secondary">
                返回设置
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'external' && (
        <div className="space-y-4">
          {externalQuestions ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setExternalQuestions(null); setExternalBookName(null); setAnswers({}); setExternalSubmitted(false); setExternalResults({}); setChapter(''); setAvailableChapters([]); }}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft size={16} />
                    返回书单
                  </button>
                  <h2 className="text-lg font-bold text-gray-900">{externalBookName}</h2>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                    {externalQuestions.length} 题
                  </span>
                </div>
                {!externalSubmitted && externalQuestions.length > 0 && (
                  <button onClick={submitExternal} className="btn-primary text-sm">
                    提交
                  </button>
                )}
              </div>

              {availableChapters.length > 0 && (
                <div className="card">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <BookOpen size={14} />
                      按章学习：
                    </label>
                    <select
                      value={chapter}
                      onChange={(e) => selectExternalChapter(e.target.value)}
                      className="input-field text-sm w-48"
                    >
                      <option value="">全部章节</option>
                      {availableChapters.map(ch => (
                        <option key={ch} value={ch}>{ch}</option>
                      ))}
                    </select>
                    {chapter && (
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                        当前：{chapter}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {externalSubmitted && externalQuestions.length > 0 && (
                <div className="card bg-gradient-to-r from-primary-50 to-blue-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
                        <BarChart3 className="text-primary-600" size={28} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">练习结果</h3>
                        <p className="text-sm text-gray-500">
                          正确 {Object.values(externalResults).filter(r => r.correct).length} / {externalQuestions.length} 题
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-primary-600">
                        {externalQuestions.length > 0 ? Math.round((Object.values(externalResults).filter(r => r.correct).length / externalQuestions.length) * 100) : 0}
                      </div>
                      <div className="text-xs text-gray-400">得分</div>
                    </div>
                  </div>
                </div>
              )}

              {loading || externalLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
                </div>
              ) : externalQuestions.length === 0 ? (
                <div className="card text-center py-12">
                  <div className="text-6xl">📖</div>
                  <h2 className="text-xl font-bold text-gray-900 mt-4">暂无题目</h2>
                  <p className="text-gray-500 mt-2">该书籍暂无可用题目</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {externalQuestions.map((q, idx) => (
                    <div key={q.id} className={`card ${externalResults[q.id] ? (externalResults[q.id].correct ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30') : ''}`}>
                      <div className="flex items-start gap-4">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${externalResults[q.id] ? (externalResults[q.id].correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-primary-100 text-primary-700'}`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${q.questionType === 'choice' ? 'bg-blue-100 text-blue-700' : q.questionType === 'fill_in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                              {q.questionType === 'choice' ? '选择' : q.questionType === 'fill_in' ? '填空' : '解答'}
                            </span>
                            {q.source && (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">{q.source}</span>
                            )}
                          </div>
                          <p className="text-gray-800"><MathRenderer content={q.content} /></p>

                          {q.questionType === 'choice' && q.options && (
                            <div className="space-y-2">
                              {q.options.map((opt, i) => (
                                <button
                                  key={i}
                                  onClick={() => handleAnswer(q.id, opt)}
                                  disabled={externalSubmitted}
                                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                    answers[q.id] === opt
                                      ? externalSubmitted
                                        ? externalResults[q.id]?.correct ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
                                        : 'border-primary-400 bg-primary-50'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <span className="text-sm">{String.fromCharCode(65 + i)}. {opt}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {(q.questionType === 'fill_in' || q.questionType === 'essay') && (
                            <div>
                              <input
                                type="text"
                                value={answers[q.id] || ''}
                                onChange={(e) => handleAnswer(q.id, e.target.value)}
                                disabled={externalSubmitted}
                                placeholder={q.questionType === 'essay' ? '请输入解答过程或答案...' : '请输入答案...'}
                                className={`w-full p-3 border rounded-lg text-sm ${externalResults[q.id] ? (externalResults[q.id].correct ? 'border-green-400' : 'border-red-400') : 'border-gray-200'}`}
                              />
                            </div>
                          )}

                          {!externalSubmitted && (
                             <details className="mt-3">
                               <summary className="flex items-center gap-1 text-xs font-medium text-gray-500 cursor-pointer hover:text-primary-600">
                                 <Pen size={14} />
                                 草稿纸
                                </summary>
                                <div className="mt-2">
                                  <HandwritingCanvas
                                    className="h-48"
                                    onExport={(dataUrl) => setExternalDraft(prev => ({ ...prev, [q.id]: dataUrl }))}
                                  />
                                  {externalDraft[q.id] && (
                                  <div className="mt-2">
                                    <img src={externalDraft[q.id]} alt="草稿" className="max-h-32 rounded border" />
                                  </div>
                                )}
                              </div>
                            </details>
                          )}

                          {externalSubmitted && externalResults[q.id] && (
                            <div className={`p-3 rounded-lg ${externalResults[q.id].correct ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                                {externalResults[q.id].correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                {externalResults[q.id].correct ? '回答正确' : '回答错误'}
                              </div>
                              {externalResults[q.id].analysis && (
                                <p className="text-xs mt-1 opacity-80">{externalResults[q.id].analysis}</p>
                              )}
                              {externalResults[q.id].solution && (
                                <div className="mt-2">
                                  <button
                                    onClick={() => setExpandedSolution(expandedSolution === q.id ? null : q.id)}
                                    className="flex items-center gap-1 text-xs font-medium text-inherit hover:opacity-80"
                                  >
                                    <Lightbulb size={12} />
                                    解题步骤
                                    <ChevronDown size={12} className={`transition-transform ${expandedSolution === q.id ? 'rotate-180' : ''}`} />
                                  </button>
                                  {expandedSolution === q.id && (
                                    <div className="mt-2 p-3 bg-white/60 rounded-lg text-xs leading-relaxed">
                                      <MathRenderer content={externalResults[q.id].solution!} />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {q.knowledgePoints.length > 0 && (
                            <div>
                              <button
                                onClick={() => setExpandedKp(expandedKp === q.id ? null : q.id)}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                              >
                                <Lightbulb size={12} />
                                涉及 {q.knowledgePoints.length} 个知识点
                                <ChevronDown size={12} className={`transition-transform ${expandedKp === q.id ? 'rotate-180' : ''}`} />
                              </button>
                              {expandedKp === q.id && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {q.knowledgePoints.map(kp => (
                                    <span key={kp.id} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                                      {kp.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
                </div>
              ) : externalBooks.length === 0 ? (
                <div className="card text-center py-12">
                  <div className="text-6xl">📚</div>
                  <h2 className="text-xl font-bold text-gray-900 mt-4">外部题库</h2>
                  <p className="text-gray-500 mt-2">暂无可用书籍</p>
                </div>
              ) : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {externalBooks.map((book) => (
                    <div key={book.name} className="card flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-gray-900 leading-tight">{book.name}</h3>
                          <BookOpen className="text-primary-400 shrink-0" size={18} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{book.publisher}</span>
                          <span>·</span>
                          <span>{book.year}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{book.description}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <FileText size={12} />
                          <span>{book.questionCount} 道题目</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => selectExternalBook(book)}
                          disabled={externalLoading}
                          className="btn-primary text-sm flex-1"
                        >
                          {externalLoading ? '加载中...' : '选择此书'}
                        </button>
                        <button
                          onClick={() => handleAiGuess(book.name)}
                          disabled={aiGuessLoading}
                          className="btn-secondary text-sm flex items-center gap-1"
                          title="AI预测哪些题目你会做"
                        >
                          <Target size={14} />
                          AI猜
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {aiGuess && aiGuessBook && (
                  <div className="card border-l-4 border-l-purple-400 bg-purple-50/50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Target className="text-purple-600" size={18} />
                        AI猜 · {aiGuess.bookName}
                      </h3>
                      <span className="text-sm text-purple-700 font-medium">{aiGuess.estimatedTimeSaved}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-green-100 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-green-700">{aiGuess.summary.canSkip}</div>
                        <div className="text-xs text-green-600 mt-1">🟢 可跳过</div>
                      </div>
                      <div className="bg-orange-100 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-orange-700">{aiGuess.summary.shouldDo}</div>
                        <div className="text-xs text-orange-600 mt-1">🟠 建议做</div>
                      </div>
                      <div className="bg-red-100 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-red-700">{aiGuess.summary.mustReview}</div>
                        <div className="text-xs text-red-600 mt-1">🔴 需复习</div>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {aiGuess.prediction.slice(0, 10).map((item) => (
                        <div key={item.questionId} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                          item.prediction === 'green' ? 'bg-green-100/50' :
                          item.prediction === 'orange' ? 'bg-orange-100/50' : 'bg-red-100/50'
                        }`}>
                          <span className={
                            item.prediction === 'green' ? 'text-green-600' :
                            item.prediction === 'orange' ? 'text-orange-600' : 'text-red-600'
                          }>
                            {item.prediction === 'green' ? '🟢' : item.prediction === 'orange' ? '🟠' : '🔴'}
                          </span>
                          <span className="flex-1 text-gray-700 truncate">{item.content}</span>
                          <span className="text-xs text-gray-400">{Math.round(item.confidence)}%</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      AI根据你的知识掌握度预测各题正确率，绿色题目可直接跳过
                    </p>
                  </div>
                )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'real' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : realSources.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-6xl">📚</div>
              <h2 className="text-xl font-bold text-gray-900 mt-4">历年真题</h2>
              <p className="text-gray-500 mt-2">暂无真题数据</p>
            </div>
          ) : (
            realSources.map((src) => (
              <div key={src.source} className="card">
                <button
                  onClick={() => setExpandedSource(expandedSource === src.source ? null : src.source)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                      <FileText className="text-red-600" size={20} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{src.source}</h3>
                      <p className="text-xs text-gray-400">{src.count} 道真题</p>
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    className={`text-gray-400 transition-transform ${expandedSource === src.source ? 'rotate-90' : ''}`}
                  />
                </button>

                {expandedSource === src.source && (
                  <div className="mt-4 space-y-3">
                    {src.questions.map((q) => (
                      <div key={q.id} className="border border-gray-100 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded ${q.questionType === 'choice' ? 'bg-blue-100 text-blue-700' : q.questionType === 'fill_in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {q.questionType === 'choice' ? '选择题' : q.questionType === 'fill_in' ? '填空题' : '解答题'}
                              </span>
                              <span className="text-xs text-gray-400">
                                {'★'.repeat(q.difficulty)}{'☆'.repeat(3 - q.difficulty)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700"><MathRenderer content={q.content} /></p>
                            {q.knowledgePoints.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {q.knowledgePoints.map(kp => (
                                  <span key={kp.id} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                                    {kp.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'mock' && examStarted && (
        <div className="space-y-6">
          {timeUp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4 animate-scale-in">
                <div className="text-5xl">⏰</div>
                <h2 className="text-xl font-bold text-gray-900">时间到！</h2>
                <p className="text-gray-500">考试已自动交卷，请查看考试结果</p>
                <button
                  onClick={() => setTimeUp(false)}
                  className="btn-primary w-full"
                >
                  查看结果
                </button>
              </div>
            </div>
          )}

          {!submitted && (
            <div className="card sticky top-0 z-10 bg-white/95 backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    已答 {totalAnswered} / {questions.length} 题
                  </span>
                  <div className="w-48 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-primary-500 transition-all"
                      style={{ width: `${(totalAnswered / questions.length) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`flex items-center gap-1.5 ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-gray-700'}`}>
                    <span className="text-xs font-medium text-gray-400">考试剩余时间</span>
                    <Timer size={14} />
                    <span className={`font-mono font-bold ${timeLeft < 300 ? 'text-xl' : 'text-base'}`}>
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                  <button
                    onClick={submitExam}
                    className="btn-primary text-sm"
                  >
                    交卷
                  </button>
                </div>
              </div>
            </div>
          )}

          {!submitted && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Bookmark size={14} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-500">答题卡</span>
                <span className="text-xs text-gray-400 ml-auto">
                  <span className="inline-block w-3 h-3 rounded bg-green-500 mr-1 align-middle"></span>正确
                  <span className="inline-block w-3 h-3 rounded bg-red-500 ml-2 mr-1 align-middle"></span>错误
                  <span className="inline-block w-3 h-3 rounded bg-gray-200 ml-2 mr-1 align-middle"></span>未答
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {questions.map((q, idx) => {
                  const status = getQuestionStatus(q);
                  const statusColor = status === 'correct' ? 'bg-green-500 text-white' :
                    status === 'incorrect' ? 'bg-red-500 text-white' :
                    status === 'answered' ? 'bg-primary-200 text-primary-700' :
                    'bg-gray-100 text-gray-500';
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-9 h-9 rounded-lg text-xs font-medium transition-all hover:scale-110 ${statusColor} ${currentIndex === idx ? 'ring-2 ring-primary-400 ring-offset-1' : ''}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {submitted && (
            <>
              <div className="card bg-gradient-to-r from-primary-50 to-blue-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
                      <BarChart3 className="text-primary-600" size={28} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">考试结果</h3>
                      <p className="text-sm text-gray-500">
                        得分 {correctCount}/{questions.length}（{Math.round((correctCount / questions.length) * 100)}%）
                      </p>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Timer size={12} />
                        用时 {formatTime(timeUsed)} / {formatTime(totalTimeLimit)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary-600">{Math.round((correctCount / questions.length) * 100)}</div>
                    <div className="text-xs text-gray-400">得分</div>
                  </div>
                </div>
              </div>

              {(() => {
                const kpBreakdown = getKpBreakdown();
                const weakKps = kpBreakdown.filter(kp => kp.accuracy < 0.6);
                return (
                  <>
                    {kpBreakdown.length > 0 && (
                      <div className="card">
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <BookOpen size={16} className="text-primary-600" />
                          知识点掌握情况
                        </h3>
                        <div className="space-y-2">
                          {kpBreakdown.map(kp => (
                            <div key={kp.id} className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-700 truncate">{kp.name}</span>
                                  <span className="text-xs text-gray-400">{kp.correct}/{kp.total}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${kp.accuracy >= 0.8 ? 'bg-green-500' : kp.accuracy >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${kp.accuracy * 100}%` }}
                                  />
                                </div>
                              </div>
                              <span className={`text-xs font-semibold ml-3 w-10 text-right ${kp.accuracy >= 0.8 ? 'text-green-600' : kp.accuracy >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {Math.round(kp.accuracy * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {weakKps.length > 0 && (
                      <div className="card border-l-4 border-l-red-400 bg-red-50/50">
                        <div className="flex items-center gap-2 mb-3">
                          <ArrowDown size={16} className="text-red-600" />
                          <h3 className="text-sm font-bold text-red-800">薄弱知识点</h3>
                          <span className="text-xs text-red-500">准确率低于 60%</span>
                        </div>
                        <div className="space-y-2">
                          {weakKps.map(kp => (
                            <div key={kp.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <AlertTriangle size={14} className="text-red-500" />
                                <div>
                                  <span className="text-sm font-medium text-gray-800">{kp.name}</span>
                                  <span className="text-xs text-gray-400 ml-2">{kp.correct}/{kp.total} 正确</span>
                                </div>
                              </div>
                              <button
                                onClick={() => navigate(`/math?knowledgePointId=${kp.id}`)}
                                className="btn-primary text-xs px-3 py-1.5"
                              >
                                去练习
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {!addedToErrorBook && correctCount < questions.length && (
                <div className="card text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Bookmark size={16} />
                    <span className="text-sm">将错题加入错题精炼本，精准巩固薄弱环节</span>
                  </div>
                  <button onClick={saveToErrorBook} className="btn-primary">
                    <Bookmark size={16} className="mr-1" />
                    加入错题本
                  </button>
                </div>
              )}

              {addedToErrorBook && (
                <div className="card bg-green-50 border-green-200 text-center">
                  <div className="flex items-center justify-center gap-2 text-green-700">
                    <CheckCircle size={18} />
                    <span className="font-medium">已添加 {errorBookCount} 题到错题精炼本</span>
                  </div>
                </div>
              )}
            </>
          )}

          {submitted && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Bookmark size={14} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-500">答题卡</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {questions.map((q, idx) => {
                  const status = getQuestionStatus(q);
                  const statusColor = status === 'correct' ? 'bg-green-500 text-white' :
                    status === 'incorrect' ? 'bg-red-500 text-white' :
                    'bg-gray-100 text-gray-500';
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-9 h-9 rounded-lg text-xs font-medium transition-all hover:scale-110 ${statusColor}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div id={`question-${idx}`} key={q.id} className={`card ${results[q.id] ? (results[q.id].correct ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30') : ''} ${!submitted && currentIndex === idx ? 'ring-2 ring-primary-300' : ''}`}>
                <div className="flex items-start gap-4">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${results[q.id] ? (results[q.id].correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-primary-100 text-primary-700'}`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${q.questionType === 'choice' ? 'bg-blue-100 text-blue-700' : q.questionType === 'fill_in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {q.questionType === 'choice' ? '选择' : q.questionType === 'fill_in' ? '填空' : '解答'}
                      </span>
                      {q.source && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">{q.source}</span>
                      )}
                    </div>
                    <p className="text-gray-800"><MathRenderer content={q.content} /></p>

                    {q.questionType === 'choice' && q.options && (
                      <div className="space-y-2">
                        {q.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleAnswer(q.id, opt)}
                            disabled={submitted}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              answers[q.id] === opt
                                ? submitted
                                  ? results[q.id]?.correct ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
                                  : 'border-primary-400 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span className="text-sm">{String.fromCharCode(65 + i)}. {opt}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {(q.questionType === 'fill_in' || q.questionType === 'essay') && (
                      <div>
                        <input
                          type="text"
                          value={answers[q.id] || ''}
                          onChange={(e) => handleAnswer(q.id, e.target.value)}
                          disabled={submitted}
                          placeholder={q.questionType === 'essay' ? '请输入解答过程或答案...' : '请输入答案...'}
                          className={`w-full p-3 border rounded-lg text-sm ${results[q.id] ? (results[q.id].correct ? 'border-green-400' : 'border-red-400') : 'border-gray-200'}`}
                        />
                      </div>
                    )}

                    {submitted && results[q.id] && (
                      <div className={`p-3 rounded-lg ${results[q.id].correct ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        <div className="flex items-center gap-2 text-sm font-medium mb-1">
                          {results[q.id].correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                          {results[q.id].correct ? '回答正确' : '回答错误'}
                        </div>
                        {results[q.id].analysis && (
                          <p className="text-xs mt-1 opacity-80">{results[q.id].analysis}</p>
                        )}
                        {results[q.id].solution && (
                          <div className="mt-2">
                            <button
                              onClick={() => setExpandedSolution(expandedSolution === q.id ? null : q.id)}
                              className="flex items-center gap-1 text-xs font-medium text-inherit hover:opacity-80"
                            >
                              <Lightbulb size={12} />
                              解题步骤
                              <ChevronDown size={12} className={`transition-transform ${expandedSolution === q.id ? 'rotate-180' : ''}`} />
                            </button>
                            {expandedSolution === q.id && (
                              <div className="mt-2 p-3 bg-white/60 rounded-lg text-xs leading-relaxed">
                                <MathRenderer content={results[q.id].solution!} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {q.knowledgePoints.length > 0 && (
                      <div>
                        <button
                          onClick={() => setExpandedKp(expandedKp === q.id ? null : q.id)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                        >
                          <Lightbulb size={12} />
                          涉及 {q.knowledgePoints.length} 个知识点
                          <ChevronDown size={12} className={`transition-transform ${expandedKp === q.id ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedKp === q.id && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {q.knowledgePoints.map(kp => (
                              <span key={kp.id} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                                {kp.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {submitted && (
            <div className="flex justify-center gap-4">
              <button onClick={startMockExam} className="btn-primary">再做一套</button>
              <button onClick={() => navigate('/chapters')} className="btn-secondary">返回章节学习</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}