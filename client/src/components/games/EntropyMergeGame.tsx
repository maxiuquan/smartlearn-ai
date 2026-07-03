import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Trophy, Flame, Target, X } from 'lucide-react';
import { toast } from '../../store/toast';
import { ComboDisplay } from './GameFeedback';

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

interface Block {
  id: string;
  word: string;
  definition: string;
  root: string;
  color: string;
  col: number;
  row: number;
}

const ROOT_COLORS = [
  'bg-pink-100 border-pink-300 text-pink-700',
  'bg-yellow-100 border-yellow-300 text-yellow-700',
  'bg-green-100 border-green-300 text-green-700',
  'bg-blue-100 border-blue-300 text-blue-700',
  'bg-purple-100 border-purple-300 text-purple-700',
  'bg-orange-100 border-orange-300 text-orange-700',
  'bg-teal-100 border-teal-300 text-teal-700',
  'bg-indigo-100 border-indigo-300 text-indigo-700',
  'bg-rose-100 border-rose-300 text-rose-700',
  'bg-cyan-100 border-cyan-300 text-cyan-700',
  'bg-amber-100 border-amber-300 text-amber-700',
  'bg-lime-100 border-lime-300 text-lime-700',
];

const COMMON_ROOTS: string[] = [
  'dict', 'spect', 'port', 'form', 'struct', 'tract', 'vert', 'script',
  'gress', 'ject', 'rupt', 'duct', 'sist', 'mit', 'pel', 'pend',
  'sent', 'ceed', 'cept', 'fact', 'fort', 'grad', 'lect', 'log',
  'mand', 'min', 'mot', 'nat', 'nov', 'ord', 'path', 'press',
  'quest', 'reg', 'scend', 'serv', 'sign', 'solv', 'ten', 'test',
  'uni', 'val', 'ven', 'vid', 'voc', 'volv',
];

function findRoot(word: string): string {
  const lower = word.toLowerCase();
  for (const root of COMMON_ROOTS) {
    if (lower.includes(root)) return root;
  }
  return lower.substring(0, Math.min(4, lower.length));
}

function groupWordsByRoot(words: GameWord[]): Map<string, GameWord[]> {
  const groups = new Map<string, GameWord[]>();
  for (const w of words) {
    const root = findRoot(w.word);
    const existing = groups.get(root) || [];
    existing.push(w);
    groups.set(root, existing);
  }
  const validGroups = new Map<string, GameWord[]>();
  for (const [root, group] of groups) {
    if (group.length >= 2) {
      validGroups.set(root, group);
    }
  }
  return validGroups;
}

