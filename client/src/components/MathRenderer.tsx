import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
  className?: string;
}

export default function MathRenderer({ content, className = '' }: MathRendererProps) {
  const html = useMemo(() => {
    if (!content) return '';
    let processed = content;

    processed = processed.replace(/\\\\/g, '\u0000');

    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      try {
        return katex.renderToString(math.replace(/\u0000/g, '\\').trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        return `$$${math}$$`;
      }
    });

    processed = processed.replace(/\$([^\n$]+?)\$/g, (_, math) => {
      const restored = math.replace(/\u0000/g, '\\').trim();
      try {
        return katex.renderToString(restored, {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return `$${math}$`;
      }
    });

    processed = processed.replace(/\u0000/g, '\\');

    processed = processed.replace(/\\begin\{([^}]+)\}([\s\S]*?)\\end\{\1\}/g, (_, env, body) => {
      try {
        return katex.renderToString(`\\begin{${env}}${body}\\end{${env}}`, {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        return _;
      }
    });

    return processed;
  }, [content]);

  return (
    <span
      className={`math-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function MathInline({ content }: { content: string }) {
  return <MathRenderer content={content} />;
}