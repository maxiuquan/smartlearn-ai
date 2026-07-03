import { useRef, useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { Pen, Eraser, Undo2, Trash2, Check, Minus, Plus } from 'lucide-react';

interface HandwritingCanvasProps {
  onExport?: (dataUrl: string) => void;
  className?: string;
  width?: number;
  height?: number;
}

const COLORS = ['#000000', '#ef4444', '#3b82f6'];
const PEN_SIZES = [2, 4, 6];
const ERASER_SIZES = [12, 20, 30];

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 0.5;
  const spacing = 20;
  ctx.beginPath();
  for (let x = 0; x <= w; x += spacing) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += spacing) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.restore();
}

export default function HandwritingCanvas({ onExport, className, width, height }: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const undoStack = useRef<ImageData[]>([]);
  const dprRef = useRef(1);
  const displaySizeRef = useRef({ w: 0, h: 0 });

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [penSizeIdx, setPenSizeIdx] = useState(1);
  const [eraserSizeIdx, setEraserSizeIdx] = useState(1);

  const currentSize = tool === 'pen' ? PEN_SIZES[penSizeIdx] : ERASER_SIZES[eraserSizeIdx];

  const getPos = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }, []);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = containerRef.current;
    if (!container) return;

    const dpr = window.devicePixelRatio || 1;
    const w = width ?? container.clientWidth;
    const h = height ?? container.clientHeight;

    displaySizeRef.current = { w, h };
    dprRef.current = dpr;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    drawGrid(ctx, w, h);
  }, [width, height]);

  useEffect(() => {
    setupCanvas();
    const handleResize = () => {
      setupCanvas();
      undoStack.current = [];
      setHasContent(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas]);

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }, []);

  const applyToolSettings = useCallback((ctx: CanvasRenderingContext2D) => {
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = currentSize;
  }, [tool, color, currentSize]);

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();

    const pos = getPos(e);
    if (!pos) return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    saveState();
    applyToolSettings(ctx);

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    setIsDrawing(true);
    setHasContent(true);
  }, [getPos, saveState, applyToolSettings]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const pos = getPos(e);
    if (!pos) return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [isDrawing, getPos]);

  const endDraw = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
  }, [isDrawing]);

  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = undoStack.current.pop();
    if (!data) return;

    ctx.putImageData(data, 0, 0);

    if (undoStack.current.length === 0) {
      setHasContent(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = displaySizeRef.current;
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h);
    undoStack.current = [];
    setHasContent(false);
  }, []);

  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { w, h } = displaySizeRef.current;
    const dpr = dprRef.current;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w * dpr;
    exportCanvas.height = h * dpr;

    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;

    exportCtx.scale(dpr, dpr);
    exportCtx.fillStyle = '#ffffff';
    exportCtx.fillRect(0, 0, w, h);
    exportCtx.drawImage(canvas, 0, 0);

    const dataUrl = exportCanvas.toDataURL('image/png');
    onExport?.(dataUrl);
  }, [onExport]);

  const adjustSize = useCallback((delta: number) => {
    if (tool === 'pen') {
      setPenSizeIdx((prev) => Math.max(0, Math.min(PEN_SIZES.length - 1, prev + delta)));
    } else {
      setEraserSizeIdx((prev) => Math.max(0, Math.min(ERASER_SIZES.length - 1, prev + delta)));
    }
  }, [tool]);

  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200 flex-wrap select-none">
        <button
          onClick={() => setTool('pen')}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            tool === 'pen'
              ? 'bg-blue-100 text-blue-600 shadow-sm'
              : 'text-gray-500 hover:bg-gray-100'
          )}
          title="画笔"
        >
          <Pen size={18} />
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            tool === 'eraser'
              ? 'bg-blue-100 text-blue-600 shadow-sm'
              : 'text-gray-500 hover:bg-gray-100'
          )}
          title="橡皮擦"
        >
          <Eraser size={18} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {tool === 'pen' ? (
          <>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={clsx(
                  'w-6 h-6 rounded-full border-2 transition-all',
                  color === c
                    ? 'border-blue-500 scale-110 shadow-sm'
                    : 'border-gray-300 hover:scale-105'
                )}
                style={{ backgroundColor: c }}
                title={
                  c === '#000000' ? '黑色' : c === '#ef4444' ? '红色' : '蓝色'
                }
              />
            ))}
          </>
        ) : (
          <div className="flex items-center gap-2 px-1">
            <div
              className="rounded-full border-2 border-gray-300 bg-gray-100"
              style={{
                width: Math.min(currentSize + 6, 28),
                height: Math.min(currentSize + 6, 28),
              }}
            />
          </div>
        )}

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => adjustSize(-1)}
            disabled={
              tool === 'pen'
                ? penSizeIdx === 0
                : eraserSizeIdx === 0
            }
            className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="减小"
          >
            <Minus size={14} />
          </button>

          <div className="flex items-center justify-center min-w-[28px]">
            {tool === 'pen' ? (
              <div
                className="rounded-full"
                style={{
                  width: PEN_SIZES[penSizeIdx] * 2 + 2,
                  height: PEN_SIZES[penSizeIdx] * 2 + 2,
                  backgroundColor: color,
                }}
              />
            ) : (
              <div
                className="rounded-full bg-gray-300"
                style={{
                  width: ERASER_SIZES[eraserSizeIdx] + 4,
                  height: ERASER_SIZES[eraserSizeIdx] + 4,
                }}
              />
            )}
          </div>

          <button
            onClick={() => adjustSize(1)}
            disabled={
              tool === 'pen'
                ? penSizeIdx === PEN_SIZES.length - 1
                : eraserSizeIdx === ERASER_SIZES.length - 1
            }
            className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="增大"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1" />

        <button
          onClick={handleUndo}
          disabled={!hasContent}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="撤销"
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={handleClear}
          disabled={!hasContent}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="清空"
        >
          <Trash2 size={18} />
        </button>

        <button
          onClick={handleExport}
          disabled={!hasContent}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          title="提交手写"
        >
          <Check size={16} />
          <span>提交</span>
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative rounded-xl border border-gray-200 shadow-lg overflow-hidden bg-white"
        style={{
          width: width ? `${width}px` : '100%',
          height: height ? `${height}px` : '400px',
        }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full cursor-crosshair"
          style={{ touchAction: 'none' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
    </div>
  );
}