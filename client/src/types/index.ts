export interface KnowledgePoint {
  id: number;
  name: string;
  category: string;
  chapter: string;
  description: string;
  difficulty: number;
  prerequisites?: { id: number; name: string }[];
  children?: KnowledgePoint[];
  questionCount?: number;
}

export interface KnowledgeTree {
  category: string;
  knowledgePoints: KnowledgePoint[];
}

export interface Question {
  id: number;
  content: string;
  questionType: 'choice' | 'fill_in' | 'essay';
  options: string[] | null;
  difficulty: number;
  source: string | null;
  knowledgePoints: { id: number; name: string }[];
}

export interface QuestionSolution {
  id: number;
  answer: string;
  solution: string;
}

export interface AnalysisResult {
  isCorrect: boolean;
  correctAnswer: string;
  analysis: string;
  weakPoints: WeakPoint[];
  prerequisiteGaps: PrerequisiteGap[];
  recommendedQuestions: number[];
  updatedLevel: number;
  updatedLevelLabel: string;
  nextReviewIn: string;
}

export interface WeakPoint {
  id: number;
  name: string;
  category: string;
  reason: string;
}

export interface PrerequisiteGap {
  id: number;
  name: string;
  category: string;
  masteryLevel: number;
}

export interface AnswerRecord {
  id: number;
  questionId: number;
  questionContent: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpent: number | null;
  analysis: string | null;
  weakPointIds: number[];
  knowledgePoints: { id: number; name: string }[];
  createdAt: string;
}

export interface UserProgress {
  [category: string]: {
    id: number;
    name: string;
    masteryLevel: number;
    theta: number;
    level: number;
    totalAttempts: number;
    correctAttempts: number;
    lastPracticedAt: string | null;
    nextReviewAt: string | null;
  }[];
}

export interface PracticeStats {
  totalAnswers: number;
  correctAnswers: number;
  accuracy: number;
  todayAnswers: number;
  todayCorrect: number;
  todayAccuracy: number;
  last7Days: { date: string; total: number; correct: number }[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  targetExam: string | null;
}

export interface ReviewTask {
  knowledgePointId: number;
  name: string;
  category: string;
  chapter: string;
  theta: number;
  level: number;
  levelLabel: string;
  nextReviewAt: string | null;
  isOverdue: boolean;
  suggestedQuestionId: number | null;
}

export interface ReviewStatus {
  tasks: ReviewTask[];
  totalCount: number;
  dueCount: number;
  yellowDotCount: number;
}

export interface YellowDotStatus {
  yellowDotCount: number;
  dueTodayCount: number;
  categories: { category: string; count: number }[];
}

export interface AiGuessItem {
  questionId: number;
  content: string;
  difficulty: number;
  knowledgePoints: string[];
  prediction: 'green' | 'orange' | 'red';
  confidence: number;
  reason: string;
}

export interface AiGuessResult {
  bookName: string;
  prediction: AiGuessItem[];
  summary: { canSkip: number; shouldDo: number; mustReview: number; total: number };
  estimatedTimeSaved: string;
}

export interface ScaffoldSession {
  sessionId: string;
  questionContent: string;
  knowledgePoints: string[];
  difficulty: number;
  currentHintStep: number;
  totalHints: number;
}

export interface ScaffoldHint {
  step: number;
  content: string;
  triggerCondition: string | null;
}

export interface ScaffoldHintResponse {
  hint: ScaffoldHint | null;
  solution?: string;
  answer?: string;
  currentStep: number;
  totalHints?: number;
  allHintsUsed: boolean;
}

export interface StudyPlanData {
  id: number;
  examType: string;
  startDate: string;
  endDate: string;
  currentWeek: number;
  totalWeeks: number;
  items: StudyPlanItemData[];
}

export interface StudyPlanItemData {
  id: number;
  weekNumber: number;
  status: string;
  knowledgePoint: {
    id: number;
    name: string;
    category: string;
    chapter: string;
  };
}

export interface Word {
  id: number;
  word: string;
  phonetic: string | null;
  definition: string;
  exampleSentence: string | null;
  partOfSpeech: string | null;
  difficulty: string;
  category: string;
}

export interface UserWord extends Word {
  memoryLevel: number;
  reviewCount: number;
  lastReviewed: string | null;
  nextReview: string | null;
  needReview: boolean;
}

export interface GeneratedArticle {
  id: number;
  title: string;
  content: string;
  words: { word: string; definition: string; phonetic?: string | null }[];
  questions?: ArticleQuestion[];
  questionCount?: number;
  createdAt?: string;
}

export interface ArticleQuestion {
  id: number;
  question: string;
  options: string[];
  answer: string;
  explanation: string | null;
}

export interface Recommendations {
  weakPoints: { id: number; name: string; category: string; mastery: number; level: number }[];
  nextToLearn: { id: number; name: string; category: string; reason: string }[];
}

export const LEVEL_CONFIG = [
  { level: 0, label: '未学习', color: 'bg-gray-200', textColor: 'text-gray-400', range: '0%', icon: '·' },
  { level: 1, label: 'Lv.1 了解', color: 'bg-orange-400', textColor: 'text-orange-600', range: '1-40%', icon: '○' },
  { level: 2, label: 'Lv.2 熟悉', color: 'bg-yellow-400', textColor: 'text-yellow-600', range: '41-70%', icon: '◐' },
  { level: 3, label: 'Lv.3 掌握', color: 'bg-blue-400', textColor: 'text-blue-600', range: '71-90%', icon: '◉' },
  { level: 4, label: 'Lv.4 精通', color: 'bg-green-400', textColor: 'text-green-600', range: '91-100%', icon: '●' },
];

export function getLevelIndex(level: number): number {
  return Math.max(0, Math.min(4, level));
}

export function getLevelConfig(level: number) {
  return LEVEL_CONFIG[getLevelIndex(level)];
}

export function getLevelLabel(level: number): string {
  return LEVEL_CONFIG[getLevelIndex(level)].label;
}

export interface AchievementData {
  id: number;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  condition: string;
  threshold: number;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface CheckInStatus {
  todayChecked: boolean;
  streak: number;
  history: { date: string; streak: number }[];
}

export interface LevelDistribution {
  level: number;
  label: string;
  count: number;
  color: string;
}

export interface ExamReadiness {
  overall: number;
  overallLabel: string;
  categories: { category: string; readiness: number; label: string }[];
}

export interface GameStats {
  totalGames: number;
  totalScore: number;
  todayGames: number;
  todayScore: number;
  gameTypeStats: {
    gameType: string;
    totalPlayed: number;
    bestScore: number;
    averageAccuracy: number;
    lastPlayed: string | null;
  }[];
}

export interface LearningPath {
  currentLevel: string;
  levelLabel: string;
  targetExam: string;
  learningPath: {
    label: string;
    description: string;
    weeklyGoal: number;
    phases: {
      name: string;
      focus: string;
      wordsTarget: number;
      weeks: number;
      tasks: string[];
    }[];
  };
  progress: {
    totalWordsLearned: number;
    wordsMastered: number;
    masteryRate: number;
  };
}

export interface AssessmentResult {
  accuracy: number;
  correctCount: number;
  totalQuestions: number;
  level: string;
  learningPath: LearningPath['learningPath'];
}

export interface GameWord {
  id: number;
  word: string;
  phonetic: string | null;
  definition: string;
  exampleSentence: string | null;
  partOfSpeech: string | null;
  difficulty: string;
  category: string;
}

export interface SubjectInfo {
  currentSubject: string | null;
  englishLevel: string | null;
  targetExam: string | null;
}