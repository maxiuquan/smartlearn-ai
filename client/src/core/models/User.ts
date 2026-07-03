export interface UserStats {
  vocabPower: number;
  readingSpeed: number;
  logicIndex: number;
  mathPower: number;
}

export interface GameSave {
  userId: string;
  timestamp: number;
  unlockedLevels: string[];
  highScores: Record<string, number>;
  lastPlayedGame: string;
}

export interface InventoryItem {
  id: string;
  type: 'card_skin' | 'tower_skin' | 'special_item';
  name: string;
  quantity: number;
}