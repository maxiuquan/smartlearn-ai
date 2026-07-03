import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { api } from '../api/client';
import { toast } from '../store/toast';
import type { AnswerRecord } from '../types';
import { BookOpen, XCircle, CheckCircle, Clock, ChevronRight, RefreshCw, Brain, AlertTriangle, Lightbulb, Target, Zap, ArrowRight } from 'lucide-react';
import MathRenderer from '../components/MathRenderer';

type ErrorClass = 'concept' | 'method' | 'knowledge_gap' | 'careless';

const CLASSIFICATION_CONFIG: Record<ErrorClass, { label: string; color: string; bg: string; icon: typeof Brain }> = {
  concept: { label: '概念误解', color: 'text-red-600', bg: 'bg-red-100 border-red-300', icon: AlertTriangle },
  method: { label: '方法缺失', color: 'text-blue-600', bg: 'bg-blue-100 border-blue-300', icon: Brain },
  knowledge_gap: { label: '知识缺口', color: 'text-orange-600', bg: 'bg-orange-100 border-orange-300', icon: Target },
  careless: { label: '粗心', color: 'text-yellow-600', bg: 'bg-yellow-100 border-yellow-300', icon: Zap },
};

const FILTER_TABS = [
  { key: 'all' as const, label: '全部' },
  { key: 'concept' as const, label: '概念误解' },
  { key: 'method' as const, label: '方法缺失' },
  { key: 'knowledge_gap' as const, label: '知识缺口' },
  { key: 'careless' as const, label: '粗心' },
];

function loadClassifications(): Record<string, ErrorClass> {
  try {
    return JSON.parse(localStorage.getItem('error_classifications') || '{}');
  } catch {
    return {};
  }
}

function saveClassifications(map: Record<string, ErrorClass>) {
  localStorage.setItem('error_classifications', JSON.stringify(map));
}

function addToRedoQueue(record: AnswerRecord) {
  try {
    const queue = JSON.parse(localStorage.getItem('redo_queue') || '[]');
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);
    queue.push({
      recordId: record.id,
      questionId: record.questionId,
      questionContent: record.questionContent,
      userAnswer: record.userAnswer,
      redoDate: targetDate.toISOString(),
      addedAt: new Date().toISOString(),
    });
    localStorage.setItem('redo_queue', JSON.stringify(queue));
  } catch {
    // silent
  }
}

