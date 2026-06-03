// 用户相关类型
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// 题目相关类型
export type QuestionType = 'choice' | 'fill' | 'calculate' | 'proof';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  type: QuestionType;
  content: string;
  options?: QuestionOption[];
  answer: string;
  analysis: string;
  difficulty: DifficultyLevel;
  knowledgePoints: string[];
  source?: string;
  createdAt: string;
}

export interface QuestionOption {
  id: string;
  label: string;
  content: string;
}

export interface UserAnswer {
  questionId: string;
  answer: string;
  isCorrect: boolean;
  timeSpent: number;
  answeredAt: string;
}

// 知识点相关类型
export interface KnowledgePoint {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  description?: string;
  masteryLevel: number; // 0-100
  children?: KnowledgePoint[];
}

export interface AbilityProfile {
  knowledgePointId: string;
  accuracy: number;
  speed: number;
  consistency: number;
  lastPracticedAt: string;
}

// 单词相关类型
export interface Word {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  exampleTranslation: string;
  difficulty: DifficultyLevel;
  mastered: boolean;
  reviewCount: number;
  nextReviewAt: string;
}

export interface WordProgress {
  wordId: string;
  correctCount: number;
  wrongCount: number;
  lastReviewAt: string;
  masteryLevel: number;
}

// 学习计划相关类型
export interface StudyPlan {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  targetExamDate?: string;
  dailyGoal: DailyGoal[];
  progress: number;
}

export interface DailyGoal {
  id: string;
  date: string;
  tasks: StudyTask[];
  completed: boolean;
}

export interface StudyTask {
  id: string;
  title: string;
  type: 'question' | 'word' | 'review' | 'video';
  targetCount: number;
  completedCount: number;
  estimatedTime: number; // minutes
  knowledgePointIds?: string[];
}

// 成就相关类型
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  progress: number;
  target: number;
}

// 学习报告相关类型
export interface StudyReport {
  date: string;
  totalQuestions: number;
  correctQuestions: number;
  totalWords: number;
  learnedWords: number;
  studyTime: number; // minutes
  knowledgePointProgress: Record<string, number>;
}

// 习题册相关类型
export interface Workbook {
  id: string;
  name: string;
  description: string;
  totalQuestions: number;
  completedQuestions: number;
  difficulty: DifficultyLevel;
  source: string;
}

// 真题相关类型
export interface PastExam {
  id: string;
  year: number;
  subject: string;
  totalQuestions: number;
  duration: number; // minutes
  completed: boolean;
  score?: number;
}

// 导航相关类型
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  QuestionDetail: { questionId: string };
  KnowledgeDetail: { knowledgeId: string };
  WordGame: { gameType: 'match' | 'spell' | 'rain' };
  WorkbookDetail: { workbookId: string };
  PastExamDetail: { examId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Learn: undefined;
  Knowledge: undefined;
  Word: undefined;
  Profile: undefined;
};

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
