import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Check, Target, Clock, X } from 'lucide-react';
import { toast } from '../../store/toast';

interface GameWord {
  id: number;
  word: string;
  phonetic: string | null;
  definition: string;
  exampleSentence: string | null;
  partOfSpeech: string | null;
  difficulty: string;
  category: string;
}

interface Question {
  targetWord: string;
  targetDefinition: string;
  sentence: { word: string; isTarget: boolean }[];
}

const TOTAL_QUESTIONS = 10;
const TIME_PER_QUESTION = 5;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateQuestions(words: GameWord[]): Question[] {
  const questions: Question[] = [];
  const available = shuffleArray([...words]);

  for (let i = 0; i < Math.min(TOTAL_QUESTIONS, available.length); i++) {
    const target = available[i];
    const distractors = available
      .filter((w) => w.id !== target.id)
      .slice(0, 7);
    const distractorsShuffled = shuffleArray(distractors).slice(0, 6);

    const sentenceWords = [{ word: target.word, isTarget: true }];
    for (const d of distractorsShuffled) {
      sentenceWords.push({ word: d.word, isTarget: false });
    }

    const shuffled = shuffleArray(sentenceWords);

    questions.push({
      targetWord: target.word,
      targetDefinition: target.definition,
      sentence: shuffled,
    });
  }

  return questions;
}

