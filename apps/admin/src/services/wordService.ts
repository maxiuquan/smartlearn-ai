import request, { api, pageApi, PageParams } from './request';
import { Word, WordBook, PaginatedResponse } from '@/types';

// 后端实际路由（/api/v1 前缀由 baseURL 统一处理）：
//   GET  /vocab/words?tag=&frequency=&page=&page_size=  词汇列表（已对齐）
//   GET  /vocab/progress                                   用户词汇进度汇总（需用户登录态）
//   GET  /vocab/due?limit=                                  今日待复习词汇（需用户登录态）
//   POST /vocab/events                                     提交单词学习事件（需用户登录态）
// 单词的增删改/单条详情/批量/导入导出、以及全部词书管理，后端均尚未实现。

// ========== 单词管理 ==========

// 获取单词列表
export async function getWordList(params: PageParams): Promise<PaginatedResponse<Word>> {
  return pageApi.get<Word>('/vocab/words', params);
}

// 获取单词详情
// TODO: 后端尚未实现此路由（/vocab 仅有列表/进度/待复习/事件）
export async function getWord(id: string): Promise<Word> {
  return api.get<Word>(`/vocab/words/${id}`);
}

// 创建单词
// TODO: 后端尚未实现此路由
export async function createWord(data: Partial<Word>): Promise<Word> {
  return api.post<Word>('/vocab/words', data);
}

// 更新单词
// TODO: 后端尚未实现此路由
export async function updateWord(id: string, data: Partial<Word>): Promise<Word> {
  return api.put<Word>(`/vocab/words/${id}`, data);
}

// 删除单词
// TODO: 后端尚未实现此路由
export async function deleteWord(id: string): Promise<void> {
  return api.delete<void>(`/vocab/words/${id}`);
}

// 批量删除单词
// TODO: 后端尚未实现此路由
export async function batchDeleteWords(ids: string[]): Promise<void> {
  return api.post<void>('/vocab/words/batch-delete', { ids });
}

// 批量导入单词
// TODO: 后端尚未实现此路由
export async function importWords(file: File, bookId: string): Promise<{ success: number; failed: number }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bookId', bookId);
  return api.post<{ success: number; failed: number }>('/vocab/words/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// 导出单词
// TODO: 后端尚未实现此路由
export async function exportWords(bookId: string): Promise<Blob> {
  const response = await request.get('/vocab/words/export', {
    params: { bookId },
    responseType: 'blob',
  });
  return response.data as Blob;
}

// ========== 词书管理 ==========

// 后端 /vocab 下无任何词书（word-books）路由，以下方法均待后端实现。

// 获取词书列表
// TODO: 后端尚未实现此路由
export async function getWordBookList(params: PageParams): Promise<PaginatedResponse<WordBook>> {
  return pageApi.get<WordBook>('/vocab/word-books', params);
}

// 获取词书详情
// TODO: 后端尚未实现此路由
export async function getWordBook(id: string): Promise<WordBook> {
  return api.get<WordBook>(`/vocab/word-books/${id}`);
}

// 创建词书
// TODO: 后端尚未实现此路由
export async function createWordBook(data: Partial<WordBook>): Promise<WordBook> {
  return api.post<WordBook>('/vocab/word-books', data);
}

// 更新词书
// TODO: 后端尚未实现此路由
export async function updateWordBook(id: string, data: Partial<WordBook>): Promise<WordBook> {
  return api.put<WordBook>(`/vocab/word-books/${id}`, data);
}

// 删除词书
// TODO: 后端尚未实现此路由
export async function deleteWordBook(id: string): Promise<void> {
  return api.delete<void>(`/vocab/word-books/${id}`);
}

// 启用/禁用词书
// TODO: 后端尚未实现此路由
export async function toggleWordBook(id: string, status: boolean): Promise<void> {
  return api.post<void>(`/vocab/word-books/${id}/toggle`, { status });
}

// 获取词书统计
// TODO: 后端尚未实现此路由
export async function getWordBookStats(id: string): Promise<{
  wordCount: number;
  learnedCount: number;
  userCount: number;
}> {
  return api.get(`/vocab/word-books/${id}/stats`);
}
