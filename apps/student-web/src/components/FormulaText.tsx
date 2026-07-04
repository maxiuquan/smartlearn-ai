import { useMemo } from 'react';
import katex from 'katex';

interface FormulaTextProps {
  text: string;
  className?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 渲染包含 LaTeX 公式的文本
 * 支持 $...$ 行内公式和 $$...$$ 块级公式
 * 注意: 先对整段文本做 HTML 转义，防止 XSS 攻击
 */
export default function FormulaText({ text, className = '' }: FormulaTextProps) {
  const html = useMemo(() => {
    // 先对整段文本做 HTML 转义
    const escaped = escapeHtml(text);

    // 处理块级公式 $$...$$
    // 注意: 转义后 $ 仍然是 $，公式标记不受影响
    let result = escaped.replace(/\$\$([\s\S]*?)\$\$/g, (_match, formula: string) => {
      // KaTeX 输入需要原始 LaTeX，但 escapeHtml 不会改变 LaTeX 语义字符
      // 这里将转义后的实体还原回 LaTeX 所需字符
      const raw = formula
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      try {
        return katex.renderToString(raw.trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        return '[公式渲染错误]';
      }
    });

    // 处理行内公式 $...$
    result = result.replace(/\$([^$]+?)\$/g, (_match, formula: string) => {
      const raw = formula
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      try {
        return katex.renderToString(raw.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return '[公式渲染错误]';
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
