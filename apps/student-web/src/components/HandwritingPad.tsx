import { useRef, useState, useEffect } from 'react';

interface HandwritingPadProps {
  onStrokeComplete?: (dataUrl: string) => void;
  height?: number;
}

/**
 * 手写板组件
 * 基于 Canvas + 指针事件，支持鼠标和触摸手写
 * 功能：绘制、清空、撤销、下载图片
 */
export default function HandwritingPad({ onStrokeComplete, height = 240 }: HandwritingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);

  // 初始化 Canvas（处理高分辨率屏幕）
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
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2.5;

    // 白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, height);
  }, [height]);

  function getPos(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function startDraw(e: React.PointerEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 保存当前状态到历史（用于撤销）
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
    const canvas = canvasRef.current;
    if (canvas && onStrokeComplete) {
      onStrokeComplete(canvas.toDataURL('image/png'));
    }
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

  function downloadImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `handwriting-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          ✍️ 手写板
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={!hasContent}
            className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="撤销"
          >
            ↶ 撤销
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            disabled={!hasContent}
            className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="清空"
          >
            🗑 清空
          </button>
          <button
            type="button"
            onClick={downloadImage}
            disabled={!hasContent}
            className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="下载图片"
          >
            💾 保存
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${height}px`, touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
        onPointerCancel={endDraw}
      />
    </div>
  );
}
