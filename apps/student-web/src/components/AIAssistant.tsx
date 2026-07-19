import { useState, useRef, useEffect, useCallback } from 'react';
import { aiApi, type ChatMessage } from '../api/ai';

interface AIAssistantProps {
  /** 上下文信息（如当前单词、当前题目） */
  context?: string;
  /** 浮动按钮的提示文字 */
  buttonTitle?: string;
}

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * AI 助手浮动面板组件。
 * 可集成到词汇学习、题库练习等页面，提供上下文相关的 AI 问答。
 * 点击右下角浮动按钮展开/收起对话面板。
 */
export default function AIAssistant({
  context,
  buttonTitle = 'AI 助手',
}: AIAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 自动滚动到最新消息 */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /** 打开时自动聚焦输入框 */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  /** 发送消息 */
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userBubble: ChatBubble = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userBubble]);
    setInput('');
    setLoading(true);

    // 创建一个空的 AI 气泡，流式追加内容
    const aiBubbleId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: aiBubbleId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }]);

    const history: ChatMessage[] = messages.slice(-5).map((b) => ({
      role: b.role,
      content: b.content,
    }));
    history.push({ role: 'user', content: text });

    try {
      await aiApi.chatStream(
        history,
        {
          onChunk: (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiBubbleId
                  ? { ...m, content: m.content + chunk }
                  : m
              )
            );
          },
          onDone: () => {
            // 流结束，检查是否为空回复
            setMessages((prev) => {
              const aiMsg = prev.find((m) => m.id === aiBubbleId);
              if (aiMsg && !aiMsg.content) {
                return prev.map((m) =>
                  m.id === aiBubbleId
                    ? { ...m, content: '抱歉，我暂时无法回答。' }
                    : m
                );
              }
              return prev;
            });
          },
          onError: (msg) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiBubbleId
                  ? { ...m, content: prev.find((x) => x.id === aiBubbleId)?.content || `抱歉，连接 AI 服务时出错：${msg}` }
                  : m
              )
            );
          },
        },
        context,
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiBubbleId
            ? { ...m, content: m.content || `抱歉，连接 AI 服务时出错：${err?.message || '未知错误'}。请稍后重试。` }
            : m
        )
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, context]);

  /** 回车发送 */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /** 快捷提问 */
  function quickAsk(question: string) {
    setInput(question);
    setTimeout(() => handleSend(), 0);
  }

  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600
          text-white shadow-lg shadow-blue-300 hover:shadow-xl hover:scale-110 transition-all
          flex items-center justify-center text-2xl"
        title={buttonTitle}
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* 对话面板 */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-8rem)]
          bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* 标题栏 */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span className="font-medium text-sm">AI 助手</span>
            </div>
            <button
              onClick={() => setMessages([])}
              className="text-xs text-white/80 hover:text-white transition-colors"
            >
              清空
            </button>
          </div>

          {/* 对话区域 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🤖</div>
                <p className="text-sm text-gray-500 mb-4">
                  有什么疑问？随时问我！
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => quickAsk('请解释一下这个知识点')}
                    className="block w-full text-left px-3 py-2 bg-white rounded-lg text-xs text-blue-600 hover:bg-blue-50 transition-colors border border-gray-100"
                  >
                    💡 请解释一下这个知识点
                  </button>
                  <button
                    onClick={() => quickAsk('给我一些相关的练习建议')}
                    className="block w-full text-left px-3 py-2 bg-white rounded-lg text-xs text-blue-600 hover:bg-blue-50 transition-colors border border-gray-100"
                  >
                    📝 给我一些相关的练习建议
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-white text-gray-800 rounded-bl-md border border-gray-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))
            )}

            {/* 加载态 — 仅在 AI 气泡内容仍为空时显示（流式开始后隐藏） */}
            {loading && (() => {
              const lastMsg = messages[messages.length - 1];
              const isEmpty = !lastMsg || lastMsg.role !== 'assistant' || !lastMsg.content;
              if (!isEmpty) return null;
              return (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 border border-gray-100">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              );
            })()}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <div className="border-t border-gray-100 p-3 flex gap-2 bg-white">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="输入问题..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm
                focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100
                disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium
                hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              发送
            </button>
          </div>
        </div>
      )}
      </>
  );
}
