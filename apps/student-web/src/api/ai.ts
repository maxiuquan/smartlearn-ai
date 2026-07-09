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
    const res = await client.post('/chat', {
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      context: context || undefined,
    });
    return res.data;
  },
};
