export interface Word {
  id: number;
  text: string;
  phonetic: string;
  definition: string;
  meanings: Meaning[];
  examples: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  category: string;
  root?: string;
  prefix?: string;
  suffix?: string;
}

export interface Meaning {
  partOfSpeech: string;
  definition: string;
  type: 'common' | 'academic';
}

export interface RootInfo {
  name: string;
  meaning: string;
  type: 'prefix' | 'root' | 'suffix';
  examples: string[];
}