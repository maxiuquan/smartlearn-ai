const BASE_URL = '/api';

import type { AnalysisResult, WeakPoint, PrerequisiteGap } from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ id: number; username: string; email: string; targetExam: string | null }>(
      '/user/login', { method: 'POST', body: JSON.stringify({ username, password }) }
    ),
  register: (data: { username: string; email: string; password: string; targetExam?: string }) =>
    request<{ id: number }>('/user/register', { method: 'POST', body: JSON.stringify(data) }),
  getUser: (id: number) =>
    request<{ id: number; username: string; email: string; targetExam: string | null; wordCount: number; answerCount: number }>(
      `/user/${id}`
    ),

  // Knowledge
  getKnowledgeTree: () =>
    request<{ tree: { category: string; knowledgePoints: unknown[] }[]; totalCount: number }>('/knowledge/tree'),
  getKnowledgePoint: (id: number) => request<unknown>(`/knowledge/point/${id}`),
  getRecommendations: (userId: number) =>
    request<{ weakPoints: unknown[]; nextToLearn: unknown[] }>(`/knowledge/recommendations/${userId}`),
  getProgress: (userId: number) =>
    request<{ progress: Record<string, unknown[]>; overallMastery: number }>(`/knowledge/progress/${userId}`),

  // Questions
  getQuestions: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ questions: unknown[]; total: number; page: number; totalPages: number }>(`/questions${qs}`);
  },
  getQuestion: (id: number) => request<unknown>(`/questions/${id}`),
  getSolution: (id: number) => request<{ id: number; answer: string; solution: string }>(`/questions/${id}/solution`),

  // Practice
  submitAnswer: (data: { userId: number; questionId: number; userAnswer: string; timeSpent?: number }) =>
    request<AnalysisResult>('/practice/submit', { method: 'POST', body: JSON.stringify(data) }),
  getHistory: (userId: number, page = 1) =>
    request<{ records: unknown[]; total: number }>(`/practice/history/${userId}?page=${page}&limit=20`),
  getStats: (userId: number) =>
    request<{ totalAnswers: number; correctAnswers: number; accuracy: number; todayAnswers: number; todayCorrect: number; todayAccuracy: number; last7Days: unknown[] }>(
      `/practice/stats/${userId}`
    ),

  // English
  getWords: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ words: unknown[]; total: number }>(`/english/words${qs}`);
  },
  getUserWords: (userId: number) =>
    request<{ total: number; toReview: number; mastered: number; words: unknown[] }>(`/english/user-words/${userId}`),
  reviewWord: (data: { userId: number; wordId: number; remembered: boolean }) =>
    request<{ memoryLevel: number; nextReview: string; message: string }>('/english/review-word', { method: 'POST', body: JSON.stringify(data) }),
  generateArticle: (data: { userId?: number; wordIds?: number[] }) =>
    request<unknown>('/english/generate-article', { method: 'POST', body: JSON.stringify(data) }),
  getArticles: (page = 1) =>
    request<{ articles: unknown[]; total: number }>(`/english/articles?page=${page}&limit=10`),
  getArticle: (id: number) => request<unknown>(`/english/articles/${id}`),

  getStudyPlan: (userId: number) =>
    request<unknown>(`/study-plan/${userId}`),
  createStudyPlan: (data: { userId: number; examType: string; startDate: string; totalWeeks: number }) =>
    request<unknown>('/study-plan/create', { method: 'POST', body: JSON.stringify(data) }),
  updateStudyWeek: (data: { userId: number; planId: number; weekNumber: number }) =>
    request<unknown>('/study-plan/update-week', { method: 'POST', body: JSON.stringify(data) }),

  checkIn: (userId: number) =>
    request<unknown>('/checkin', { method: 'POST', body: JSON.stringify({ userId }) }),
  getCheckInStatus: (userId: number) =>
    request<unknown>(`/checkin/${userId}`),

  getAchievements: () =>
    request<unknown>('/achievements'),
  getUserAchievements: (userId: number) =>
    request<unknown>(`/achievements/user/${userId}`),

  selectSubject: (userId: number, subject: string) =>
    request<unknown>('/subject/select', { method: 'POST', body: JSON.stringify({ userId, subject }) }),
  getSubject: (userId: number) =>
    request<{ currentSubject: string | null; englishLevel: string | null; targetExam: string | null }>(`/subject/${userId}`),
  setEnglishLevel: (userId: number, level: string) =>
    request<unknown>('/subject/set-english-level', { method: 'POST', body: JSON.stringify({ userId, level }) }),
  setTargetExam: (userId: number, targetExam: string) =>
    request<unknown>('/subject/set-target-exam', { method: 'POST', body: JSON.stringify({ userId, targetExam }) }),

  getWordsPool: (category?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (limit) params.set('limit', String(limit));
    return request<{ words: unknown[]; examType: string }>(`/english-games/words-pool?${params.toString()}`);
  },
  saveGameScore: (data: { userId: number; gameType: string; score: number; accuracy?: number; timeSpent?: number }) =>
    request<unknown>('/english-games/score', { method: 'POST', body: JSON.stringify(data) }),
  getGameStats: (userId: number) =>
    request<unknown>(`/english-games/stats/${userId}`),
  getGameLeaderboard: (gameType: string) =>
    request<unknown>(`/english-games/leaderboard/${gameType}`),

  getEnglishAssessment: () =>
    request<{ questions: unknown[] }>('/english-path/assessment'),
  submitEnglishAssessment: (data: { userId?: number; answers: { questionId: number; answer: string }[] }) =>
    request<{ accuracy: number; level: string; learningPath: unknown }>('/english-path/assessment/submit', { method: 'POST', body: JSON.stringify(data) }),
  getEnglishPath: (userId: number) =>
    request<unknown>(`/english-path/${userId}`),
};