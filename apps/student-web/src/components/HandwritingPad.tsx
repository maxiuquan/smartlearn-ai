import { useRef, useState, useEffect } from 'react';
import axios from 'axios';

interface HandwritingPadProps {
  /** 当前题目内容 */
  questionContent?: string;
  /** 标准答案 */
  correctAnswer?: string;
  /** 题目类型 */
  questionType?: string;
  /** 选择题选项 */
  options?: Record<string, string> | null;
  /** 相关知识点 */
  knowledgePoints?: string[] | null;
  /** 高度 */
  height?: number;
  /** 批改完成回调 */
  onGraded?: (result: GradeResult) => void;
}

interface GradeResult {
  is_correct: boolean;
  score: number;
  recognized_text: string;
  user_answer: string;
  feedback: string;
  steps_analysis?: string;
  error_type?: string;
}

/**
 * 手写答题板组件
 * 作为答题区，学生在此手写答案，提交后通过 OCR + AI 批改给分纠错
 */
export default function HandwritingPad({
  questionContent = '',
  correctAnswer = '',
  questionType = 'calculation',
  options = null,
  knowledgePoints = null,
  height = 300,
  onGraded,
}: HandwritingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [gradeError, setGradeError] = useState('');

  // 初始化 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, height);
  }, [height]);

  function getPos(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.PointerEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    setHistory((prev) => [...prev, ctx.getImageData(0, 0, rect.width * (window.devicePixelRatio || 1), height * (window.devicePixelRatio || 1))].slice(-20));
    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.PointerEvent) {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasContent(true);
  }

  function endDraw() {
    if (!isDrawing) return;
    setIsDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, height);
    setHasContent(false);
    setHistory([]);
    setGradeResult(null);
    setGradeError('');
  }

  function undo() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || history.length === 0) return;
    const lastState = history[history.length - 1];
    ctx.putImageData(lastState, 0, 0);
    setHistory((prev) => prev.slice(0, -1));
    if (history.length <= 1) setHasContent(false);
  }

  // 提交手写答题进行 AI 批改
  async function submitForGrading() {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return;

    setGrading(true);
    setGradeError('');
    setGradeResult(null);

    try {
      // 获取 base64 图片数据（去掉 data:image/png;base64, 前缀）
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];

      // 调用 AI 引擎批改接口
      const response = await axios.post(
        '/ai/handwriting/grade',
        {
          image_data: base64Data,
          question_content: questionContent,
          correct_answer: correctAnswer,
          question_type: questionType,
          options: options,
          knowledge_points: knowledgePoints,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('smartlearn_token')}`,
          },
          timeout: 60000,
        }
      );

      const data = response.data;
      if (data.success && data.result) {
        setGradeResult(data.result);
        onGraded?.(data.result);
      } else {
        setGradeError(data.error || '批改失败');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || '批改服务不可用';
      setGradeError(msg);
    } finally {
      setGrading(false);
    }
  }

  return (
    <div className="border-2 border-purple-200 rounded-lg overflow-hidden bg-white">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-purple-50 border-b border-purple-200">
        <span className="text-sm font-medium text-purple-700 flex items-center gap-1">
          ✍️ 手写答题区
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={!hasContent || grading}
            className="px-2 py-1 text-xs rounded border border-purple-200 text-purple-600 hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="撤销"
          >
            ↶ 撤销
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            disabled={!hasContent || grading}
            className="px-2 py-1 text-xs rounded border border-purple-200 text-purple-600 hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="清空"
          >
            🗑 清空
          </button>
        </div>
      </div>

      {/* Canvas 答题区 */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${height}px`, touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
        onPointerCancel={endDraw}
      />

      {/* 提示文字 */}
      <div className="px-3 py-1.5 bg-purple-50 border-t border-purple-200">
        <p className="text-xs text-purple-500">
          在上方区域手写答案，完成后点击"提交批改"由 AI 识别并评分纠错
        </p>
      </div>

      {/* 提交按钮 */}
      <div className="px-3 py-2 bg-purple-50 border-t border-purple-200">
        <button
          type="button"
          onClick={submitForGrading}
          disabled={!hasContent || grading || !correctAnswer}
          className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {grading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              AI 批改中...
            </span>
          ) : (
            '📝 提交批改'
          )}
        </button>
        {!correctAnswer && (
          <p className="text-xs text-orange-500 mt-1">需要标准答案才能批改</p>
        )}
      </div>

      {/* 批改结果 */}
      {gradeError && (
        <div className="px-3 py-2 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-600">❌ {gradeError}</p>
        </div>
      )}

      {gradeResult && (
        <div className="px-3 py-3 bg-gray-50 border-t border-purple-200">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-2xl font-bold ${gradeResult.is_correct ? 'text-green-600' : 'text-red-500'}`}>
              {gradeResult.score}分
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              gradeResult.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {gradeResult.is_correct ? '✅ 正确' : '❌ 有误'}
            </span>
            {gradeResult.error_type && gradeResult.error_type !== 'none' && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                {gradeResult.error_type === 'concept' ? '概念错误' :
                 gradeResult.error_type === 'calculation' ? '计算错误' :
                 gradeResult.error_type === 'logic' ? '逻辑错误' :
                 gradeResult.error_type === 'notation' ? '符号错误' : gradeResult.error_type}
              </span>
            )}
          </div>

          {gradeResult.recognized_text && (
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-0.5">识别内容：</p>
              <p className="text-sm text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 font-mono whitespace-pre-wrap">
                {gradeResult.recognized_text}
              </p>
            </div>
          )}

          {gradeResult.steps_analysis && (
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-0.5">步骤分析：</p>
              <p className="text-sm text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 whitespace-pre-wrap">
                {gradeResult.steps_analysis}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 mb-0.5">纠错反馈：</p>
            <p className="text-sm text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 whitespace-pre-wrap">
              {gradeResult.feedback}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
