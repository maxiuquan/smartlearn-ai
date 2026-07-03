import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Heart, Zap, Shield, Swords } from 'lucide-react';
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

interface Monster {
  id: number;
  word: string;
  definition: string;
  lane: number;
  position: number;
  eliminated: boolean;
  reachedEnd: boolean;
}

const TOTAL_WAVES = 15;
const TOTAL_LANES = 5;
const MAX_POSITION = 4;
const MAX_LIVES = 3;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function WordTowerGame({ onScoreSubmit }: { onScoreSubmit: (score: number, gameType: string) => void }) {
  const [words, setWords] = useState<GameWord[]>([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [currentMonsterId, setCurrentMonsterId] = useState<number | null>(null);
  const [options, setOptions] = useState<GameWord[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [wave, setWave] = useState(0);
  const [eliminatedCount, setEliminatedCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ correct: boolean; word: string } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const monsterIdRef = useRef(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initGame = useCallback(async () => {
    setLoading(true);
    setMonsters([]);
    setCurrentMonsterId(null);
    setOptions([]);
    setScore(0);
    setLives(MAX_LIVES);
    setWave(0);
    setEliminatedCount(0);
    setFinished(false);
    setFeedback(null);
    setIsTransitioning(false);
    monsterIdRef.current = 0;
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

    try {
      const res = await fetch('/api/english-games/words-pool?category=考研英语&limit=20');
      const data = await res.json();
      const wordList: GameWord[] = data.words || [];
      setWords(wordList);
      spawnMonster(wordList, 0);
    } catch {
      toast.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const spawnMonster = useCallback((wordList: GameWord[], waveIndex: number) => {
    if (waveIndex >= TOTAL_WAVES) return;

    const available = wordList.filter((w) => {
      return !monsters.some((m) => m.id === w.id);
    });
    const shuffled = shuffleArray(available);
    const target = shuffled[0] || wordList[waveIndex % wordList.length];

    const newMonster: Monster = {
      id: monsterIdRef.current++,
      word: target.word,
      definition: target.definition,
      lane: Math.floor(Math.random() * TOTAL_LANES),
      position: 0,
      eliminated: false,
      reachedEnd: false,
    };

    setMonsters((prev) => [...prev, newMonster]);
    setCurrentMonsterId(newMonster.id);

    const distractors = shuffled
      .filter((w) => w.id !== target.id)
      .slice(0, 3);
    const opts = shuffleArray([target, ...distractors]);
    setOptions(opts);
  }, [monsters]);

  const handleOptionClick = (word: GameWord) => {
    if (finished || isTransitioning || feedback !== null || currentMonsterId === null) return;

    const currentMonster = monsters.find((m) => m.id === currentMonsterId);
    if (!currentMonster) return;

    const isCorrect = word.word === currentMonster.word;

    if (isCorrect) {
      setScore((prev) => prev + 25);
      setEliminatedCount((prev) => prev + 1);
      setFeedback({ correct: true, word: word.word });

      setMonsters((prev) =>
        prev.map((m) =>
          m.id === currentMonsterId ? { ...m, eliminated: true } : m
        )
      );

      feedbackTimerRef.current = setTimeout(() => {
        setFeedback(null);
        setIsTransitioning(true);
        setTimeout(() => {
          setIsTransitioning(false);
          const nextWave = wave + 1;
          setWave(nextWave);
          if (nextWave >= TOTAL_WAVES) {
            setFinished(true);
          } else {
            spawnMonster(words, nextWave);
          }
        }, 500);
      }, 800);
    } else {
      const newPosition = currentMonster.position + 1;
      setFeedback({ correct: false, word: word.word });

      if (newPosition >= MAX_POSITION) {
        const newLives = lives - 1;
        setLives(newLives);
        setMonsters((prev) =>
          prev.map((m) =>
            m.id === currentMonsterId ? { ...m, reachedEnd: true, position: newPosition } : m
          )
        );

        if (newLives <= 0) {
          feedbackTimerRef.current = setTimeout(() => {
            setFeedback(null);
            setFinished(true);
          }, 800);
          return;
        }
      } else {
        setMonsters((prev) =>
          prev.map((m) =>
            m.id === currentMonsterId ? { ...m, position: newPosition } : m
          )
        );
        setScore((prev) => Math.max(0, prev - 5));
      }

      feedbackTimerRef.current = setTimeout(() => {
        setFeedback(null);
        if (newPosition >= MAX_POSITION) {
          setIsTransitioning(true);
          setTimeout(() => {
            setIsTransitioning(false);
            const nextWave = wave + 1;
            setWave(nextWave);
            if (nextWave >= TOTAL_WAVES) {
              setFinished(true);
            } else {
              spawnMonster(words, nextWave);
            }
          }, 500);
        }
      }, 800);
    }
  };

  useEffect(() => {
    initGame();
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [initGame]);

  useEffect(() => {
    if (finished && !loading) {
      onScoreSubmit(score, 'word_tower');
    }
  }, [finished, loading, score, onScoreSubmit]);

  const currentMonster = monsters.find((m) => m.id === currentMonsterId);

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
    return (
      <div className='card text-center py-8 space-y-6'>
        <div className='text-6xl animate-bounce'>{lives > 0 ? '🏆' : '💀'}</div>
        <div>
          <h2 className='text-2xl font-bold text-gray-900'>
            {lives > 0 ? '防线守住了！' : '防线失守！'}
          </h2>
          <p className='text-gray-500 mt-2'>
            {lives > 0
              ? `成功抵御了 ${wave} 波攻击！`
              : `在第 ${wave + 1} 波攻击中失败`}
          </p>
        </div>
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md mx-auto'>
          <div className='bg-primary-50 rounded-xl p-3'>
            <Trophy className='w-5 h-5 text-yellow-500 mx-auto mb-1' />
            <p className='text-xl font-bold text-primary-600'>{score}</p>
            <p className='text-xs text-gray-500'>总分</p>
          </div>
          <div className='bg-green-50 rounded-xl p-3'>
            <Swords className='w-5 h-5 text-green-500 mx-auto mb-1' />
            <p className='text-xl font-bold text-green-600'>{eliminatedCount}</p>
            <p className='text-xs text-gray-500'>消灭怪物</p>
          </div>
          <div className='bg-red-50 rounded-xl p-3'>
            <Heart className='w-5 h-5 text-red-500 mx-auto mb-1' />
            <p className='text-xl font-bold text-red-600'>{lives}</p>
            <p className='text-xs text-gray-500'>剩余生命</p>
          </div>
          <div className='bg-blue-50 rounded-xl p-3'>
            <Zap className='w-5 h-5 text-blue-500 mx-auto mb-1' />
            <p className='text-xl font-bold text-blue-600'>{wave}/{TOTAL_WAVES}</p>
            <p className='text-xs text-gray-500'>波次</p>
          </div>
        </div>
        <button onClick={initGame} className='btn-primary'>
          <RotateCcw size={16} className='mr-1' />
          再来一局
        </button>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between flex-wrap gap-2'>
        <div className='flex items-center gap-4'>
          <span className='text-sm font-medium text-gray-700'>
            得分：<span className='text-primary-600 font-bold'>{score}</span>
          </span>
          <span className='text-sm text-gray-500'>
            波次：<span className='text-blue-500 font-bold'>{wave + 1}/{TOTAL_WAVES}</span>
          </span>
          <span className='text-sm text-gray-500'>
            消灭：<span className='text-green-500 font-bold'>{eliminatedCount}</span>
          </span>
        </div>
        <div className='flex items-center gap-1'>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <Heart
              key={i}
              size={18}
              className={i < lives ? 'text-red-500 fill-red-500' : 'text-gray-300'}
            />
          ))}
        </div>
      </div>

      <div className='w-full bg-gray-200 rounded-full h-1.5 overflow-hidden'>
        <div
          className='h-full rounded-full bg-primary-500 transition-all duration-500'
          style={{ width: `${((wave + 1) / TOTAL_WAVES) * 100}%` }}
        />
      </div>

      <div className='card space-y-3 p-4 sm:p-6'>
        {[0, 1, 2, 3, 4].map((lane) => {
          const laneMonsters = monsters.filter((m) => m.lane === lane && !m.eliminated && !m.reachedEnd);
          const activeMonster = laneMonsters.length > 0 ? laneMonsters[0] : null;

          return (
            <div key={lane} className='relative flex items-center gap-1 sm:gap-2'>
              <div className='w-10 sm:w-14 flex-shrink-0'>
                <div className='flex flex-col items-center'>
                  <span className='text-xs text-gray-400'>路径{lane + 1}</span>
                  <div className='flex gap-0.5 mt-0.5'>
                    {[0, 1, 2].map((pos) => {
                      const isBreached = activeMonster && activeMonster.position > pos;
                      return (
                        <Shield
                          key={pos}
                          size={12}
                          className={isBreached ? 'text-gray-300' : 'text-blue-400'}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className='flex-1 relative h-12 sm:h-14 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden'>
                <div className='absolute right-2 top-1/2 -translate-y-1/2 text-xl sm:text-2xl'>
                  🏰
                </div>

                {activeMonster && (
                  <div
                    className='absolute top-1/2 -translate-y-1/2 transition-all duration-500 ease-linear'
                    style={{
                      left: `${(activeMonster.position / (MAX_POSITION - 1)) * 70}%`,
                    }}
                  >
                    <div
                      className={`flex items-center gap-1 bg-white border-2 rounded-lg px-2 py-1 shadow-sm ${
                        currentMonsterId === activeMonster.id
                          ? 'border-red-400 animate-pulse'
                          : 'border-gray-200'
                      }`}
                    >
                      <span className='text-lg sm:text-xl'>👾</span>
                      <span className='text-xs sm:text-sm font-medium text-gray-700 truncate max-w-[80px] sm:max-w-[120px]'>
                        {activeMonster.definition}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {currentMonster && (
        <div className='card p-4 sm:p-6 space-y-4'>
          <div className='text-center'>
            <p className='text-sm text-gray-500 mb-1'>选择正确的中文释义对应的英文单词：</p>
            <p className='text-lg font-bold text-red-600 bg-red-50 rounded-xl py-2 px-4 inline-block'>
              {currentMonster.definition}
            </p>
          </div>

          <div className='grid grid-cols-2 gap-2 sm:gap-3'>
            {options.map((opt, index) => {
              let btnStyle = 'bg-white border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50';

              if (feedback) {
                if (opt.word === currentMonster.word) {
                  btnStyle = 'bg-green-100 border-green-400 text-green-700';
                } else if (feedback.word === opt.word && !feedback.correct) {
                  btnStyle = 'bg-red-100 border-red-400 text-red-700';
                } else {
                  btnStyle = 'bg-gray-50 border-gray-200 text-gray-400';
                }
              }

              return (
                <button
                  key={index}
                  onClick={() => handleOptionClick(opt)}
                  disabled={feedback !== null || isTransitioning}
                  className={`p-3 sm:p-4 rounded-xl border-2 text-sm sm:text-base font-semibold transition-all duration-200 ${btnStyle} disabled:cursor-default active:scale-[0.97]`}
                >
                  <div className='truncate'>{opt.word}</div>
                  {opt.partOfSpeech && (
                    <div className='text-[10px] text-gray-400 mt-0.5'>{opt.partOfSpeech}</div>
                  )}
                </button>
              );
            })}
          </div>

          {feedback && feedback.correct && (
            <div className='text-center text-green-600 font-medium animate-fade-in'>
              ✓ 正确！消灭了怪物！+25分
            </div>
          )}
          {feedback && !feedback.correct && (
            <div className='text-center text-red-500 font-medium animate-fade-in'>
              ✗ 错误！正确答案是 <span className='font-bold'>{currentMonster.word}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}