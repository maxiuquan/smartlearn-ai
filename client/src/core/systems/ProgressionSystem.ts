export interface ProgressionState {
  level: number;
  exp: number;
  vocabPower: number;
  readingSpeed: number;
  logicIndex: number;
  mathPower: number;
  streakDays: number;
  totalGamesPlayed: number;
}

type StatCategory = 'vocab' | 'reading' | 'logic' | 'math';

const STORAGE_KEY = 'lexiverse_progression';

const DEFAULT_STATE: ProgressionState = {
  level: 1,
  exp: 0,
  vocabPower: 100,
  readingSpeed: 100,
  logicIndex: 100,
  mathPower: 100,
  streakDays: 0,
  totalGamesPlayed: 0,
};

const EXP_PER_LEVEL = 250;
const POWER_GAIN_FACTOR = 0.4;

const GAME_CATEGORY_MAP: Record<string, StatCategory> = {
  wordTower: 'vocab',
  lexiconDefense: 'vocab',
  infoHunt: 'reading',
  speedHunt: 'reading',
  entropyMerge: 'logic',
  entropySurvival: 'logic',
  rootRoguelike: 'vocab',
  comprehensive: 'math',
};

export class ProgressionSystem {
  private state: ProgressionState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): ProgressionState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ProgressionState;
        return {
          level: parsed.level ?? DEFAULT_STATE.level,
          exp: parsed.exp ?? DEFAULT_STATE.exp,
          vocabPower: parsed.vocabPower ?? DEFAULT_STATE.vocabPower,
          readingSpeed: parsed.readingSpeed ?? DEFAULT_STATE.readingSpeed,
          logicIndex: parsed.logicIndex ?? DEFAULT_STATE.logicIndex,
          mathPower: parsed.mathPower ?? DEFAULT_STATE.mathPower,
          streakDays: parsed.streakDays ?? DEFAULT_STATE.streakDays,
          totalGamesPlayed:
            parsed.totalGamesPlayed ?? DEFAULT_STATE.totalGamesPlayed,
        };
      }
    } catch {
      // 数据损坏时使用默认值
    }
    return { ...DEFAULT_STATE };
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // 存储空间不足时静默失败
    }
  }

  getState(): ProgressionState {
    return { ...this.state };
  }

  addExp(amount: number, category: StatCategory): void {
    this.state.exp += amount;
    this.state.totalGamesPlayed++;

    const powerGain = Math.round(amount * POWER_GAIN_FACTOR);
    switch (category) {
      case 'vocab':
        this.state.vocabPower += powerGain;
        break;
      case 'reading':
        this.state.readingSpeed += powerGain;
        break;
      case 'logic':
        this.state.logicIndex += powerGain;
        break;
      case 'math':
        this.state.mathPower += powerGain;
        break;
    }

    const newLevel = 1 + Math.floor(this.state.exp / EXP_PER_LEVEL);
    if (newLevel > this.state.level) {
      this.state.level = newLevel;
    }

    this.saveState();
  }

  getLevel(): number {
    return this.state.level;
  }

  getLevelProgress(): number {
    const expAtCurrentLevel = (this.state.level - 1) * EXP_PER_LEVEL;
    const expInCurrentLevel = this.state.exp - expAtCurrentLevel;
    const progress = (expInCurrentLevel / EXP_PER_LEVEL) * 100;
    return Math.min(Math.round(progress * 10) / 10, 100);
  }

  getPowerForGame(gameType: string): number {
    const category = GAME_CATEGORY_MAP[gameType];
    if (!category) {
      return this.state.vocabPower;
    }
    switch (category) {
      case 'vocab':
        return this.state.vocabPower;
      case 'reading':
        return this.state.readingSpeed;
      case 'logic':
        return this.state.logicIndex;
      case 'math':
        return this.state.mathPower;
    }
  }

  calculateGameReward(
    gameType: string,
    score: number,
    accuracy: number,
  ): { exp: number; powerGain: number } {
    const category = GAME_CATEGORY_MAP[gameType] ?? 'vocab';
    const accuracyMultiplier = accuracy / 100;
    const difficultyMultiplier = this.getLevel() * 0.1 + 1;
    const scoreFactor = Math.log2(Math.max(score, 1)) * 5;

    const baseExp = Math.round(
      scoreFactor * accuracyMultiplier * difficultyMultiplier,
    );
    const exp = Math.max(baseExp, 5);
    const powerGain = Math.round(exp * POWER_GAIN_FACTOR);

    return { exp, powerGain };
  }
}