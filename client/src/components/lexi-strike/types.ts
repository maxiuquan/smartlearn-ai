export interface WordData {
  id: number;
  word: string;
  definition: string;
  phonetic?: string;
  partOfSpeech?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  distractors: string[];
  srsLevel: number;
  srsNextReview: number;
  correctCount: number;
  wrongCount: number;
  lastSeen: number;
}

export interface WordTarget {
  id: number;
  wordData: WordData;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hp: number;
  maxHp: number;
  isBoss: boolean;
  active: boolean;
  hitFlash: number;
  alpha: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  isEnemy: boolean;
}

export interface Explosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export interface PlayerStats {
  score: number;
  combo: number;
  maxCombo: number;
  kills: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  wave: number;
  totalWaves: number;
  timeLeft: number;
  totalTime: number;
  xpGained: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracy: number;
  energy: number;
  maxEnergy: number;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: 'consumable' | 'permanent' | 'cosmetic' | 'wordbook';
  effect: {
    target: 'player' | 'enemy' | 'system';
    attribute: 'hp' | 'shield' | 'attack' | 'speed' | 'exp' | 'energy' | 'time';
    value: number;
    duration: number;
  };
  price: number;
  currency: 'gold' | 'diamond';
  owned: boolean;
  quantity: number;
  icon: string;
}

export interface PlayerInventory {
  gold: number;
  diamonds: number;
  items: ShopItem[];
  activeEffects: ActiveEffect[];
  wordBooks: string[];
  selectedBook: string;
  cosmetics: string[];
  activeSkin: string;
}

export interface ActiveEffect {
  itemId: string;
  attribute: string;
  value: number;
  remainingTime: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  scene: 'road' | 'arena' | 'hybrid';
  mode: 'fps' | 'fighting' | 'fusion';
  description: string;
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme';
  wordBook: string;
  waves: number;
  timePerWave: number;
  enemyConfig: EnemyConfig;
  winCondition: WinCondition;
  loseCondition: LoseCondition;
  unlockRequirement: { level?: number; score?: number; kills?: number };
  rewards: { gold: number; diamonds: number; xp: number };
  isBoss: boolean;
}

export interface EnemyConfig {
  spawnRate: number;
  baseSpeed: number;
  baseHp: number;
  size: number;
  distractors: boolean;
  bossChance: number;
  speedScale: number;
  hpScale: number;
}

export interface WinCondition {
  type: 'kills' | 'survival' | 'boss' | 'score';
  value: number;
}

export interface LoseCondition {
  type: 'hp' | 'missed' | 'time';
  value: number;
}

export type GameState = 'loading' | 'menu' | 'level_select' | 'shop' | 'word_import' | 'playing' | 'paused' | 'result' | 'wave_complete';
export type GameMode = 'fps' | 'arena' | 'fusion';

export interface InputState {
  pointer: { x: number; y: number };
  fire: boolean;
  select: 'A' | 'B' | 'C' | 'D' | null;
  move: { x: number; y: number };
  isMobile: boolean;
}

export interface GameSettings {
  sound: boolean;
  vibration: boolean;
  autoFire: boolean;
  showPhonetic: boolean;
}

export const COLORS = {
  bg: '#0A0A0A',
  bgPanel: '#1A1D24',
  bgDark: '#0D0F14',
  neon: '#00FF9C',
  neonDim: 'rgba(0, 255, 156, 0.3)',
  alert: '#FF4757',
  alertDim: 'rgba(255, 71, 87, 0.3)',
  gold: '#FFD700',
  blue: '#00D2FF',
  purple: '#A29BFE',
  orange: '#FF9F43',
  gray: '#6C757D',
  grayLight: '#AAAAAA',
  white: '#FFFFFF',
  text: '#E0E0E0',
} as const;