export function EntropyMergeGame({ onScoreSubmit }: { onScoreSubmit: (score: number, gameType: string) => void }) {
  const [words, setWords] = useState<GameWord[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [eliminated, setEliminated] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flyScore, setFlyScore] = useState<{ id: string; value: number }[]>([]);
  const [showCombo, setShowCombo] = useState(0);
  const blockIdRef = useRef(0);
  const dropTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rootColorMapRef = useRef<Map<string, string>>(new Map());
  const colorIndexRef = useRef(0);

  const getColorForRoot = (root: string): string => {
    const map = rootColorMapRef.current;
    if (!map.has(root)) {
      map.set(root, ROOT_COLORS[colorIndexRef.current % ROOT_COLORS.length]);
      colorIndexRef.current++;
    }
    return map.get(root)!;
  };

  const columnHeights = useCallback(() => {
    const heights = [0, 0, 0, 0, 0, 0];
    for (const b of blocks) {
      heights[b.col]++;
    }
    return heights;
  }, [blocks]);

  const initGame = useCallback(async () => {
    setLoading(true);
    setBlocks([]);
    setScore(0);
    setCombo(0);
    setEliminated(0);
    setSelectedId(null);
    setFinished(false);
    setGameOver(false);
    setFlyScore([]);
    setShowCombo(0);
    blockIdRef.current = 0;
    rootColorMapRef.current = new Map();
    colorIndexRef.current = 0;
    if (dropTimerRef.current) clearInterval(dropTimerRef.current);

    try {
      const res = await fetch('/api/english-games/words-pool?category=考研英语&limit=30');
      const data = await res.json();
      const wordList: GameWord[] = data.words || [];
      setWords(wordList);

      const groups = groupWordsByRoot(wordList);
      const flatWords: GameWord[] = [];
      for (const [, group] of groups) {
        for (const w of group) {
          flatWords.push(w);
        }
      }
      setWords(flatWords);

      let dropIndex = 0;
      dropTimerRef.current = setInterval(() => {
        if (dropIndex >= flatWords.length) {
          if (dropTimerRef.current) clearInterval(dropTimerRef.current);
          return;
        }
        const w = flatWords[dropIndex];
        const root = findRoot(w.word);
        const color = getColorForRoot(root);
        const col = Math.floor(Math.random() * 6);

        setBlocks((prev) => {
          const colBlocks = prev.filter((b) => b.col === col);
          if (colBlocks.length >= 5) {
            setGameOver(true);
            setFinished(true);
            if (dropTimerRef.current) clearInterval(dropTimerRef.current);
            return prev;
          }
          const newBlock: Block = {
            id: `block-${blockIdRef.current++}`,
            word: w.word,
            definition: w.definition,
            root,
            color,
            col,
            row: colBlocks.length,
          };
          return [...prev, newBlock];
        });

        dropIndex++;
        if (dropIndex >= flatWords.length) {
          if (dropTimerRef.current) clearInterval(dropTimerRef.current);
        }
      }, 1500);
    } catch {
      toast.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initGame();
    return () => {
      if (dropTimerRef.current) clearInterval(dropTimerRef.current);
    };
  }, [initGame]);

  useEffect(() => {
    if (gameOver && !finished) {
      setFinished(true);
      onScoreSubmit(score, 'entropy_merge');
    }
  }, [gameOver, finished, score, onScoreSubmit]);

  const handleBlockClick = (blockId: string) => {
    if (finished || gameOver) return;

    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    if (selectedId === null) {
      setSelectedId(blockId);
      return;
    }

    if (selectedId === blockId) {
      setSelectedId(null);
      return;
    }

    const selectedBlock = blocks.find((b) => b.id === selectedId);
    if (!selectedBlock) {
      setSelectedId(blockId);
      return;
    }

    if (selectedBlock.root === block.root) {
      const newCombo = combo + 1;
      const comboBonus = newCombo >= 10 ? 25 : newCombo >= 5 ? 10 : 0;
      const points = 15 + comboBonus;

      setScore((prev) => prev + points);
      setCombo(newCombo);
      setEliminated((prev) => prev + 1);
      setSelectedId(null);

      const flyId = `fly-${blockIdRef.current++}`;
      setFlyScore((prev) => [...prev, { id: flyId, value: points }]);
      setTimeout(() => {
        setFlyScore((prev) => prev.filter((f) => f.id !== flyId));
      }, 1000);

      if (newCombo >= 5) {
        setShowCombo(newCombo);
        setTimeout(() => setShowCombo(0), 2000);
      }

      setBlocks((prev) => {
        const remaining = prev.filter((b) => b.id !== selectedId && b.id !== blockId);
        const colGroups: Block[][] = [[], [], [], [], [], []];
        for (const b of remaining) {
          colGroups[b.col].push(b);
        }
        const reordered: Block[] = [];
        for (let c = 0; c < 6; c++) {
          colGroups[c].sort((a, b) => a.row - b.row);
          for (let r = 0; r < colGroups[c].length; r++) {
            reordered.push({ ...colGroups[c][r], row: r });
          }
        }
        return reordered;
      });
    } else {
      setCombo(0);
      setSelectedId(blockId);
    }
  };

  const handleRestart = () => {
    initGame();
  };

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
    const heights = columnHeights();
    return (
      <div className='card text-center py-8 space-y-6'>
        <div className='text-6xl animate-bounce'>{gameOver ? '💥' : '🎉'}</div>
        <div>
          <h2 className='text-2xl font-bold text-gray-900'>
            {gameOver ? '游戏结束！' : '全部消除！'}
          </h2>
          <p className='text-gray-500 mt-2'>
            {gameOver ? '方块堆满，防线崩溃' : '你成功消除了所有词根方块'}
          </p>
          {combo >= 5 && (
            <p className='text-orange-500 font-semibold mt-1'>最高连击: {combo}</p>
          )}
        </div>
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md mx-auto'>
          <div className='bg-primary-50 rounded-xl p-3'>
            <Trophy className='w-5 h-5 text-yellow-500 mx-auto mb-1' />
            <p className='text-xl font-bold text-primary-600'>{score}</p>
            <p className='text-xs text-gray-500'>总分</p>
          </div>
          <div className='bg-purple-50 rounded-xl p-3'>
            <Flame className='w-5 h-5 text-purple-500 mx-auto mb-1' />
            <p className='text-xl font-bold text-purple-600'>{combo}</p>
            <p className='text-xs text-gray-500'>最大连击</p>
          </div>
          <div className='bg-green-50 rounded-xl p-3'>
            <Target className='w-5 h-5 text-green-500 mx-auto mb-1' />
            <p className='text-xl font-bold text-green-600'>{eliminated}</p>
            <p className='text-xs text-gray-500'>已消除</p>
          </div>
          <div className='bg-red-50 rounded-xl p-3'>
            <X className='w-5 h-5 text-red-500 mx-auto mb-1' />
            <p className='text-xl font-bold text-red-600'>{Math.max(...heights)}</p>
            <p className='text-xs text-gray-500'>最大堆叠</p>
          </div>
        </div>
        <button onClick={handleRestart} className='btn-primary'>
          <RotateCcw size={16} className='mr-1' />
          再来一局
        </button>
      </div>
    );
  }

  const heights = columnHeights();
  const maxHeight = Math.max(...heights);

  return (
    <div className='space-y-4'>
      <ComboDisplay combo={showCombo} />

      <div className='flex items-center justify-between flex-wrap gap-2'>
        <div className='flex items-center gap-4'>
          <span className='text-sm font-medium text-gray-700'>
            得分：<span className='text-primary-600 font-bold'>{score}</span>
          </span>
          <span className='text-sm text-gray-500'>
            combo：<span className='text-orange-500 font-bold'>{combo}</span>
          </span>
          <span className='text-sm text-gray-500'>
            已消除：<span className='text-green-500 font-bold'>{eliminated}</span>
          </span>
        </div>
        <button onClick={handleRestart} className='btn-ghost text-xs px-3 py-1.5'>
          <RotateCcw size={14} className='mr-1' />
          重新开始
        </button>
      </div>

      <div className='flex gap-1 mb-2'>
        {heights.map((h, i) => {
          let barColor = 'bg-green-400';
          if (h >= 4) barColor = 'bg-red-500';
          else if (h >= 3) barColor = 'bg-yellow-400';
          return (
            <div key={i} className='flex-1 bg-gray-200 rounded-full h-2 overflow-hidden'>
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${(h / 5) * 100}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className='relative'>
        <div className='grid grid-cols-6 gap-1.5 sm:gap-2'>
          {[0, 1, 2, 3, 4, 5].map((col) => {
            const colBlocks = blocks
              .filter((b) => b.col === col)
              .sort((a, b) => b.row - a.row);

            return (
              <div key={col} className='flex flex-col-reverse gap-1.5 sm:gap-2 min-h-[320px] sm:min-h-[400px] bg-gray-50 rounded-xl p-1.5 sm:p-2 border border-gray-100'>
                {colBlocks.map((block) => {
                  const isSelected = selectedId === block.id;
                  const blockColor = block.color.split(' ');
                  const bgColor = blockColor[0];
                  const borderColor = blockColor[1];
                  const textColor = blockColor[2];

                  return (
                    <div key={block.id} className='relative'>
                      <button
                        onClick={() => handleBlockClick(block.id)}
                        className={`w-full px-1.5 sm:px-2 py-2 sm:py-3 rounded-lg border-2 text-xs sm:text-sm font-semibold transition-all duration-200 ${bgColor} ${borderColor} ${textColor} ${
                          isSelected ? 'ring-2 ring-offset-1 ring-yellow-400 scale-105 shadow-lg' : 'hover:scale-105 active:scale-95'
                        }`}
                      >
                        <div className='truncate'>{block.word}</div>
                        <div className='text-[10px] opacity-60 truncate mt-0.5'>{block.definition}</div>
                      </button>
                      {flyScore.some((f) => {
                        const flyBlock = blocks.find((b) => b.id === block.id);
                        return flyBlock && flyBlock.id === block.id;
                      }) && (
                        <div className='absolute -top-6 left-1/2 -translate-x-1/2 text-primary-600 font-bold text-sm animate-slide-up pointer-events-none'>
                          +{flyScore.find((f) => {
                            const fb = blocks.find((b) => b.id === block.id);
                            return fb && fb.id === block.id;
                          })?.value}
                        </div>
                      )}
                    </div>
                  );
                })}
                {colBlocks.length === 0 && (
                  <div className='flex items-center justify-center h-full text-gray-300 text-xs'>
                    空
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {flyScore
          .filter((f) => !blocks.some((b) => b.id === f.id.replace('fly-', '')))
          .map((f) => (
            <div
              key={f.id}
              className='fixed top-1/3 left-1/2 -translate-x-1/2 text-primary-600 font-bold text-lg pointer-events-none z-30'
              style={{ animation: 'fly-score 1s ease-out forwards' }}
            >
              +{f.value}
            </div>
          ))}
      </div>

      <style>{`
        @keyframes fly-score {
          0% { transform: translate(-50%, 0) scale(0.5); opacity: 1; }
          100% { transform: translate(-50%, -60px) scale(1.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}