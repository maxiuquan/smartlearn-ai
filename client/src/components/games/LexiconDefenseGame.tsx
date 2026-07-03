import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Heart, Shield, Zap } from 'lucide-react';
import { FeedbackSystem } from '../../core/systems/FeedbackSystem';
import type { Word } from '../../core/models/Vocabulary';

interface Monster {
  id: number;
  wordId: number;
  definition: string;
  hp: number;
  maxHp: number;
  x: number;
  speed: number;
  isBoss: boolean;
  alive: boolean;
  reachedEnd: boolean;
}

interface FlyingScore {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface Turret {
  id: number;
  word: string;
  col: number;
  firing: boolean;
}

const TOTAL_WAVES = 15;
const TOTAL_LIVES = 3;
const BASE_SPEED = 0.12;
const MONSTER_HP = 3;
const BOSS_HP = 5;
const PATH_START = 2;
const PATH_END = 88;
const TURRET_SLOTS = 4;
const TURRET_RANGE = 35;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function LexiconDefenseGame({ onScoreSubmit }: { onScoreSubmit: (score: number, gameType: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<Word[]>([]);
  const [monster, setMonster] = useState<Monster | null>(null);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(0);
  const [lives, setLives] = useState(TOTAL_LIVES);
  const [killedCount, setKilledCount] = useState(0);
  const [options, setOptions] = useState<Word[]>([]);
  const [correctWord, setCorrectWord] = useState<Word | null>(null);
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [shakeOption, setShakeOption] = useState<number | null>(null);
  const [beamActive, setBeamActive] = useState(false);
  const [monsterHit, setMonsterHit] = useState(false);
  const [monsterDead, setMonsterDead] = useState(false);
  const [defenseFlash, setDefenseFlash] = useState(false);
  const [flyingScores, setFlyingScores] = useState<FlyingScore[]>([]);
  const [praiseText, setPraiseText] = useState<{ id: number; text: string } | null>(null);
  const [turrets, setTurrets] = useState<Turret[]>([]);
  const [turretFiring, setTurretFiring] = useState<number | null>(null);

  const gameLoopRef = useRef<number | null>(null);
  const popupIdRef = useRef(0);
  const praiseIdRef = useRef(0);
  const pathRef = useRef<HTMLDivElement>(null);
  const feedback = useRef(new FeedbackSystem());

  const initGame = useCallback(async () => {
    setLoading(true);
    setMonster(null);
    setScore(0);
    setWave(0);
    setLives(TOTAL_LIVES);
    setKilledCount(0);
    setOptions([]);
    setCorrectWord(null);
    setFinished(false);
    setWon(false);
    setShakeOption(null);
    setBeamActive(false);
    setMonsterHit(false);
    setMonsterDead(false);
    setDefenseFlash(false);
    setFlyingScores([]);
    setPraiseText(null);
    setTurrets([]);
    setTurretFiring(null);

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    feedback.current.reset();

    try {
      const res = await fetch('/api/english-games/words-pool?category=考研英语&limit=30');
      const data = await res.json();
      const wordList: Word[] = (data.words || []).map((w: Record<string, unknown>) => ({
        id: w.id as number,
        text: (w.word || w.text) as string,
        phonetic: (w.phonetic || '') as string,
        definition: (w.definition || '') as string,
        meanings: (w.meanings || []) as { partOfSpeech: string; definition: string; type: string }[],
        examples: (w.exampleSentence ? [w.exampleSentence as string] : []) as string[],
        difficulty: (w.difficulty || 3) as 1 | 2 | 3 | 4 | 5,
        category: (w.category || '') as string,
      }));
      setWords(wordList);
      setLoading(false);
      startWave(0, wordList);
    } catch {
      setLoading(false);
    }
  }, []);

  const startWave = useCallback((waveNum: number, wordList: Word[]) => {
    if (waveNum >= TOTAL_WAVES) {
      setWon(true);
      setFinished(true);
      onScoreSubmit(score + lives * 50, 'lexicon_defense');
      return;
    }

    const isBoss = (waveNum + 1) % 5 === 0;
    const pool = wordList.length >= 4 ? wordList : wordList;
    const shuffled = shuffleArray(pool);
    const correct = shuffled[0];
    const distractors = shuffled.slice(1, 4);

    const speed = BASE_SPEED * (1 + waveNum * 0.04) * (isBoss ? 0.7 : 1);
    const maxHp = isBoss ? BOSS_HP : MONSTER_HP;

    const newMonster: Monster = {
      id: Date.now(),
      wordId: correct.id,
      definition: correct.meanings && correct.meanings.length > 0
        ? correct.meanings[0].definition
        : correct.definition,
      hp: maxHp,
      maxHp,
      x: PATH_START,
      speed,
      isBoss,
      alive: true,
      reachedEnd: false,
    };

    setMonster(newMonster);
    setOptions(shuffleArray([correct, ...distractors]));
    setCorrectWord(correct);
    setWave(waveNum + 1);
    setBeamActive(false);
    setMonsterHit(false);
    setMonsterDead(false);
  }, [score, lives, onScoreSubmit]);

  useEffect(() => {
    initGame();
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [initGame]);

  useEffect(() => {
    if (loading || finished || !monster || !monster.alive || monsterDead) return;

    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 16;
      lastTime = time;

      setMonster((prev) => {
        if (!prev || !prev.alive || prev.reachedEnd) return prev;
        const newX = prev.x + prev.speed * dt;
        if (newX >= PATH_END) {
          if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
          setTimeout(() => handleMonsterReachedEnd(), 0);
          return { ...prev, x: PATH_END, reachedEnd: true, alive: false };
        }
        return { ...prev, x: newX };
      });

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [loading, finished, monster?.id, monster?.alive, monsterDead]);

  const handleMonsterReachedEnd = () => {
    setDefenseFlash(true);
    setTimeout(() => setDefenseFlash(false), 500);

    setLives((prev) => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        setTimeout(() => {
          setFinished(true);
          onScoreSubmit(score, 'lexicon_defense');
        }, 600);
      } else {
        setTimeout(() => {
          nextWave();
        }, 800);
      }
      return newLives;
    });
  };

  const handleOptionClick = (word: Word) => {
    if (finished || !correctWord || !monster || !monster.alive || monsterDead || beamActive) return;

    if (word.id === correctWord.id) {
      const result = feedback.current.recordAction(true);

      setBeamActive(true);
      setPraiseText({ id: praiseIdRef.current++, text: result.praise });
      setTimeout(() => setPraiseText(null), 1000);

      const newTurret: Turret = {
        id: Date.now(),
        word: word.text,
        col: Math.floor(Math.random() * TURRET_SLOTS),
        firing: true,
      };
      setTurrets((prev) => [...prev, newTurret]);
      setTurretFiring(newTurret.id);
      setTimeout(() => setTurretFiring(null), 500);

      setTimeout(() => {
        setBeamActive(false);
        setMonsterHit(true);
        setTimeout(() => setMonsterHit(false), 300);

        setMonster((prev) => {
          if (!prev) return prev;
          const newHp = prev.hp - 1;
          if (newHp <= 0) {
            setMonsterDead(true);
            setKilledCount((k) => k + 1);
            const bonus = prev.isBoss ? 20 : 10;
            setScore((s) => s + bonus);

            const pathEl = pathRef.current;
            if (pathEl) {
              const rect = pathEl.getBoundingClientRect();
              const mx = rect.left + (prev.x / 100) * rect.width;
              const my = rect.top + rect.height / 2;
              spawnScore(mx, my - 40, `+${bonus}`, '#00FF9C');
            }

            setTimeout(() => {
              setMonsterDead(false);
              setTurrets([]);
              nextWave();
            }, 1000);

            return { ...prev, hp: 0, alive: false };
          }
          return { ...prev, hp: newHp };
        });

        setShakeOption(null);
      }, 300);
    } else {
      feedback.current.recordAction(false);
      const idx = options.findIndex((o) => o.id === word.id);
      setShakeOption(idx);
      setTimeout(() => setShakeOption(null), 500);
    }
  };

  const nextWave = () => {
    if (wave >= TOTAL_WAVES) {
      setWon(true);
      setFinished(true);
      onScoreSubmit(score, 'lexicon_defense');
      return;
    }
    startWave(wave, words);
  };

  const spawnScore = (x: number, y: number, text: string, color: string) => {
    const id = popupIdRef.current++;
    setFlyingScores((prev) => [...prev, { id, x, y, text, color }]);
    setTimeout(() => {
      setFlyingScores((prev) => prev.filter((s) => s.id !== id));
    }, 1200);
  };

  const getRating = (): { grade: string; color: string } => {
    if (won && lives === TOTAL_LIVES) return { grade: 'S', color: '#FFD700' };
    if (won) return { grade: 'A', color: '#00FF9C' };
    if (wave >= 10) return { grade: 'B', color: '#54A0FF' };
    return { grade: 'C', color: '#6C757D' };
  };

  if (loading) {
    return (
      <div className='bg-[#0D0F14] text-center py-16 rounded-2xl border border-gray-800'>
        <div className='animate-pulse space-y-4'>
          <div className='h-8 bg-gray-700 rounded w-48 mx-auto' />
          <div className='h-4 bg-gray-700 rounded w-64 mx-auto' />
        </div>
      </div>
    );
  }

  if (finished) {
    const rating = getRating();
    const ratingEmoji = rating.grade === 'S' ? '👑' : rating.grade === 'A' ? '🏆' : lives > 0 ? '💪' : '💀';
    const title = won ? '防线坚守成功!' : lives <= 0 ? '防线被突破!' : '游戏结束!';
    const subtitle = won ? '你成功消灭了所有怪兽!' : `在第 ${wave} 波被击败`;

    return (
      <div className='bg-[#0D0F14] rounded-2xl border border-gray-800 p-6 space-y-6 text-center'>
        <div className='text-6xl'>{ratingEmoji}</div>
        <div>
          <div className='text-5xl font-bold mb-2' style={{ color: rating.color }}>{rating.grade}</div>
          <h2 className='text-2xl font-bold text-gray-200'>{title}</h2>
          <p className='text-gray-500 mt-2'>{subtitle}</p>
        </div>
        <div className='grid grid-cols-4 gap-3 max-w-md mx-auto'>
          <div className='bg-gray-800/50 rounded-xl p-3 border border-gray-700'>
            <Trophy className='w-5 h-5 mx-auto mb-1' style={{ color: '#FFD700' }} />
            <p className='text-xl font-bold text-[#00FF9C]'>{score}</p>
            <p className='text-xs text-gray-500'>总分</p>
          </div>
          <div className='bg-gray-800/50 rounded-xl p-3 border border-gray-700'>
            <Shield className='w-5 h-5 mx-auto mb-1' style={{ color: '#FF4757' }} />
            <p className='text-xl font-bold text-[#FF4757]'>{killedCount}</p>
            <p className='text-xs text-gray-500'>消灭</p>
          </div>
          <div className='bg-gray-800/50 rounded-xl p-3 border border-gray-700'>
            <Heart className='w-5 h-5 mx-auto mb-1' style={{ color: '#FF4757' }} />
            <p className='text-xl font-bold text-[#FF4757]'>{lives}</p>
            <p className='text-xs text-gray-500'>剩余生命</p>
          </div>
          <div className='bg-gray-800/50 rounded-xl p-3 border border-gray-700'>
            <Zap className='w-5 h-5 mx-auto mb-1' style={{ color: '#00FF9C' }} />
            <p className='text-xl font-bold text-[#00FF9C]'>{wave}/{TOTAL_WAVES}</p>
            <p className='text-xs text-gray-500'>波次</p>
          </div>
        </div>
        <button
          onClick={initGame}
          className='w-full py-3 bg-[#00FF9C]/20 hover:bg-[#00FF9C]/30 text-[#00FF9C] border border-[#00FF9C]/50 font-medium rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2'
        >
          <RotateCcw size={16} />
          再来一局
        </button>
      </div>
    );
  }

  const monsterX = monster ? monster.x : PATH_START;
  const hpPercent = monster ? (monster.hp / monster.maxHp) * 100 : 100;

  return (
    <div className='bg-[#0D0F14] rounded-2xl border border-gray-800 p-4 space-y-4 relative'>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        @keyframes beamFire {
          0% { opacity: 0; transform: scaleX(0); }
          30% { opacity: 1; transform: scaleX(1); }
          100% { opacity: 0; transform: scaleX(1); }
        }
        @keyframes flashRed {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(255, 71, 87, 0.3); }
        }
        @keyframes circuitPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes monsterHit {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(3); }
        }
        @keyframes monsterExplode {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes scoreFloat {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-60px) scale(1.5); }
        }
        @keyframes praisePop {
          0% { transform: scale(0.3); opacity: 0; }
          40% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0; }
        }
        @keyframes turretPulse {
          0%, 100% { box-shadow: 0 0 5px rgba(0,255,156,0.5); }
          50% { box-shadow: 0 0 15px rgba(0,255,156,0.8), 0 0 30px rgba(0,255,156,0.3); }
        }
      `}</style>

      {praiseText && (
        <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50'>
          <span
            className='text-3xl font-black text-[#FFD93D] drop-shadow-lg'
            style={{ animation: 'praisePop 1s ease-out forwards' }}
          >
            {praiseText.text}
          </span>
        </div>
      )}

      <div className='flex items-center justify-between flex-wrap gap-3 px-2 py-2 rounded-xl' style={{ background: '#1A1D24' }}>
        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-1.5'>
            <Zap size={16} style={{ color: '#00FF9C' }} />
            <span className='text-sm font-semibold text-gray-200'>
              <span style={{ color: '#00FF9C' }}>{wave}</span>
              <span style={{ color: '#6C757D' }}>/{TOTAL_WAVES}</span>
            </span>
          </div>
          <div className='flex items-center gap-1.5'>
            <Trophy size={16} style={{ color: '#FFD700' }} />
            <span className='text-sm font-bold text-[#00FF9C]'>{score}</span>
          </div>
          <div className='flex items-center gap-1.5'>
            <Shield size={16} style={{ color: '#FF4757' }} />
            <span className='text-sm font-bold text-[#FF4757]'>{killedCount}</span>
          </div>
        </div>
        <div className='flex items-center gap-1'>
          {Array.from({ length: TOTAL_LIVES }, (_, i) => (
            <Heart
              key={i}
              size={18}
              style={{ color: i < lives ? '#FF4757' : '#2A2D35', fill: i < lives ? '#FF4757' : 'none' }}
            />
          ))}
        </div>
      </div>

      <div
        ref={pathRef}
        className='relative rounded-xl overflow-hidden select-none'
        style={{
          background: '#0D0F14',
          border: '1px solid #1A1D24',
          height: '140px',
          backgroundImage: `
            linear-gradient(rgba(0,255,156,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,156,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
          animation: defenseFlash ? 'flashRed 0.5s ease-in-out' : undefined,
        }}
      >
        <div
          className='absolute inset-0 pointer-events-none'
          style={{
            backgroundImage: `repeating-linear-gradient(
              90deg, transparent, transparent 30px, rgba(0,255,156,0.03) 30px, rgba(0,255,156,0.03) 31px
            )`,
            borderRadius: '8px',
            animation: 'circuitPulse 2s ease-in-out infinite',
          }}
        />

