import { create } from 'zustand';
import { Question, UserAnswer } from '../types';

interface QuestionStore {
  currentQuestion: Question | null;
  questions: Question[];
  userAnswers: Map<string, UserAnswer>;
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setQuestions: (questions: Question[]) => void;
  setCurrentQuestion: (question: Question) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  submitAnswer: (questionId: string, answer: string, timeSpent: number) => void;
  clearAnswers: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useQuestionStore = create<QuestionStore>((set, get) => ({
  currentQuestion: null,
  questions: [],
  userAnswers: new Map(),
  currentIndex: 0,
  isLoading: false,
  error: null,

  setQuestions: (questions: Question[]) => {
    set({
      questions,
      currentQuestion: questions[0] ?? null,
      currentIndex: 0,
    });
  },

  setCurrentQuestion: (question: Question) => {
    const index = get().questions.findIndex(q => q.id === question.id);
    set({
      currentQuestion: question,
      currentIndex: index >= 0 ? index : get().currentIndex,
    });
  },

  nextQuestion: () => {
    const { questions, currentIndex } = get();
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      set({
        currentIndex: nextIndex,
        currentQuestion: questions[nextIndex] ?? null,
      });
    }
  },

  previousQuestion: () => {
    const { questions, currentIndex } = get();
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      set({
        currentIndex: prevIndex,
        currentQuestion: questions[prevIndex] ?? null,
      });
    }
  },

  submitAnswer: (questionId: string, answer: string, timeSpent: number) => {
    const { questions, userAnswers } = get();
    const question = questions.find(q => q.id === questionId);
    
    if (question) {
      const isCorrect = answer.trim().toLowerCase() === question.answer.trim().toLowerCase();
      const userAnswer: UserAnswer = {
        questionId,
        answer,
        isCorrect,
        timeSpent,
        answeredAt: new Date().toISOString(),
      };
      
      const newAnswers = new Map(userAnswers);
      newAnswers.set(questionId, userAnswer);
      
      set({ userAnswers: newAnswers });
    }
  },

  clearAnswers: () => {
    set({
      userAnswers: new Map(),
      currentIndex: 0,
      currentQuestion: get().questions[0] ?? null,
    });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
