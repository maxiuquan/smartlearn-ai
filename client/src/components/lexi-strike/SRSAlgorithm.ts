export interface SRSWord {
  wordId: number;
  level: number;
  nextReview: number;
  interval: number;
  easeFactor: number;
  correctCount: number;
  wrongCount: number;
  lastSeen: number;
}

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120, 240];

export class SRSAlgorithm {
  private words: Map<number, SRSWord> = new Map();

  loadFromStorage(): void {
    try {
      const data = localStorage.getItem('lexi_strike_srs');
      if (data) {
        const parsed = JSON.parse(data);
        for (const item of parsed) {
          this.words.set(item.wordId, item);
        }
      }
    } catch { /* ignore */ }
  }

  saveToStorage(): void {
    try {
      localStorage.setItem('lexi_strike_srs', JSON.stringify([...this.words.values()]));
    } catch { /* ignore */ }
  }

  getWord(wordId: number): SRSWord {
    if (!this.words.has(wordId)) {
      this.words.set(wordId, {
        wordId,
        level: 0,
        nextReview: 0,
        interval: INTERVALS[0],
        easeFactor: DEFAULT_EASE,
        correctCount: 0,
        wrongCount: 0,
        lastSeen: 0,
      });
    }
    return this.words.get(wordId)!;
  }

  recordAnswer(wordId: number, correct: boolean): void {
    const word = this.getWord(wordId);
    word.lastSeen = Date.now();

    if (correct) {
      word.correctCount++;
      word.level = Math.min(word.level + 1, INTERVALS.length - 1);
      word.interval = INTERVALS[word.level];
      word.easeFactor = Math.max(MIN_EASE, word.easeFactor + 0.1);
    } else {
      word.wrongCount++;
      word.level = Math.max(0, word.level - 1);
      word.interval = INTERVALS[word.level];
      word.easeFactor = Math.max(MIN_EASE, word.easeFactor - 0.2);
    }

    word.nextReview = Date.now() + word.interval * 60 * 1000;
    this.saveToStorage();
  }

  getDueWords(): number[] {
    const now = Date.now();
    return [...this.words.values()]
      .filter(w => w.nextReview <= now)
      .sort((a, b) => a.nextReview - b.nextReview)
      .map(w => w.wordId);
  }

  getNewWords(wordIds: number[], count: number): number[] {
    const unseen = wordIds.filter(id => !this.words.has(id));
    return unseen.slice(0, count);
  }

  getNextWords(wordIds: number[], count: number): number[] {
    const due = this.getDueWords().filter(id => wordIds.includes(id));
    if (due.length >= count) return due.slice(0, count);

    const remaining = wordIds.filter(id => !due.includes(id));
    const newWords = this.getNewWords(remaining, count - due.length);
    return [...due, ...newWords];
  }

  getStats(): { mastered: number; learning: number; new: number } {
    let mastered = 0;
    let learning = 0;
    for (const w of this.words.values()) {
      if (w.level >= 4) mastered++;
      else if (w.level > 0) learning++;
    }
    return { mastered, learning, new: this.words.size - mastered - learning };
  }
}