export const ITEMS: ShopItem[] = [
  { id: 'item_001', name: '双倍经验卡', description: '结算经验+100%，持续10分钟', type: 'consumable', effect: { target: 'player', attribute: 'exp', value: 100, duration: 600 }, price: 200, currency: 'gold', owned: false, quantity: 0, icon: '📈' },
  { id: 'item_002', name: '护盾发生器', description: '抵挡一次错误答题的伤害', type: 'consumable', effect: { target: 'player', attribute: 'shield', value: 50, duration: 0 }, price: 150, currency: 'gold', owned: false, quantity: 0, icon: '🛡️' },
  { id: 'item_003', name: '透视眼镜', description: '下一题高亮显示正确答案', type: 'consumable', effect: { target: 'system', attribute: 'speed', value: 1, duration: 30 }, price: 100, currency: 'gold', owned: false, quantity: 0, icon: '👁️' },
  { id: 'item_004', name: '攻击力芯片', description: '永久提升词汇算力+5%', type: 'permanent', effect: { target: 'player', attribute: 'attack', value: 5, duration: 0 }, price: 500, currency: 'diamond', owned: false, quantity: 0, icon: '⚔️' },
  { id: 'item_005', name: '黄金AK皮肤', description: '改变武器外观为黄金AK', type: 'cosmetic', effect: { target: 'player', attribute: 'attack', value: 0, duration: 0 }, price: 300, currency: 'diamond', owned: false, quantity: 0, icon: '🔫' },
  { id: 'item_006', name: '能量饮料', description: '恢复30点能量', type: 'consumable', effect: { target: 'player', attribute: 'energy', value: 30, duration: 0 }, price: 80, currency: 'gold', owned: false, quantity: 0, icon: '⚡' },
  { id: 'item_007', name: '时间冻结', description: '冻结倒计时10秒', type: 'consumable', effect: { target: 'system', attribute: 'time', value: 10, duration: 10 }, price: 250, currency: 'gold', owned: false, quantity: 0, icon: '⏱️' },
  { id: 'item_008', name: '速度芯片', description: '永久提升反应速度+3%', type: 'permanent', effect: { target: 'player', attribute: 'speed', value: 3, duration: 0 }, price: 400, currency: 'diamond', owned: false, quantity: 0, icon: '💨' },
  { id: 'item_009', name: '霓虹准星', description: '赛博霓虹特效准星', type: 'cosmetic', effect: { target: 'player', attribute: 'attack', value: 0, duration: 0 }, price: 200, currency: 'diamond', owned: false, quantity: 0, icon: '🎯' },
  { id: 'item_010', name: '急救包', description: '恢复50点HP', type: 'consumable', effect: { target: 'player', attribute: 'hp', value: 50, duration: 0 }, price: 120, currency: 'gold', owned: false, quantity: 0, icon: '💊' },
];

export const WORD_BOOKS = [
  { id: 'free_core', name: '高频核心词', description: '最常用的2000个英语单词', wordCount: 2000, price: 0, currency: 'gold', category: 'CET4核心词' },
  { id: 'cet4_2024', name: '四级大纲词', description: '2024版大学英语四级考试大纲词汇', wordCount: 4500, price: 18, currency: 'diamond', category: 'CET4核心词' },
  { id: 'cet6_2024', name: '六级大纲词', description: '2024版大学英语六级考试大纲词汇', wordCount: 5500, price: 18, currency: 'diamond', category: 'CET6进阶词' },
  { id: 'ky_2025', name: '考研核心词', description: '考研必备核心词汇', wordCount: 5500, price: 28, currency: 'diamond', category: '考研必备词' },
  { id: 'ky_dark', name: '熟词僻义', description: '考研常见熟词僻义陷阱词合集', wordCount: 800, price: 12, currency: 'diamond', category: '考研熟词僻义' },
  { id: 'custom', name: '自定义词库', description: '导入你自己的词库文件', wordCount: 0, price: 0, currency: 'gold', category: '自定义' },
];

