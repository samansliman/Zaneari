export interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  category: string;
}

export interface Player {
  id: number;
  name: string;
  score: number;
}

export interface DetectiveStory {
  id: number;
  title: string;
  story: string;
  question: string;
  options: string[];
  correctAnswer: number;
  clues: string[];
  image: string;
  type: 'mystery' | 'horror' | 'tragedy';
}

export interface Riddle {
  id: number;
  question: string;
  answer: string;
  options: string[];
  correctAnswer: number;
}

export type GameMode = 'zanyar' | 'detective' | 'riddles' | 'spy';
