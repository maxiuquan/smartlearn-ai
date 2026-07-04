import { useMemo } from 'react';
import katex from 'katex';

interface FormulaTextProps {
  text: string;
  className?: string;
}

/**
 * 渲染包含 LaTeX 公式的文本
 * 支持 $...$ 行内公式和 $$...$$ 块级公式
 */
export default function FormulaText({ text, className = '' }: FormulaTextProps) {
  const html = useMemo(() => {
    // 先处理块级公式 $$...$$
    let result = text.replace(/\$\$([\s\S]*?)\$\$/g, (_match, formula: string) => {
      try {
        return katex.renderToString(formula.trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        return `<span class="text-red-500">[公式渲染错误]</span>`;
      }
    });

    // 再处理行内公式 $...$
    result = result.replace(/\$([^$]+?)\$/g, (_match, formula: string) => {
      try {
        return katex.renderToString(formula.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return `<span class="text-red-500">[公式渲染错误]</span>`;
      }
    });

    return result;
  }, [text]);

  return (
    <span
      className={`formula-text ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}