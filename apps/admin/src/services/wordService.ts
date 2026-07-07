import request, { api, pageApi, PageParams } from './request';
import { Word, WordBook, PaginatedResponse } from '@/types';

// ========== 单词管理 ==========

// 获取单词列表
export async function getWordList(params: PageParams): Promise<PaginatedResponse<Word>> {
  return pageApi.get<Word>('/words', params);
}

// 获取单词详情
export async function getWord(id: string): Promise<Word> {
  return api.get<Word>(`/words/${id}`);
}

// 创建单词
export async function createWord(data: Partial<Word>): Promise<Word> {
  return api.post<Word>('/words', data);
}

// 更新单词
export async function updateWord(id: string, data: Partial<Word>): Promise<Word> {
  return api.put<Word>(`/words/${id}`, data);
}

// 删除单词
export async function deleteWord(id: string): Promise<void> {
  return api.delete<void>(`/words/${id}`);
}

// 批量删除单词
export async function batchDeleteWords(ids: string[]): Promise<void> {
  return api.post<void>('/words/batch-delete', { ids });
}

// 批量导入单词
export async function importWords(file: File, bookId: string): Promise<{ success: number; failed: number }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bookId', bookId);
  return api.post<{ success: number; failed: number }>('/words/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// 导出单词
export async function exportWords(bookId: string): Promise<Blob> {
  const response = await request.get('/words/export', {
    params: { bookId },
    responseType: 'blob',
  });
  return response.data as Blob;
}

// ========== 词书管理 ==========

// 获取词书列表
export async function getWordBookList(params: PageParams): Promise<PaginatedResponse<WordBook>> {
  return pageApi.get<WordBook>('/word-books', params);
}

// 获取词书详情
export async function getWordBook(id: string): Promise<WordBook> {
  return api.get<WordBook>(`/word-books/${id}`);
}

// 创建词书
export async function createWordBook(data: Partial<WordBook>): Promise<WordBook> {
  return api.post<WordBook>('/word-books', data);
}

// 更新词书
export async function updateWordBook(id: string, data: Partial<WordBook>): Promise<WordBook> {
  return api.put<WordBook>(`/word-books/${id}`, data);
}

// 删除词书
export async function deleteWordBook(id: string): Promise<void> {
  return api.delete<void>(`/word-books/${id}`);
}

// 启用/禁用词书
export async function toggleWordBook(id: string, status: boolean): Promise<void> {
  return api.post<void>(`/word-books/${id}/toggle`, { status });
}

// 获取词书统计
export async function getWordBookStats(id: string): Promise<{
  wordCount: number;
  learnedCount: number;
  userCount: number;
}> {
  return api.get(`/word-books/${id}/stats`);
}
