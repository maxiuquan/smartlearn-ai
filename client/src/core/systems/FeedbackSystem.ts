export type PraiseLevel = 'good' | 'great' | 'excellent' | 'legendary';

export type FeedbackType =
  | 'correct'
  | 'wrong'
  | 'combo'
  | 'levelUp'
  | 'achievement'
  | 'gameOver';

const PRAISE_WORDS: Record<PraiseLevel, string[]> = {
  good: ['不错!', '好!', '对!', '正确!', 'nice!'],
  great: ['厉害!', '漂亮!', '稳!', '快!', 'perfect!'],
  excellent: ['太强了!', '完美!', '犀利!', '精准!', 'amazing!'],
  legendary: ['神操作!', '无敌!', '传奇!', '天才!', 'legendary!'],
};

const COMBO_MILESTONES: { threshold: number; level: PraiseLevel; prefix: string }[] = [
  { threshold: 3, level: 'good', prefix: '连对' },
  { threshold: 5, level: 'great', prefix: '连击' },
  { threshold: 10, level: 'excellent', prefix: '超级连击' },
  { threshold: 20, level: 'legendary', prefix: '终极连击' },
];

export class FeedbackSystem {
  private comboCount = 0;
  private totalActions = 0;
  private correctActions = 0;

  getRandomPraise(level: PraiseLevel): string {
    const words = PRAISE_WORDS[level];
    const index = Math.floor(Math.random() * words.length);
    return words[index];
  }

  getComboPraise(combo: number): string {
    let bestMilestone = COMBO_MILESTONES[0];
    for (const milestone of COMBO_MILESTONES) {
      if (combo >= milestone.threshold) {
        bestMilestone = milestone;
      }
    }
    const praise = this.getRandomPraise(bestMilestone.level);
    if (combo >= 3) {
      return `${bestMilestone.prefix} x${combo}! ${praise}`;
    }
    return praise;
  }

  recordAction(correct: boolean): {
    combo: number;
    praise: string;
    level: PraiseLevel;
  } {
    this.totalActions++;

    if (correct) {
      this.correctActions++;
      this.comboCount++;

      let level: PraiseLevel = 'good';
      if (this.comboCount >= 20) {
        level = 'legendary';
      } else if (this.comboCount >= 10) {
        level = 'excellent';
      } else if (this.comboCount >= 5) {
        level = 'great';
      }

      const praise = this.getComboPraise(this.comboCount);

      return {
        combo: this.comboCount,
        praise,
        level,
      };
    } else {
      this.comboCount = 0;
      return {
        combo: 0,
        praise: '再试一次!',
        level: 'good',
      };
    }
  }

  getAccuracy(): number {
    if (this.totalActions === 0) {
      return 0;
    }
    return Math.round((this.correctActions / this.totalActions) * 100);
  }

  getStats(): { combo: number; total: number; accuracy: number } {
    return {
      combo: this.comboCount,
      total: this.totalActions,
      accuracy: this.getAccuracy(),
    };
  }

  reset(): void {
    this.comboCount = 0;
    this.totalActions = 0;
    this.correctActions = 0;
  }
}