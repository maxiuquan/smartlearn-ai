import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Lightbulb, ChevronDown, ChevronUp, Target, Brain, Activity, BookOpen, CheckCircle2, XCircle, Sparkles, Zap, Shield } from 'lucide-react';
import MathRenderer from './MathRenderer';

interface StopPoint {
  knowledgePointId: number;
  name: string;
  category: string;
  chapter: string;
  totalAttempts: number;
  wrongAttempts: number;
  wrongRate: number;
  lastWrongAt: string | null;
  severity: 'warning' | 'critical' | 'blocker';
  masteryLevel: number;
  recommendedActions: string[];
  upstreamStoppers: { id: number; name: string; mastery: number }[];
}

interface ErrorPattern {
  pattern: string;
  occurrences: number;
  examples: { questionId: number; userAnswer: string; correctAnswer: string; weakPoint: string }[];
  classification: 'misconception' | 'careless' | 'knowledge_gap' | 'method_missing';
  rootCauseHypothesis: string;
}

interface FiveWhy {
  q: string;
  a: string;
}

interface StopPointReport {
  stopPoints: StopPoint[];
  generatedAt: string;
}

interface ErrorAnalysisReport {
  knowledgePointId: number;
  totalErrors: number;
  patterns: ErrorPattern[];
  questionTypeBreakdown: Record<string, number>;
  weakPointBreakdown: Record<string, number>;
  fiveWhyTemplate: FiveWhy[];
}

const SEVERITY_CONFIG: Record<StopPoint['severity'], { color: string; bg: string; label: string; icon: typeof AlertTriangle }> = {
  blocker: { color: '#FF4757', bg: '#FF475722', label: '断路点', icon: XCircle },
  critical: { color: '#FF8C42', bg: '#FF8C4222', label: '关键弱点', icon: AlertTriangle },
  warning: { color: '#FFD93D', bg: '#FFD93D22', label: '需关注', icon: AlertTriangle },
};

const CLASSIFICATION_LABEL: Record<ErrorPattern['classification'], string> = {
  misconception: '概念误解',
  careless: '粗心大意',
  knowledge_gap: '知识缺口',
  method_missing: '方法缺失',
};

const CLASSIFICATION_COLOR: Record<ErrorPattern['classification'], string> = {
  misconception: 'bg-red-100 text-red-700',
  careless: 'bg-yellow-100 text-yellow-700',
  knowledge_gap: 'bg-orange-100 text-orange-700',
  method_missing: 'bg-blue-100 text-blue-700',
};

