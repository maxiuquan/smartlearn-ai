import client from './client';

/** 对话消息 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** AI 对话响应 */
export interface ChatResponse {
  reply: string;
  model?: string;
  offline?: boolean;
  simulated?: boolean;
  reason?: string;
}

/** 流式回调 */
export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone?: (model?: string) => void;
  onError?: (msg: string) => void;
}

/**
 * AI 对话 API 封装层。
 * 调用 ai-engine 的 /chat 接口（经 nginx 或 vite dev proxy 代理到 ai-engine:8001）。
 */
export const aiApi = {
  /**
   * 发送对话消息
   * POST /chat
   * @param messages 对话历史消息列表
   * @param context 可选上下文信息
   */
  async chat(messages: ChatMessage[], context?: string): Promise<ChatResponse> {
    // AI 对话生成可能需要较长时间，单独设置 120 秒超时
    // （全局 client timeout 为 15 秒，不足以等待 AI 回复）
    const res = await client.post('/chat', {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      context: context || undefined,
    }, { timeout: 120000 });
    return res.data;
  },

  /**
   * 流式对话（SSE）— 逐 token 返回，大幅降低首字延迟
   * POST /chat/stream
   * @param messages 对话历史消息列表
   * @param callbacks 回调函数
   * @param context 可选上下文信息
   */
  async chatStream(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    context?: string,
  ): Promise<void> {
    // 直接使用 fetch 消费 SSE 流（axios 不原生支持 ReadableStream）
    const baseURL = (client.defaults?.baseURL || '');
    const url = baseURL.endsWith('/') ? `${baseURL}chat/stream` : `${baseURL}/chat/stream`;
    const token = localStorage.getItem('smartlearn_token') || '';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        context: context || undefined,
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      callbacks.onError?.(`AI 服务请求失败 (${res.status})`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE 以 \n\n 分隔事件
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          // 解析 data: 行
          const lines = rawEvent.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;
            try {
              const evt = JSON.parse(jsonStr);
              if (evt.type === 'chunk' && evt.content) {
                callbacks.onChunk(evt.content);
              } else if (evt.type === 'done') {
                callbacks.onDone?.(evt.model);
              } else if (evt.type === 'error') {
                callbacks.onError?.(evt.message || 'AI 回复出错');
              }
            } catch {
              // 忽略 JSON 解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};