export default function ErrorAnalysis() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'concept' | 'method' | 'knowledge_gap' | 'careless'>('all');
  const [redoingId, setRedoingId] = useState<number | null>(null);
  const [redoAnswer, setRedoAnswer] = useState('');
  const [redoResult, setRedoResult] = useState<{ correct: boolean } | null>(null);
  const [redoLoading, setRedoLoading] = useState(false);
  const [classifications, setClassifications] = useState<Record<string, ErrorClass>>(loadClassifications);

  const fetchRecords = () => {
    if (!userId) return;
    setLoading(true);
    api.getHistory(userId)
      .then((data) => setRecords(data.records as AnswerRecord[]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRecords(); }, [userId]);

  const handleRedo = async (record: AnswerRecord) => {
    setRedoingId(record.id);
    setRedoAnswer('');
    setRedoResult(null);
  };

  const handleRedoSubmit = async (record: AnswerRecord) => {
    if (!redoAnswer.trim()) return;
    setRedoLoading(true);
    try {
      const solution = await api.getSolution(record.questionId);
      const isCorrect = redoAnswer.trim().toLowerCase() === solution.answer.trim().toLowerCase();
      setRedoResult({ correct: isCorrect });
      if (isCorrect) {
        setRecords(prev => prev.map(r =>
          r.id === record.id ? { ...r, isCorrect: true } : r
        ));
      }
    } catch (err) {
      console.error('获取题目信息失败', err);
    } finally {
      setRedoLoading(false);
    }
  };

  const handleClassify = (recordId: number, cls: ErrorClass) => {
    const updated = { ...classifications, [String(recordId)]: cls };
    setClassifications(updated);
    saveClassifications(updated);
    toast.success(`已分类为：${CLASSIFICATION_CONFIG[cls].label}`);
  };

  const getRecordClass = (record: AnswerRecord): ErrorClass | null => {
    return classifications[String(record.id)] || null;
  };

  const wrongRecords = records.filter(r => !r.isCorrect);
  const redoCount = wrongRecords.filter(r => r.isCorrect).length;
  const pendingRedo = wrongRecords.filter(r => !r.isCorrect).length;

  const filtered = records.filter(r => {
    if (filter === 'all') return !r.isCorrect;
    const cls = getRecordClass(r);
    if (filter === 'concept') return !r.isCorrect && cls === 'concept';
    if (filter === 'method') return !r.isCorrect && cls === 'method';
    if (filter === 'knowledge_gap') return !r.isCorrect && cls === 'knowledge_gap';
    if (filter === 'careless') return !r.isCorrect && cls === 'careless';
    return false;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="text-primary-600" />
          错题精炼本
        </h1>
        <button onClick={fetchRecords} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={18} className="text-gray-400" />
        </button>
      </div>

      <div className="card bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <XCircle className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">总错题</p>
              <p className="text-xl font-bold text-red-700">{wrongRecords.length} 题</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">已重做</p>
              <p className="text-xl font-bold text-green-700">{redoCount} / {wrongRecords.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Clock className="text-orange-600" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">待重做</p>
              <p className="text-xl font-bold text-orange-700">{pendingRedo} 题</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f.key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">太棒了！没有错题。继续保持！</h2>
          <p className="text-gray-500">你已掌握所有做过的题目，学习效果很好</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => {
            const recordClass = getRecordClass(record);
            const clsCfg = recordClass ? CLASSIFICATION_CONFIG[recordClass] : null;
            const hasKnowledgePoint = record.knowledgePoints && record.knowledgePoints.length > 0;

            return (
              <div key={record.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 bg-red-100">
                      <XCircle className="text-red-600" size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 line-clamp-2"><MathRenderer content={record.questionContent} /></p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(record.createdAt).toLocaleString('zh-CN')}
                        </span>
                        {record.timeSpent && (
                          <span className="text-xs text-gray-400">用时 {record.timeSpent}s</span>
                        )}
                      </div>
                      {hasKnowledgePoint && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {record.knowledgePoints.map(kp => (
                            <span key={kp.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {kp.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight
                      size={18}
                      className={`text-gray-400 transition-transform ${expandedId === record.id ? 'rotate-90' : ''}`}
                    />
                  </button>
                </div>

                {record.userAnswer && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <span className="text-gray-400">你的答案：</span>
                    <span className="text-red-600 font-medium">
                      <MathRenderer content={record.userAnswer} />
                    </span>
                  </div>
                )}

                {clsCfg && (
                  <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${clsCfg.bg} ${clsCfg.color}`}>
                    <clsCfg.icon size={12} />
                    {clsCfg.label}
                  </div>
                )}

                {!recordClass && !record.isCorrect && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <Lightbulb size={12} />
                      分类此错误，帮助系统精准推荐练习：
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {(Object.entries(CLASSIFICATION_CONFIG) as [ErrorClass, typeof CLASSIFICATION_CONFIG[ErrorClass]][]).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => handleClassify(record.id, key)}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all hover:scale-105 ${cfg.bg} ${cfg.color}`}
                        >
                          <cfg.icon size={11} className="inline mr-0.5" />
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {hasKnowledgePoint && (
                    <button
                      onClick={() => navigate(`/math?knowledgePointId=${record.knowledgePoints[0].id}`)}
                      className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 flex items-center gap-1"
                    >
                      <Target size={12} />
                      同类题练习
                      <ArrowRight size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      addToRedoQueue(record);
                      toast.success('已加入7天后重做队列');
                    }}
                    className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg font-medium hover:bg-purple-100 flex items-center gap-1"
                  >
                    <Clock size={12} />
                    7天后重做
                  </button>
                </div>

                <div className="mt-3">
                  {redoingId === record.id ? (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={redoAnswer}
                          onChange={(e) => setRedoAnswer(e.target.value)}
                          placeholder="请输入你的答案..."
                          disabled={!!redoResult}
                          className={`flex-1 p-2 border rounded-lg text-sm ${redoResult ? (redoResult.correct ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50') : 'border-gray-200'}`}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRedoSubmit(record); }}
                        />
                        {!redoResult && (
                          <button
                            onClick={() => handleRedoSubmit(record)}
                            disabled={!redoAnswer.trim() || redoLoading}
                            className="btn-primary text-sm px-4 py-2"
                          >
                            {redoLoading ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            ) : (
                              '提交'
                            )}
                          </button>
                        )}
                      </div>
                      {redoResult && (
                        <div className={`p-3 rounded-lg ${redoResult.correct ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            {redoResult.correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
                            {redoResult.correct ? '回答正确！' : '回答错误'}
                          </div>
                          <button
                            onClick={() => { setRedoingId(null); setRedoAnswer(''); setRedoResult(null); }}
                            className="text-xs mt-1 underline opacity-70 hover:opacity-100"
                          >
                            关闭
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRedo(record)}
                      className="text-sm text-primary-600 font-medium hover:underline flex items-center gap-1"
                    >
                      <RefreshCw size={14} />
                      重新作答
                    </button>
                  )}
                </div>

                {expandedId === record.id && record.analysis && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                    <p className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed"><MathRenderer content={record.analysis} /></p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}