export function StopPointDetector({ userId, currentKnowledgePointId, onSelectRecovery }: { userId: number | null; currentKnowledgePointId?: number; onSelectRecovery?: (kpId: number) => void }) {
  const navigate = useNavigate();
  const [report, setReport] = useState<StopPointReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [errorAnalysis, setErrorAnalysis] = useState<ErrorAnalysisReport | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [resolvedPoints, setResolvedPoints] = useState<number[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch('/api/stop-point/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, windowDays: 14, minAttempts: 3 }),
    })
      .then(r => r.json())
      .then(data => setReport(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('stop_point_resolved') || '[]');
      if (report) {
        const valid = saved.filter((id: number) => report.stopPoints.some(sp => sp.knowledgePointId === id));
        setResolvedPoints(valid);
      }
    } catch {
      // silent
    }
  }, [report]);

  const loadErrorAnalysis = async (kpId: number) => {
    if (!userId) return;
    setAnalysisLoading(true);
    setErrorAnalysis(null);
    try {
      const res = await fetch('/api/stop-point/analyze-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, knowledgePointId: kpId, limit: 15 }),
      });
      const data = await res.json();
      setErrorAnalysis(data);
    } catch { /* ignore */ }
    finally {
      setAnalysisLoading(false);
    }
  };

  const handleResolve = (kpId: number) => {
    const updated = [...resolvedPoints, kpId];
    setResolvedPoints(updated);
    localStorage.setItem('stop_point_resolved', JSON.stringify(updated));
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 3000);
  };

  const handleOneClickBreak = () => {
    if (!report || report.stopPoints.length === 0) return;
    const activePoints = report.stopPoints.filter(sp => !resolvedPoints.includes(sp.knowledgePointId));
    if (activePoints.length === 0) return;
    const blocker = activePoints.find(sp => sp.severity === 'blocker');
    const critical = activePoints.find(sp => sp.severity === 'critical');
    const target = blocker || critical || activePoints[0];
    navigate(`/math?knowledgePointId=${target.knowledgePointId}&quick=5&stopPoint=1`);
  };

  const handleStartBreak = (kpId: number) => {
    navigate(`/math?knowledgePointId=${kpId}&quick=5&stopPoint=1`);
  };

  if (loading) {
    return (
      <div className='card animate-pulse'>
        <div className='h-6 bg-gray-200 rounded w-1/3 mb-3' />
        <div className='space-y-2'>
          {[1, 2].map(i => <div key={i} className='h-16 bg-gray-100 rounded-xl' />)}
        </div>
      </div>
    );
  }

  if (!report || report.stopPoints.length === 0) {
    return (
      <div className='card bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'>
        <div className='flex items-center gap-3'>
          <div className='w-12 h-12 rounded-full bg-green-100 flex items-center justify-center'>
            <CheckCircle2 className='w-6 h-6 text-green-600' />
          </div>
          <div>
            <h3 className='font-bold text-green-900'>🎉 未检测到断点！</h3>
            <p className='text-sm text-green-700 mt-0.5'>过去14天所有知识点错误率均低于30%，继续保持！</p>
          </div>
        </div>
      </div>
    );
  }

  const activePoints = report.stopPoints.filter(sp => !resolvedPoints.includes(sp.knowledgePointId));
  const blockerCount = activePoints.filter(sp => sp.severity === 'blocker').length;
  const criticalCount = activePoints.filter(sp => sp.severity === 'critical').length;
  const warningCount = activePoints.filter(sp => sp.severity === 'warning').length;
  const totalResolved = resolvedPoints.length;
  const totalPoints = report.stopPoints.length;

  return (
    <div className='space-y-4'>
      {showCelebration && (
        <div className='fixed top-4 right-4 z-50 animate-fade-in'>
          <div className='bg-green-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2'>
            <CheckCircle2 size={20} />
            <span className='font-medium'>断点已清除！</span>
          </div>
        </div>
      )}

      <div className='card border-2 border-orange-200 bg-gradient-to-br from-orange-50/50 to-red-50/30'>
        <div className='flex items-center gap-2 mb-4'>
          <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center'>
            <Activity className='w-5 h-5 text-white' />
          </div>
          <div className='flex-1'>
            <h3 className='font-bold text-gray-900 flex items-center gap-2'>
              🛑 智能断点检测
              <span className='text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium'>
                超越 知能行 的诊断精度
              </span>
            </h3>
            <p className='text-xs text-gray-500'>基于14天答题数据 · 错误率≥30%的知识点</p>
          </div>
        </div>

        <div className='grid grid-cols-4 gap-3 mb-4'>
          <div className='bg-white rounded-xl p-3 text-center border border-red-200'>
            <p className='text-2xl font-bold text-red-600'>{blockerCount}</p>
            <p className='text-xs text-gray-500'>断路点</p>
          </div>
          <div className='bg-white rounded-xl p-3 text-center border border-orange-200'>
            <p className='text-2xl font-bold text-orange-600'>{criticalCount}</p>
            <p className='text-xs text-gray-500'>关键弱点</p>
          </div>
          <div className='bg-white rounded-xl p-3 text-center border border-yellow-200'>
            <p className='text-2xl font-bold text-yellow-600'>{warningCount}</p>
            <p className='text-xs text-gray-500'>需关注</p>
          </div>
          <div className='bg-white rounded-xl p-3 text-center border border-green-200'>
            <p className='text-2xl font-bold text-green-600'>{totalResolved}</p>
            <p className='text-xs text-gray-500'>已攻克</p>
          </div>
        </div>

        <div className='flex items-center justify-between mb-2'>
          <span className='text-xs text-gray-500'>
            已攻克 {totalResolved} / {totalPoints} 个断点
          </span>
          <span className='text-xs font-medium text-orange-600'>
            {totalPoints - totalResolved} 个待处理
          </span>
        </div>
        <div className='w-full bg-white rounded-full h-2 overflow-hidden border border-orange-100'>
          <div
            className='h-full rounded-full bg-gradient-to-r from-orange-400 to-green-500 transition-all'
            style={{ width: `${totalPoints > 0 ? (totalResolved / totalPoints) * 100 : 0}%` }}
          />
        </div>

        {activePoints.length > 0 && (
          <div className='mt-4 flex gap-2'>
            <button
              onClick={handleOneClickBreak}
              className='flex-1 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl text-sm font-medium hover:from-red-600 hover:to-orange-600 flex items-center justify-center gap-2'
            >
              <Zap size={16} />
              一键攻克
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      <div className='space-y-2'>
        {report.stopPoints.map((sp) => {
          const cfg = SEVERITY_CONFIG[sp.severity];
          const Icon = cfg.icon;
          const isExpanded = expandedId === sp.knowledgePointId;
          const isResolved = resolvedPoints.includes(sp.knowledgePointId);

          return (
            <div
              key={sp.knowledgePointId}
              className={`rounded-xl border-2 transition-all ${isResolved ? 'border-green-300 bg-green-50/50 opacity-70' : ''}`}
              style={{ borderColor: isResolved ? '#10B981' : cfg.color + '40', backgroundColor: isResolved ? undefined : cfg.bg }}
            >
              <button
                onClick={() => {
                  if (isResolved) return;
                  setExpandedId(isExpanded ? null : sp.knowledgePointId);
                  if (!isExpanded) loadErrorAnalysis(sp.knowledgePointId);
                }}
                className='w-full p-3 flex items-center gap-3 text-left'
              >
                <div
                  className='w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0'
                  style={{ backgroundColor: isResolved ? '#10B981' : cfg.color, color: 'white' }}
                >
                  {isResolved ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 flex-wrap'>
                    <span className='font-semibold text-gray-900 truncate'>{sp.name}</span>
                    <span
                      className='text-xs px-1.5 py-0.5 rounded-full font-medium'
                      style={{ backgroundColor: isResolved ? '#10B98120' : cfg.color + '20', color: isResolved ? '#10B981' : cfg.color }}
                    >
                      {isResolved ? '已攻克' : cfg.label}
                    </span>
                    <span className='text-xs text-gray-500'>{sp.category}</span>
                  </div>
                  <div className='flex items-center gap-3 mt-1 text-xs text-gray-600'>
                    <span>错误率 <b className='text-red-600'>{sp.wrongRate}%</b></span>
                    <span>·</span>
                    <span>掌握度 <b style={{ color: sp.masteryLevel >= 0.7 ? '#10B981' : sp.masteryLevel >= 0.4 ? '#F59E0B' : '#EF4444' }}>
                      {Math.round(sp.masteryLevel * 100)}%
                    </b></span>
                    <span>·</span>
                    <span>{sp.wrongAttempts}/{sp.totalAttempts} 次错误</span>
                  </div>
                </div>
                <div className='flex items-center gap-2 shrink-0'>
                  {!isResolved && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartBreak(sp.knowledgePointId); }}
                      className='text-xs px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 flex items-center gap-1'
                    >
                      <Shield size={12} />
                      开始突破
                    </button>
                  )}
                  {isResolved && (
                    <span className='text-xs text-green-600 font-medium flex items-center gap-1'>
                      <CheckCircle2 size={12} />
                      已清除
                    </span>
                  )}
                  {isExpanded ? <ChevronUp size={16} className='text-gray-400' /> : <ChevronDown size={16} className='text-gray-400' />}
                </div>
              </button>

              {isExpanded && !isResolved && (
                <div className='px-3 pb-3 space-y-3 border-t border-orange-100 pt-3 mt-1'>
                  {sp.upstreamStoppers.length > 0 && (
                    <div className='bg-white rounded-lg p-3 border border-orange-100'>
                      <p className='text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1'>
                        <Target size={12} /> 断路前置知识（这是你真正的"断点"）
                      </p>
                      <div className='space-y-1'>
                        {sp.upstreamStoppers.map(us => (
                          <div key={us.id} className='flex items-center gap-2 text-xs'>
                            <span className='w-1.5 h-1.5 rounded-full bg-red-400' />
                            <span className='text-gray-700 flex-1'>{us.name}</span>
                            <span className='text-red-600 font-mono'>{Math.round(us.mastery * 100)}%</span>
                          </div>
                        ))}
                      </div>

                      <div className='flex items-center gap-1 mt-2 overflow-x-auto'>
                        {sp.upstreamStoppers.map((us, i) => (
                          <div key={us.id} className='flex items-center gap-1 flex-shrink-0'>
                            <div className='px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-700 border border-red-300'>
                              {us.name}
                            </div>
                            {i < sp.upstreamStoppers.length - 1 && <ArrowRight size={12} className='text-gray-400 flex-shrink-0' />}
                          </div>
                        ))}
                        <ArrowRight size={12} className='text-gray-400 flex-shrink-0' />
                        <div className='px-2 py-0.5 rounded-md text-xs font-medium bg-orange-100 text-orange-700 border border-orange-300'>
                          {sp.name}
                        </div>
                      </div>
                      <p className='text-xs text-gray-500 mt-2 italic'>
                        💡 知能行提示：先攻克红色前置知识，否则主知识点会一直错。
                      </p>
                    </div>
                  )}

                  <div>
                    <p className='text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1'>
                      <Lightbulb size={12} /> 推荐行动
                    </p>
                    <ul className='space-y-1'>
                      {sp.recommendedActions.map((a, i) => (
                        <li key={i} className='text-xs text-gray-700 flex items-start gap-1.5'>
                          <span className='text-blue-500 mt-0.5'>▸</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className='flex gap-2'>
                    {onSelectRecovery && (
                      <button
                        onClick={() => onSelectRecovery(sp.knowledgePointId)}
                        className='flex-1 text-sm py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 flex items-center justify-center gap-1.5'
                      >
                        <Brain size={14} />
                        开始断点突破训练
                        <ArrowRight size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleResolve(sp.knowledgePointId)}
                      className='text-xs px-3 py-2 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200 flex items-center gap-1'
                    >
                      <CheckCircle2 size={14} />
                      标记已攻克
                    </button>
                  </div>

                  {analysisLoading && (
                    <div className='text-xs text-gray-500 text-center py-2 animate-pulse'>分析中...</div>
                  )}

                  {errorAnalysis && errorAnalysis.knowledgePointId === sp.knowledgePointId && (
                    <ErrorAnalysisBlock analysis={errorAnalysis} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ErrorAnalysisBlock({ analysis }: { analysis: ErrorAnalysisReport }) {
  return (
    <div className='bg-white rounded-lg p-3 border border-purple-100 space-y-3 mt-2'>
      <p className='text-xs font-semibold text-purple-700 flex items-center gap-1'>
        <Sparkles size={12} /> AI 错误模式分析
      </p>

      {analysis.patterns.length === 0 ? (
        <p className='text-xs text-gray-500'>错误样本不足，暂无模式分析。</p>
      ) : (
        <div className='space-y-2'>
          {analysis.patterns.map((p, i) => (
            <div key={i} className='bg-purple-50 rounded-lg p-2 space-y-1'>
              <div className='flex items-center gap-2 flex-wrap'>
                <span className='text-sm font-medium text-gray-900'>{p.pattern}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${CLASSIFICATION_COLOR[p.classification]}`}>
                  {CLASSIFICATION_LABEL[p.classification]}
                </span>
                <span className='text-[10px] text-gray-500'>{p.occurrences}次</span>
              </div>
              <p className='text-xs text-gray-600 leading-relaxed'>{p.rootCauseHypothesis}</p>
              {p.examples.length > 0 && (
                <details className='text-[10px] text-gray-500'>
                  <summary className='cursor-pointer hover:text-gray-700'>查看样例 ({p.examples.length})</summary>
                  <div className='mt-1 space-y-1'>
                    {p.examples.map((ex, j) => (
                      <div key={j} className='bg-white rounded p-1.5 border border-gray-100'>
                        <p>你的答案: <span className='text-red-600 font-mono'>{ex.userAnswer}</span></p>
                        <p>正确答案: <span className='text-green-600 font-mono'>{ex.correctAnswer}</span></p>
                        <p>涉及: {ex.weakPoint}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      <div className='bg-blue-50 rounded-lg p-2 border border-blue-100'>
        <p className='text-xs font-semibold text-blue-700 mb-1.5'>🔍 5-Why 根因分析</p>
        <div className='space-y-1'>
          {analysis.fiveWhyTemplate.map((w, i) => (
            <div key={i} className='flex items-start gap-1.5 text-xs'>
              <span className='font-bold text-blue-600 w-4'>{i + 1}.</span>
              <div>
                <p className='text-gray-700 font-medium'>{w.q}</p>
                <p className='text-gray-500'>{w.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PrerequisiteChain({ knowledgePoints, currentKpId }: { knowledgePoints: { id: number; name: string; mastery?: number }[]; currentKpId: number }) {
  if (knowledgePoints.length === 0) return null;
  return (
    <div className='bg-white rounded-lg p-3 border border-gray-200'>
      <p className='text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1'>
        <BookOpen size={12} /> 知识点依赖链
      </p>
      <div className='flex items-center gap-1 overflow-x-auto'>
        {knowledgePoints.map((kp, i) => {
          const isCurrent = kp.id === currentKpId;
          const mastery = kp.mastery ?? 0;
          const masteryColor = mastery >= 0.7 ? 'bg-green-100 text-green-700 border-green-300'
            : mastery >= 0.4 ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
            : 'bg-red-100 text-red-700 border-red-300';
          return (
            <div key={kp.id} className='flex items-center gap-1 flex-shrink-0'>
              <div
                className={`px-2 py-1 rounded-md text-xs font-medium border ${isCurrent ? 'ring-2 ring-blue-400' : masteryColor}`}
                title={`掌握度 ${Math.round(mastery * 100)}%`}
              >
                {kp.name}
              </div>
              {i < knowledgePoints.length - 1 && <ArrowRight size={12} className='text-gray-400 flex-shrink-0' />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdaptiveDifficultyIndicator({ difficulty, masteryLevel, recentAccuracy }: { difficulty: number; masteryLevel: number; recentAccuracy: number }) {
  const targetZone = masteryLevel >= 0.7 ? '进阶训练区' : masteryLevel >= 0.4 ? '舒适区' : '基础巩固区';
  const color = masteryLevel >= 0.7 ? '#10B981' : masteryLevel >= 0.4 ? '#F59E0B' : '#3B82F6';
  const recommendation = recentAccuracy >= 0.85
    ? { text: '建议提升难度，挑战更高阶梯', icon: Target, color: '#10B981' }
    : recentAccuracy >= 0.6
      ? { text: '当前难度适中，保持训练节奏', icon: CheckCircle2, color: '#3B82F6' }
      : { text: '建议降低难度，巩固基础', icon: Lightbulb, color: '#F59E0B' };

  const Icon = recommendation.icon;
  return (
    <div className='bg-white rounded-lg p-3 border-2' style={{ borderColor: color + '40' }}>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-xs font-semibold text-gray-700 flex items-center gap-1'>
          <Brain size={12} /> 自适应难度
        </span>
        <span className='text-[10px] px-2 py-0.5 rounded-full font-medium' style={{ backgroundColor: color + '20', color }}>
          {targetZone}
        </span>
      </div>
      <div className='flex items-center gap-3 text-xs'>
        <div className='flex-1'>
          <div className='flex items-center justify-between mb-1'>
            <span className='text-gray-500'>当前掌握度</span>
            <span className='font-mono font-bold' style={{ color }}>{Math.round(masteryLevel * 100)}%</span>
          </div>
          <div className='w-full bg-gray-200 rounded-full h-1.5'>
            <div className='h-full rounded-full transition-all' style={{ width: `${masteryLevel * 100}%`, backgroundColor: color }} />
          </div>
        </div>
        <div className='flex-1'>
          <div className='flex items-center justify-between mb-1'>
            <span className='text-gray-500'>近期正确率</span>
            <span className='font-mono font-bold' style={{ color }}>{Math.round(recentAccuracy * 100)}%</span>
          </div>
          <div className='w-full bg-gray-200 rounded-full h-1.5'>
            <div className='h-full rounded-full transition-all' style={{ width: `${recentAccuracy * 100}%`, backgroundColor: color }} />
          </div>
        </div>
      </div>
      <div className='mt-2 flex items-center gap-1.5 text-xs' style={{ color: recommendation.color }}>
        <Icon size={12} />
        <span>{recommendation.text}</span>
      </div>
    </div>
  );
}