export const LEVELS: LevelConfig[] = [
  { id: 'L1_Tutorial', name: '新手公路', scene: 'road', mode: 'fps', description: '初步训练：静态靶，无干扰项，熟悉基本操作', difficulty: 'easy', wordBook: 'free_core', waves: 3, timePerWave: 60, enemyConfig: { spawnRate: 2000, baseSpeed: 0.4, baseHp: 1, size: 40, distractors: false, bossChance: 0, speedScale: 1, hpScale: 1 }, winCondition: { type: 'kills', value: 10 }, loseCondition: { type: 'missed', value: 3 }, unlockRequirement: {}, rewards: { gold: 50, diamonds: 0, xp: 100 }, isBoss: false },
  { id: 'L2_City', name: '城市公路', scene: 'road', mode: 'fps', description: '城市夜间演练：移动靶，出现干扰项，考验反应', difficulty: 'normal', wordBook: 'free_core', waves: 5, timePerWave: 45, enemyConfig: { spawnRate: 1500, baseSpeed: 0.7, baseHp: 2, size: 40, distractors: true, bossChance: 0.1, speedScale: 1.1, hpScale: 1.2 }, winCondition: { type: 'survival', value: 120 }, loseCondition: { type: 'hp', value: 0 }, unlockRequirement: { level: 1 }, rewards: { gold: 100, diamonds: 5, xp: 200 }, isBoss: false },
  { id: 'L3_Arena', name: '初级擂台', scene: 'arena', mode: 'fighting', description: '擂台格斗：1v1对战，词库难度提升，测试词汇掌握', difficulty: 'normal', wordBook: 'free_core', waves: 5, timePerWave: 30, enemyConfig: { spawnRate: 0, baseSpeed: 0, baseHp: 3, size: 50, distractors: true, bossChance: 0.2, speedScale: 1, hpScale: 1.3 }, winCondition: { type: 'kills', value: 5 }, loseCondition: { type: 'hp', value: 0 }, unlockRequirement: { level: 2, score: 500 }, rewards: { gold: 150, diamonds: 10, xp: 300 }, isBoss: false },
  { id: 'L4_Highway', name: '高速公路', scene: 'road', mode: 'fps', description: '四级专项：高速公路急速射击，速度极快', difficulty: 'hard', wordBook: 'cet4_2024', waves: 7, timePerWave: 40, enemyConfig: { spawnRate: 1100, baseSpeed: 1.2, baseHp: 3, size: 38, distractors: true, bossChance: 0.15, speedScale: 1.15, hpScale: 1.4 }, winCondition: { type: 'survival', value: 180 }, loseCondition: { type: 'missed', value: 5 }, unlockRequirement: { level: 3, score: 800 }, rewards: { gold: 200, diamonds: 15, xp: 400 }, isBoss: false },
  { id: 'L5_Boss', name: '深渊擂台', scene: 'arena', mode: 'fighting', description: 'Boss战：熟词僻义陷阱词，考验真实水平', difficulty: 'hard', wordBook: 'ky_dark', waves: 3, timePerWave: 60, enemyConfig: { spawnRate: 0, baseSpeed: 0, baseHp: 8, size: 65, distractors: true, bossChance: 1, speedScale: 1, hpScale: 2 }, winCondition: { type: 'boss', value: 1 }, loseCondition: { type: 'hp', value: 0 }, unlockRequirement: { level: 5, score: 1500 }, rewards: { gold: 300, diamonds: 30, xp: 600 }, isBoss: true },
  { id: 'L6_Endless', name: '无尽公路', scene: 'hybrid', mode: 'fusion', description: '终极挑战：动态难度，FPS+格斗融合，冲击更高分数', difficulty: 'extreme', wordBook: 'ky_2025', waves: 99, timePerWave: 35, enemyConfig: { spawnRate: 900, baseSpeed: 1.5, baseHp: 4, size: 40, distractors: true, bossChance: 0.2, speedScale: 1.2, hpScale: 1.5 }, winCondition: { type: 'score', value: 10000 }, loseCondition: { type: 'hp', value: 0 }, unlockRequirement: { level: 8, score: 3000 }, rewards: { gold: 500, diamonds: 50, xp: 1000 }, isBoss: false },
];