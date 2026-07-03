import { useEffect, useState, useCallback } from 'react';
import { BookOpen, Lightbulb, AlertTriangle, ArrowRight, CheckCircle, Pen, Save, X } from 'lucide-react';
import MathRenderer from './MathRenderer';
import { useAuthStore } from '../store/auth';

interface KPData {
  id: number;
  name: string;
  category: string;
  chapter: string;
  description: string;
  difficulty: number;
  questionCount: number;
  prerequisites: { prerequisite: { id: number; name: string } }[];
  prerequisiteOf: { id: number; name: string }[];
}

interface PrereqInfo {
  id: number;
  name: string;
  masteryLevel: number;
}

interface ErrorPattern {
  classification: 'misconception' | 'careless' | 'knowledge_gap' | 'method_missing';
  pattern: string;
  occurrences: number;
  rootCauseHypothesis: string;
}

interface KnowledgeCardProps {
  knowledgePointId: number;
  onStartPractice?: (kpId: number) => void;
  onClose?: () => void;
  compact?: boolean;
}

const CLASSIFICATION_LABEL: Record<string, string> = {
  misconception: '概念误解',
  careless: '粗心大意',
  knowledge_gap: '知识缺口',
  method_missing: '方法缺失',
};

export default function KnowledgeCard({ knowledgePointId, onStartPractice, onClose, compact = false }: KnowledgeCardProps) {
  const userId = useAuthStore((s) => s.userId);
  const [kpData, setKpData] = useState<KPData | null>(null);
  const [prerequisites, setPrerequisites] = useState<PrereqInfo[]>([]);
  const [standardSteps, setStandardSteps] = useState<string[]>([]);
  const [errorPatterns, setErrorPatterns] = useState<ErrorPattern[]>([]);
  const [note, setNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [errorsLoading, setErrorsLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`kp_note_${knowledgePointId}`);
    if (saved) setNote(saved);
  }, [knowledgePointId]);

  const fetchKPData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/knowledge/point/${knowledgePointId}`);
      if (!res.ok) return;
      const data: KPData = await res.json();
      setKpData(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [knowledgePointId]);

  const fetchPrerequisites = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/knowledge/prerequisites/${knowledgePointId}?userId=${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.prerequisites && Array.isArray(data.prerequisites)) {
        setPrerequisites(
          data.prerequisites
            .filter((p: PrereqInfo) => p.id !== knowledgePointId)
            .map((p: PrereqInfo) => ({ id: p.id, name: p.name, masteryLevel: p.masteryLevel ?? 0 }))
        );
      }
    } catch {
      /* ignore */
    }
  }, [knowledgePointId, userId]);

  const fetchStandardSteps = useCallback(async () => {
    setStepsLoading(true);
    try {
      const qRes = await fetch(`/api/questions?knowledgePointId=${knowledgePointId}&limit=1`);
      if (!qRes.ok) return;
      const qData = await qRes.json();
      if (!qData.questions || qData.questions.length === 0) return;

      const questionId = qData.questions[0].id;
      const sRes = await fetch('/api/scaffold/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      });
      if (!sRes.ok) return;
      const sData = await sRes.json();
      const sessionId = sData.sessionId;

      const steps: string[] = [];
      let allUsed = false;
      while (!allUsed) {
        const hRes = await fetch('/api/scaffold/hint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const hData = await hRes.json();
        if (hData.hint && hData.hint.content) {
          steps.push(hData.hint.content);
        }
        allUsed = hData.allHintsUsed;
        if (allUsed) break;
      }
      setStandardSteps(steps);
    } catch {
      /* ignore */
    } finally {
      setStepsLoading(false);
    }
  }, [knowledgePointId]);

  const fetchErrorPatterns = useCallback(async () => {
    if (!userId) return;
    setErrorsLoading(true);
    try {
      const res = await fetch('/api/stop-point/analyze-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, knowledgePointId, limit: 10 }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.patterns && Array.isArray(data.patterns)) {
        setErrorPatterns(data.patterns.slice(0, 3));
      }
    } catch {
      /* ignore */
    } finally {
      setErrorsLoading(false);
    }
  }, [knowledgePointId, userId]);

  useEffect(() => {
    fetchKPData();
    fetchPrerequisites();
    fetchStandardSteps();
    fetchErrorPatterns();
  }, [fetchKPData, fetchPrerequisites, fetchStandardSteps, fetchErrorPatterns]);

  const saveNote = () => {
    localStorage.setItem(`kp_note_${knowledgePointId}`, note);
    setEditingNote(false);
  };

  if (loading) {
    return (
      <div className={`card ${compact ? 'p-4' : ''}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!kpData) {
    return (
      <div className="card text-center py-6">
        <p className="text-gray-500 text-sm">知识点数据加载失败</p>
      </div>
    );
  }

  return (
    <div className={`card ${compact ? 'p-4 space-y-3' : 'space-y-5'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <BookOpen size={18} className="text-primary-600 shrink-0" />
            <h3 className="font-bold text-gray-900 text-lg truncate">{kpData.name}</h3>
            <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded-full font-medium shrink-0">
              {kpData.category}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-yellow-500">
              {'★'.repeat(kpData.difficulty)}{'☆'.repeat(Math.max(0, 5 - kpData.difficulty))}
            </span>
            <span className="text-xs text-gray-400">{kpData.questionCount} 道题目</span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0">
            <X size={18} className="text-gray-400" />
          </button>
        )}
      </div>

      {kpData.description && (
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-2 text-sm">
            <BookOpen size={16} /> 定义
          </h4>
          <p className="text-sm text-blue-800 leading-relaxed"><MathRenderer content={kpData.description} /></p>
        </div>
      )}

      <div className="p-4 bg-green-50 rounded-xl border border-green-100">
        <h4 className="font-semibold text-green-900 flex items-center gap-2 mb-2 text-sm">
          <Lightbulb size={16} /> 标准步骤
        </h4>
        {stepsLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-green-100 rounded w-full" />
            <div className="h-3 bg-green-100 rounded w-5/6" />
            <div className="h-3 bg-green-100 rounded w-4/6" />
          </div>
        ) : standardSteps.length > 0 ? (
          <ol className="space-y-1.5">
            {standardSteps.map((step, i) => (
              <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                <span className="w-5 h-5 bg-green-200 text-green-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span><MathRenderer content={step} /></span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-green-700">暂无标准步骤</p>
        )}
      </div>

      <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
        <h4 className="font-semibold text-orange-900 flex items-center gap-2 mb-2 text-sm">
          <AlertTriangle size={16} /> 易错点
        </h4>
        {errorsLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-orange-100 rounded w-full" />
            <div className="h-3 bg-orange-100 rounded w-3/4" />
          </div>
        ) : errorPatterns.length > 0 ? (
          <div className="space-y-2">
            {errorPatterns.map((pattern, i) => (
              <div key={i} className="bg-white rounded-lg p-2.5 border border-orange-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-900">{pattern.pattern}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    pattern.classification === 'misconception' ? 'bg-red-100 text-red-700' :
                    pattern.classification === 'knowledge_gap' ? 'bg-orange-100 text-orange-700' :
                    pattern.classification === 'method_missing' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {CLASSIFICATION_LABEL[pattern.classification]}
                  </span>
                  <span className="text-[10px] text-gray-400">{pattern.occurrences}次</span>
                </div>
                <p className="text-xs text-gray-600">{pattern.rootCauseHypothesis}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-orange-700">暂无错误分析数据</p>
        )}
      </div>

      {prerequisites.length > 0 && (
        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
          <h4 className="font-semibold text-purple-900 flex items-center gap-2 mb-3 text-sm">
            <ArrowRight size={16} /> 前置知识
          </h4>
          <div className="space-y-2">
            {prerequisites.map((prereq) => {
              const masteryPercent = Math.round(prereq.masteryLevel * 100);
              const barColor = prereq.masteryLevel >= 0.7 ? 'bg-green-400' : prereq.masteryLevel >= 0.4 ? 'bg-yellow-400' : 'bg-red-400';
              return (
                <div key={prereq.id} className="bg-white rounded-lg p-2.5 border border-purple-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-900">{prereq.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      masteryPercent >= 70 ? 'bg-green-100 text-green-700' :
                      masteryPercent >= 40 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {masteryPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${barColor} transition-all duration-500`} style={{ width: `${masteryPercent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
            <Pen size={16} /> 笔记
          </h4>
          {editingNote ? (
            <button onClick={saveNote} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
              <Save size={14} />
              保存
            </button>
          ) : (
            <button onClick={() => setEditingNote(true)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium">
              <Pen size={14} />
              编辑
            </button>
          )}
        </div>
        {editingNote ? (
          <textarea
            className="w-full min-h-[80px] text-sm p-3 bg-white border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="记录你的学习笔记..."
          />
        ) : note ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{note}</p>
        ) : (
          <p className="text-sm text-gray-400">暂无笔记，点击编辑添加</p>
        )}
      </div>

      {onStartPractice && (
        <button
          onClick={() => onStartPractice(knowledgePointId)}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          <CheckCircle size={18} />
          开始练习
          <ArrowRight size={18} />
        </button>
      )}
    </div>
  );
}