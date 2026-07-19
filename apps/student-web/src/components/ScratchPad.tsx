import { useState } from 'react';

interface ScratchPadProps {
  height?: number;
}

/**
 * 草稿纸组件
 * 用于数学计算、推导步骤的临时草稿
 * 支持多页草稿、自动保存到 localStorage
 */
export default function ScratchPad({ height = 240 }: ScratchPadProps) {
  const STORAGE_KEY = 'math_scratchpad_content';

  const [content, setContent] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    try {
      localStorage.setItem(STORAGE_KEY, val);
    } catch {
      // 忽略存储错误
    }
  }

  function handleClear() {
    setContent('');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 忽略
    }
  }

  // 快捷插入常用数学符号
  function insertSymbol(symbol: string) {
    setContent((prev) => prev + symbol);
    try {
      localStorage.setItem(STORAGE_KEY, content + symbol);
    } catch {
      // 忽略
    }
  }

  const symbols = ['×', '÷', '±', '√', '∑', '∫', '∞', 'π', '≠', '≤', '≥', '→', '∂', 'Δ', 'θ', 'α', 'β', 'γ'];

  return (
    <div className="border border-yellow-200 rounded-lg overflow-hidden bg-yellow-50">
      <div className="flex items-center justify-between px-3 py-2 bg-yellow-100 border-b border-yellow-200">
        <span className="text-xs text-yellow-700 flex items-center gap-1">
          📝 草稿纸
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleClear}
            disabled={!content}
            className="px-2 py-1 text-xs rounded border border-yellow-300 text-yellow-700 hover:bg-yellow-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="清空草稿"
          >
            🗑 清空
          </button>
        </div>
      </div>

      {/* 数学符号快捷栏 */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 bg-yellow-50 border-b border-yellow-200">
        {symbols.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => insertSymbol(s)}
            className="w-7 h-7 flex items-center justify-center text-sm rounded border border-yellow-300 bg-white text-yellow-700 hover:bg-yellow-100 transition-colors"
            title={`插入 ${s}`}
          >
            {s}
          </button>
        ))}
      </div>

      <textarea
        value={content}
        onChange={handleChange}
        placeholder="在这里进行计算推导...&#10;支持自由书写计算步骤，内容会自动保存"
        className="w-full px-3 py-2 bg-yellow-50 text-gray-700 font-mono text-sm resize-none focus:outline-none border-0"
        style={{ height: `${height}px`, lineHeight: '1.6' }}
        spellCheck={false}
      />

      <div className="px-3 py-1 bg-yellow-100 border-t border-yellow-200 text-xs text-yellow-600">
        {content ? `${content.length} 字符 · 自动保存` : '空草稿'}
      </div>
    </div>
  );
}