        {turrets.map((turret) => (
          <div
            key={turret.id}
            className='absolute'
            style={{
              left: '85%',
              top: `${15 + turret.col * 25}%`,
              transform: 'translateY(-50%)',
              zIndex: 5,
              animation: turretFiring === turret.id ? 'turretPulse 0.5s ease-in-out' : 'none',
            }}
          >
            <div className='text-xs px-2 py-0.5 rounded bg-[#1A1D24] border border-[#00FF9C]/40 text-[#00FF9C] whitespace-nowrap'>
              🔫 {turret.word}
            </div>
          </div>
        ))}

        {beamActive && monster && (
          <div
            className='absolute top-1/2 pointer-events-none'
            style={{
              left: `${monsterX}%`,
              height: '3px',
              background: '#00FF9C',
              boxShadow: '0 0 8px #00FF9C, 0 0 16px #00FF9C',
              transform: 'translateY(-50%)',
              width: `${85 - monsterX}%`,
              zIndex: 5,
              transformOrigin: 'left center',
              animation: 'beamFire 0.3s ease-out forwards',
            }}
          />
        )}

        {monster && monster.alive && !monsterDead && (
          <div
            className='absolute top-1/2 flex flex-col items-center'
            style={{
              left: `${monsterX}%`,
              transform: 'translateY(-50%) translateX(-50%)',
              transition: 'left 0.05s linear',
              zIndex: 10,
            }}
          >
            <span
              className='text-xs px-2 py-0.5 rounded whitespace-nowrap mb-1.5'
              style={{
                background: '#1A1D24',
                color: '#E0E0E0',
                border: '1px solid #2A2D34',
                maxWidth: '140px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {monster.definition}
            </span>
            <div className='w-14 h-1.5 rounded-full overflow-hidden mb-1.5' style={{ background: '#2A2D34' }}>
              <div
                className='h-full rounded-full transition-all duration-300'
                style={{
                  width: `${hpPercent}%`,
                  background: hpPercent > 50 ? '#00FF9C' : hpPercent > 25 ? '#FFD700' : '#FF4757',
                }}
              />
            </div>
            <span className={`text-2xl ${monsterHit ? 'animate-monster-hit' : ''}`}>
              {monster.isBoss ? '👾' : '👻'}
            </span>
            {monster.isBoss && (
              <span className='text-xs font-bold mt-0.5 text-[#FF4757]'>BOSS</span>
            )}
          </div>
        )}

        {monsterDead && monster && (
          <div
            className='absolute top-1/2 flex flex-col items-center'
            style={{
              left: `${monster.x}%`,
              transform: 'translateY(-50%) translateX(-50%)',
              zIndex: 10,
              animation: 'monsterExplode 0.5s ease-out forwards',
            }}
          >
            <span className='text-3xl'>💥</span>
            <span className='text-xs font-bold mt-1 text-[#FF4757]'>消灭!</span>
          </div>
        )}

        <div
          className='absolute top-1/2 flex items-center gap-1'
          style={{ right: '12px', transform: 'translateY(-50%)', zIndex: 3 }}
        >
          <span className='text-3xl'>🏰</span>
        </div>
      </div>

      {correctWord && (
        <div className='text-center'>
          <span className='text-sm text-gray-500'>
            释义:<span className='font-semibold text-[#00FF9C] ml-1'>{correctWord.meanings && correctWord.meanings.length > 0 ? correctWord.meanings[0].definition : correctWord.definition}</span>
            <span className='ml-2 text-xs text-gray-600'>选择正确单词建造炮塔</span>
          </span>
        </div>
      )}

      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        {options.map((word, idx) => {
          const isShaking = shakeOption === idx;
          return (
            <button
              key={word.id}
              onClick={() => handleOptionClick(word)}
              disabled={!!beamActive || !!monsterDead || finished}
              className={`p-4 rounded-xl text-center font-bold transition-all text-lg border-2 ${
                isShaking ? 'animate-shake' : ''
              }`}
              style={{
                background: isShaking ? 'rgba(255,71,87,0.1)' : '#1A1D24',
                borderColor: isShaking ? '#FF4757' : '#2A2D34',
                color: isShaking ? '#FF4757' : '#E0E0E0',
                cursor: beamActive || monsterDead || finished ? 'not-allowed' : 'pointer',
                opacity: beamActive || monsterDead || finished ? 0.6 : 1,
                animation: isShaking ? 'shake 0.5s ease-in-out' : 'none',
              }}
            >
              <div className='text-base'>{word.text}</div>
              <div className='text-xs mt-1 text-gray-600'>
                {word.meanings && word.meanings.length > 0 ? word.meanings[0].definition : word.definition}
              </div>
            </button>
          );
        })}
      </div>

      {flyingScores.map((fs) => (
        <div
          key={fs.id}
          className='fixed pointer-events-none z-50 font-bold text-lg'
          style={{
            left: fs.x,
            top: fs.y,
            color: fs.color,
            animation: 'scoreFloat 1.2s ease-out forwards',
          }}
        >
          {fs.text}
        </div>
      ))}
    </div>
  );
}