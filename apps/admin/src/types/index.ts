// 用户相关类型
export interface User {
  id: string;
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  nickname?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  profile?: UserProfile;
}

export type UserRole = 'student' | 'teacher' | 'admin' | 'super_admin';

export type UserStatus = 'active' | 'inactive' | 'banned';

export interface UserProfile {
  grade?: string;
  school?: string;
  subjects?: string[];
}

// 题目相关类型
export interface Question {
  id: string;
  type: QuestionType;
  subject: string;
  content: string;
  options?: QuestionOption[];
  answer: string;
  analysis?: string;
  difficulty: number;
  knowledgePoints: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  creator: string;
  status: QuestionStatus;
}

export type QuestionType = 'choice' | 'fill' | 'calculate' | 'essay';

export type QuestionStatus = 'draft' | 'published' | 'archived';

export interface QuestionOption {
  key: string;
  content: string;
}

// 知识点相关类型
export interface KnowledgePoint {
  id: string;
  name: string;
  subject: string;
  parentId?: string;
  description?: string;
  level: number;
  order: number;
  dependencies?: string[];
  children?: KnowledgePoint[];
  createdAt: string;
  updatedAt: string;
}

// 学科相关类型
export interface Subject {
  id: string;
  name: string;
  code: string;
  icon?: string;
  color?: string;
  description?: string;
  gradeRange: string[];
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

// 单词相关类型
export interface Word {
  id: string;
  word: string;
  phonetic?: string;
  meaning: string;
  examples?: string[];
  audio?: string;
  bookId: string;
  difficulty: number;
  frequency: number;
  createdAt: string;
  updatedAt: string;
}

export interface WordBook {
  id: string;
  name: string;
  description?: string;
  cover?: string;
  wordCount: number;
  subject: string;
  level: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

// 真题相关类型
export interface PastExam {
  id: string;
  title: string;
  subject: string;
  year: number;
  province?: string;
  examType: string;
  questions: string[];
  totalScore: number;
  duration: number;
  difficulty: number;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

// 习题册相关类型
export interface Workbook {
  id: string;
  name: string;
  subject: string;
  description?: string;
  cover?: string;
  questions: string[];
  difficulty: number;
  isPublic: boolean;
  creator: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

// 统计相关类型
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalQuestions: number;
  totalKnowledgePoints: number;
  totalWords: number;
  todayLogins: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
}

export interface UserStats {
  userId: string;
  studyDays: number;
  totalStudyTime: number;
  questionsCompleted: number;
  accuracy: number;
  wordsLearned: number;
  knowledgePoints: KnowledgePointProgress[];
}

export interface KnowledgePointProgress {
  id: string;
  name: string;
  progress: number;
  mastery: number;
}

// 系统设置相关类型
export interface SystemConfig {
  siteName: string;
  siteLogo?: string;
  siteDescription?: string;
  allowRegister: boolean;
  defaultRole: UserRole;
  maxUploadSize: number;
  allowedFileTypes: string[];
  emailConfig?: EmailConfig;
  smsConfig?: SmsConfig;
}

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  from: string;
}

export interface SmsConfig {
  provider: string;
  accessKey: string;
  signName: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 登录相关类型
export interface LoginParams {
  username: string;
  password: string;
  remember?: boolean;
}

export interface LoginResult {
  token: string;
  user: User;
}

// 菜单类型
export interface MenuItem {
  key: string;
  name: string;
  icon?: React.ReactNode;
  path?: string;
  children?: MenuItem[];
  authority?: string[];
  hideInMenu?: boolean;
}