export function SpeedHuntGame({ onScoreSubmit }: { onScoreSubmit: (score: number, gameType: string) => void }) {
  const [words, setWords] = useState<GameWord[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clickedWord, setClickedWord] = useState<{ index: number; isCorrect: boolean } | null>(null);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const questionStartTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initGame = useCallback(async () => {
    setLoading(true);
    setCurrentIndex(0);
    setScore(0);
    setCorrectCount(0);
    setTimeLeft(TIME_PER_QUESTION);
    setFinished(false);
    setClickedWord(null);
    setReactionTimes([]);
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

    try {
      const res = await fetch('/api/english-games/words-pool?category=考研英语&limit=15');
      const data = await res.json();
      const wordList: GameWord[] = data.words || [];
      setWords(wordList);
      const generated = generateQuestions(wordList);
      setQuestions(generated);
      questionStartTimeRef.current = Date.now();
      startTimer();
    } catch {
      toast.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(TIME_PER_QUESTION);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeout = () => {
    if (finished) return;
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

    feedbackTimerRef.current = setTimeout(() => {
      if (currentIndex + 1 >= questions.length) {
        endGame();
      } else {
        setCurrentIndex((prev) => prev + 1);
        setClickedWord(null);
        questionStartTimeRef.current = Date.now();
        startTimer();
      }
    }, 1200);
  };

  const endGame = useCallback(() => {
    setFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);
    onScoreSubmit(score, 'speed_hunt');
  }, [score, onScoreSubmit]);

  useEffect(() => {
    initGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [initGame]);

  useEffect(() => {
    if (finished && !loading) {
      onScoreSubmit(score, 'speed_hunt');
    }
  }, [finished, loading, score, onScoreSubmit]);

  const handleWordClick = (index: number, isTarget: boolean) => {
    if (clickedWord !== null || finished || timeLeft <= 0) return;

    const reactionTime = (Date.now() - questionStartTimeRef.current) / 1000;
    setReactionTimes((prev) => [...prev, reactionTime]);

    if (timerRef.current) clearInterval(timerRef.current);
    setClickedWord({ index, isCorrect: isTarget });

    if (isTarget) {
      setScore((prev) => prev + 20);
      setCorrectCount((prev) => prev + 1);
    }

    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      if (currentIndex + 1 >= questions.length) {
        endGame();
      } else {
        setCurrentIndex((prev) => prev + 1);
        setClickedWord(null);
        questionStartTimeRef.current = Date.now();
        startTimer();
      }
    }, 800);
  };

  const progressColor = timeLeft > 3 ? 'bg-green-500' : timeLeft > 2 ? 'bg-yellow-500' : 'bg-red-500';

  if (loading) {
    return (
      <div className='card text-center py-12'>
        <div className='animate-pulse space-y-4'>
          <div className='h-8 bg-gray-200 rounded w-48 mx-auto' />
          <div className='h-4 bg-gray-200 rounded w-64 mx-auto' />
        </div>
      </div>
    );
  }

  if (finished) {
    const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const avgReaction = reactionTimes.length > 0
      ? (reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length).toFixed(1)
      : '0';

    return (
      <div className='card text-center py-8 space-y-6'>
        <div className='text-6xl animate-bounce'>{accuracy >= 80 ? '🎯' : accuracy >= 50 ? '👀' : '📖'}</div>
        <div>
          <h2 className='text-2xl font-bold text-gray-900'>
            {accuracy >= 80 ? '神射手！' : accuracy >= 50 ? '还不错！' : '继续加油！'}
          </h2>
          <p className='text-gray-500 mt-2'>信息狩猎完成</p>
        </div>
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md mx-auto'>
          <div className='bg-primary-50 rounded-xl p-3'>
            <Trophy className='w-5 h-5 text-yellow-500 mx-auto mb-1' />
            <p className='text-xl font-bold text-primary-600'>{score}</p>
            <p className='text-xs text-gray-500'>总分</p>
          </div>
          <div className='bg-green-50 rounded-xl p-3'>
            <Check className='w-5 h-5 text-green-500 mx-auto mb-1' />
            <p className='text-xl font-bold text-green-600'>{correctCount}/{questions.length}</p>
            <p className='text-xs text-gray-500'>正确</p>
          </div>
          <div className='bg-blue-50 rounded-xl p-3'>
            <Target className='w-5 h-5 text-blue-500 mx-auto mb-1' />
            <p className='text-xl font-bold text-blue-600'>{accuracy}%</p>
            <p className='text-xs text-gray-500'>正确率</p>
          </div>
          <div className='bg-purple-50 rounded-xl p-3'>
            <Clock className='w-5 h-5 text-purple-500 mx-auto mb-1' />
            <p className='text-xl font-bold text-purple-600'>{avgReaction}s</p>
            <p className='text-xs text-gray-500'>平均反应</p>
          </div>
        </div>
        <button onClick={initGame} className='btn-primary'>
          <RotateCcw size={16} className='mr-1' />
          再来一局
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <span className='text-sm font-medium text-gray-700'>
            得分：<span className='text-primary-600 font-bold'>{score}</span>
          </span>
          <span className='text-sm text-gray-500'>
            正确：<span className='text-green-500 font-bold'>{correctCount}</span>
          </span>
        </div>
        <div className='flex items-center gap-2'>
          <Clock
            size={16}
            className={timeLeft <= 2 ? 'text-red-500' : timeLeft <= 3 ? 'text-yellow-500' : 'text-gray-400'}
          />
          <span
            className={`text-lg font-bold ${
              timeLeft <= 2 ? 'text-red-500 animate-pulse' : timeLeft <= 3 ? 'text-yellow-500' : 'text-gray-700'
            }`}
          >
            {timeLeft}s
          </span>
        </div>
      </div>

      <div className='w-full bg-gray-200 rounded-full h-2 overflow-hidden'>
        <div
          className={`h-full rounded-full transition-all duration-1000 ${progressColor}`}
          style={{ width: `${(timeLeft / TIME_PER_QUESTION) * 100}%` }}
        />
      </div>

      <div className='text-sm text-gray-400 text-center'>
        第 {currentIndex + 1} / {questions.length} 题
      </div>

      {currentQuestion && (
        <div className='card space-y-6'>
          <div className='text-center'>
            <p className='text-xs text-gray-400 mb-1'>找到以下释义对应的英文单词：</p>
            <p className='text-xl font-bold text-gray-900 bg-primary-50 rounded-xl py-3 px-4 inline-block'>
              {currentQuestion.targetDefinition}
            </p>
          </div>

          <div className='flex flex-wrap gap-2 justify-center'>
            {currentQuestion.sentence.map((item, index) => {
              let wordStyle = 'bg-white border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50';

              if (clickedWord !== null) {
                if (clickedWord.index === index && clickedWord.isCorrect) {
                  wordStyle = 'bg-green-100 border-green-400 text-green-700 scale-110';
                } else if (clickedWord.index === index && !clickedWord.isCorrect) {
                  wordStyle = 'bg-red-100 border-red-400 text-red-700';
                } else if (item.isTarget && !clickedWord.isCorrect) {
                  wordStyle = 'bg-green-50 border-green-300 text-green-600';
                }
              }

              const isShaking = clickedWord !== null && clickedWord.index === index && !clickedWord.isCorrect;

              return (
                <button
                  key={index}
                  onClick={() => handleWordClick(index, item.isTarget)}
                  disabled={clickedWord !== null}
                  className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border-2 text-sm sm:text-base font-semibold transition-all duration-300 ${wordStyle} ${
                    isShaking ? 'animate-pulse' : ''
                  } disabled:cursor-default`}
                  style={isShaking ? { animation: 'shake 0.5s ease-in-out' } : undefined}
                >
                  {item.word}
                </button>
              );
            })}
          </div>

          {clickedWord && clickedWord.isCorrect && (
            <div className='text-center text-green-600 font-medium animate-fade-in'>
              ✓ 正确！+20分
            </div>
          )}
          {clickedWord && !clickedWord.isCorrect && (
            <div className='text-center text-red-500 font-medium animate-fade-in'>
              ✗ 目标词是 <span className='font-bold text-red-600'>{currentQuestion.targetWord}</span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}