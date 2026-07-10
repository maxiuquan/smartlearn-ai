import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'smartlearn_token';

// ─── 请求拦截器：从 localStorage 读取 token 并注入 Authorization 头 ───
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── 响应拦截器：401 时清除 token 并跳转登录页 ───
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // 清除无效 token
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('smartlearn_refresh_token');
      // 避免在 /login 页面死循环跳转
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// 游戏类型映射：gameId → API 支持的 game_type
// 与后端 _generate_vocab_question 的 game_id 路由保持一致
// 7 种真实交互题型：multiple_choice / tap_match / listen_select / spelling / drag_sort / word_bank / fill_blank
const GAME_TYPE_MAP: Record<string, string> = {
  // MULTIPLE_CHOICE 选择题（7 款）
  'vocabulary-duel': 'multiple_choice',
  'high-frequency-challenge': 'multiple_choice',
  'wrong-question-boss': 'multiple_choice',
  'daily-quiz-arena': 'multiple_choice',
  'knowledge-combo-streak': 'multiple_choice',
  'memory-maze': 'multiple_choice',
  'study-team-raid': 'multiple_choice',
  // TAP_MATCH 点击配对消除（5 款）
  'word-match-blast': 'tap_match',
  'synonym-antonym-match': 'tap_match',
  'picture-word-match': 'tap_match',
  'memory-flip-match': 'tap_match',
  'formula-link': 'tap_match',
  // LISTEN_SELECT 听音选词（1 款）
  'listening-dash': 'listen_select',
  // SPELLING 拼写输入（3 款）
  'spelling-bee': 'spelling',
  'word-bubble-pop': 'spelling',
  'word-chain': 'spelling',
  // DRAG_SORT 拖拽排序（3 款）
  'sentence-untangle': 'drag_sort',
  'root-affix-tree': 'drag_sort',
  'proof-step-sort': 'drag_sort',
  // WORD_BANK 词库填空（4 款）
  'cloze-sprint': 'word_bank',
  'word-form-master': 'word_bank',
  'crossword-quest': 'word_bank',
  'flashcard-rush': 'word_bank',
  // FILL_BLANK 填空输入（1 款）
  'limit-blitz': 'fill_blank',
  // MULTIPLE_CHOICE 数学选择题（1 款）
  'problem-quest-map': 'multiple_choice',
};

// 6.1① 学科映射：gameId → subject（vocabulary/math/cross_subject）
// 与 data/games/games-config.json 的 category 字段保持一致。
const GAME_SUBJECT_MAP: Record<string, string> = {
  // 词汇类（16 款）
  'word-match-blast': 'vocabulary',
  'spelling-bee': 'vocabulary',
  'root-affix-tree': 'vocabulary',
  'cloze-sprint': 'vocabulary',
  'sentence-untangle': 'vocabulary',
  'vocabulary-duel': 'vocabulary',
  'flashcard-rush': 'vocabulary',
  'listening-dash': 'vocabulary',
  'word-chain': 'vocabulary',
  'word-bubble-pop': 'vocabulary',
  'synonym-antonym-match': 'vocabulary',
  'picture-word-match': 'vocabulary',
  'crossword-quest': 'vocabulary',
  'word-form-master': 'vocabulary',
  'high-frequency-challenge': 'vocabulary',
  'memory-flip-match': 'vocabulary',
  // 数学类（4 款）
  'limit-blitz': 'math',
  'formula-link': 'math',
  'proof-step-sort': 'math',
  'problem-quest-map': 'math',
  // 跨科目类（5 款）
  'wrong-question-boss': 'cross_subject',
  'daily-quiz-arena': 'cross_subject',
  'knowledge-combo-streak': 'cross_subject',
  'memory-maze': 'cross_subject',
  'study-team-raid': 'cross_subject',
};

export function getGameType(gameId: string): string {
  return GAME_TYPE_MAP[gameId] || 'multiple_choice';
}

export function getGameSubject(gameId: string): string {
  return GAME_SUBJECT_MAP[gameId] || 'vocabulary';
}

// 游戏名称映射
export function getGameDisplayName(gameId: string): string {
  const names: Record<string, string> = {
    'multiple_choice': '选择题',
    'spelling': '拼写题',
    'fill_blank': '填空题',
    'tap_match': '配对消除',
    'listen_select': '听音选词',
    'drag_sort': '拖拽排序',
    'word_bank': '词库填空',
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
  const subject = getGameSubject(params.gameId);
  // 6.1② 不再硬编码 student_001——后端用 JWT sub 优先作 user_id，
  //     此处 user_id 留空，由 Authorization 头透传 JWT。
  const res = await client.post('/word-games/start', {
    user_id: params.userId || '',
    game_type: gameType,
    game_id: params.gameId,    // 6.2⑤ 真实游戏标识
    subject,                    // 6.1① 学科分流
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
// 6.2⑥ 优先按 game_id 分榜（25 款游戏独立榜），无 game_id 时回退到 game_type。
export async function getLeaderboard(
  gameId?: string,
  gameType?: string,
  limit = 10,
) {
  const res = await client.post('/word-games/leaderboard', {
    game_id: gameId || null,
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
