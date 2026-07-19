import { useState, useRef, useEffect, useCallback } from 'react';
import { aiApi, type ChatMessage } from '../api/ai';

/** 对话气泡 */
interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  simulated?: boolean;
  timestamp: number;
}

/**
 * AI 辅导页面。
 * 对话气泡流界面；输入框+发送按钮；调 ai.chat()。
 * 展示 simulated 标记（离线模式）；加载态/错误态。
 */
export default function AITutor() {
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 自动滚动到最新消息 */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /** 发送消息 */
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    // 添加用户消息
    const userBubble: ChatBubble = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userBubble]);
    setInput('');
    setError('');
    setLoading(true);

    try {
      // 构建对话历史（最近 10 条）
      const history: ChatMessage[] = messages.slice(-10).map((b) => ({
        role: b.role,
        content: b.content,
      }));
      history.push({ role: 'user', content: text });

      const res = await aiApi.chat(history);

      const aiBubble: ChatBubble = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply || '抱歉，我暂时无法回答。',
        simulated: res.simulated,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiBubble]);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'AI 服务暂时不可用');
      // 添加错误提示消息
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: '抱歉，连接 AI 服务时出错。请稍后重试。',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages]);

  /** 回车发送 */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /** 清空对话 */
  function handleClear() {
    setMessages([]);
    setError('');
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🤖 AI 辅导</h1>
          <p className="text-sm text-gray-500 mt-1">智能问答，随时为你解答学习疑问</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            清空对话
          </button>
        )}
      </div>

      {/* 对话区域 */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">
              你好！我是 SmartLearn AI 辅导助手
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md">
              可以问我任何学习相关的问题，包括数学公式推导、英语语法解析、专业课知识点等。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
              {[
                '帮我解释一下极限的 ε-δ 定义',
                '如何区分现在完成时和过去时？',
                '泰勒展开的原理是什么？',
                '考研数学复习建议',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-left px-4 py-3 bg-blue-50 text-blue-600 rounded-lg text-sm
                    hover:bg-blue-100 transition-colors"
                >
                  💬 {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs">🤖</span>
                      {msg.simulated && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                          离线模拟
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}

            {/* 加载态 */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {/* 输入区域 */}
      <div className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="输入你的问题..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:border-blue-400
            focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors
            disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium
            hover:bg-blue-600 transition-colors disabled:opacity-50
            disabled:cursor-not-allowed shadow-md shadow-blue-200"
        >
          {loading ? '思考中...' : '发送'}
        </button>
      </div>
    </div>
  );
}
