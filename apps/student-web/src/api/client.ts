import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// 游戏类型映射：gameId → API 支持的 game_type
const GAME_TYPE_MAP: Record<string, string> = {
  'word-match-blast': 'multiple_choice',
  'spelling-bee': 'spelling',
  'root-affix-tree': 'fill_blank',
  'cloze-sprint': 'fill_blank',
  'sentence-untangle': 'fill_blank',
  'vocabulary-duel': 'multiple_choice',
  'flashcard-rush': 'multiple_choice',
  'listening-dash': 'multiple_choice',
  'word-chain': 'spelling',
  'word-bubble-pop': 'spelling',
  'synonym-antonym-match': 'multiple_choice',
  'picture-word-match': 'multiple_choice',
  'crossword-quest': 'fill_blank',
  'word-form-master': 'fill_blank',
  'high-frequency-challenge': 'multiple_choice',
  'memory-flip-match': 'multiple_choice',
  'limit-blitz': 'fill_blank',
  'formula-link': 'multiple_choice',
  'proof-step-sort': 'fill_blank',
  'problem-quest-map': 'multiple_choice',
  'wrong-question-boss': 'multiple_choice',
  'daily-quiz-arena': 'multiple_choice',
  'knowledge-combo-streak': 'multiple_choice',
  'memory-maze': 'multiple_choice',
  'study-team-raid': 'multiple_choice',
};

export function getGameType(gameId: string): string {
  return GAME_TYPE_MAP[gameId] || 'multiple_choice';
}

// 游戏名称映射
export function getGameDisplayName(gameId: string): string {
  const names: Record<string, string> = {
    'multiple_choice': '选择题',
    'spelling': '拼写题',
    'fill_blank': '填空题',
  };
  return names[getGameType(gameId)] || '选择题';
}

// 开始游戏
export interface StartGameParams {
  gameId: string;
  userId?: string;
  difficulty?: string;
  wordCount?: number;
}

export async function startGame(params: StartGameParams) {
  const gameType = getGameType(params.gameId);
  const res = await client.post('/word-games/start', {
    user_id: params.userId || 'student_001',
    game_type: gameType,
    difficulty: params.difficulty || 'medium',
    word_count: params.wordCount || 10,
  });
  return res.data;
}

// 提交答案
export interface SubmitAnswerParams {
  sessionId: string;
  questionId: string;
  userAnswer: string;
  timeSpentSeconds: number;
  usedHint?: boolean;
}

export async function submitAnswer(params: SubmitAnswerParams) {
  const res = await client.post('/word-games/submit', {
    session_id: params.sessionId,
    answer: {
      question_id: params.questionId,
      user_answer: params.userAnswer,
      time_spent_seconds: params.timeSpentSeconds,
      used_hint: params.usedHint || false,
    },
  });
  return res.data;
}

// 获取游戏总结
export async function getGameSummary(sessionId: string) {
  const res = await client.get(`/word-games/summary/${sessionId}`);
  return res.data;
}

// 获取排行榜
export async function getLeaderboard(gameType?: string, limit = 10) {
  const res = await client.post('/word-games/leaderboard', {
    game_type: gameType || null,
    limit,
  });
  return res.data;
}

// 获取游戏类型列表
export async function getGameTypes() {
  const res = await client.get('/word-games/game-types');
  return res.data;
}

export default client;