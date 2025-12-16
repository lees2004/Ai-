
export type Language = 'en' | 'zh' | 'ja';

export enum GameState {
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export interface Choice {
  id: string;
  text: string;
}

export interface StoryTurn {
  narrative: string;
  visualDescription: string;
  choices: Choice[];
  hpChange?: number; // Optional simplified mechanic
}

export interface HistoryItem {
  role: 'user' | 'model';
  text: string;
}

export interface GameContext {
  theme: string;
  characterName: string;
  hp: number;
  language: Language;
}
