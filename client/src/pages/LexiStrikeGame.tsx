import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as PIXI from 'pixi.js';
import { ResourceManager } from '../components/lexi-strike/core/ResourceManager';
import { WordManager, WordEntry } from '../components/lexi-strike/core/WordManager';
import { InputManager } from '../components/lexi-strike/core/InputManager';
import { GameLoop, GameState, GameMode, FeedbackInfo } from '../components/lexi-strike/core/GameLoop';
import Menu from '../components/lexi-strike/ui/Menu';
import HUD from '../components/lexi-strike/ui/HUD';
import ImportWords from '../components/lexi-strike/ui/ImportWords';
import { useAuthStore } from '../store/auth';
import { useProgressStore } from '../store/progress';
import { api } from '../api/client';
import { Trophy, Zap, Target, RotateCcw, Sparkles, BookOpen, ChevronLeft, ChevronRight, Check, X, ArrowRight } from 'lucide-react';

type PageState = 'menu' | 'preGame' | 'playing' | 'shop' | 'import' | 'postGameQuiz' | 'result';

export default function LexiStrikeGame() {
  const { userId } = useAuthStore();
  const navigate = useNavigate();
  const progressStore = useProgressStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);
  const resourceManagerRef = useRef<ResourceManager>(new ResourceManager());
  const wordManagerRef = useRef<WordManager>(new WordManager());
  const inputManagerRef = useRef<InputManager>(new InputManager());

  const [pageState, setPageState] = useState<PageState>('menu');
  const [gameState, setGameState] = useState<GameState>({
    mode: 'road', status: 'playing',
    score: 0, combo: 0, maxCombo: 0,
    hp: 100, maxHp: 100, kills: 0,
    wave: 1, totalWaves: 10, timeLeft: 60,
    xpGained: 0, accuracy: 100,
    correctAnswers: 0, wrongAnswers: 0,
  });
  const [mode, setMode] = useState<GameMode>('road');
  const [isMobile, setIsMobile] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [feedback, setFeedback] = useState<FeedbackInfo | null>(null);
  const [gameResult, setGameResult] = useState<'victory' | 'defeat' | null>(null);
  const [highScore, setHighScore] = useState(0);
  const [wordStats, setWordStats] = useState({ total: 0, mastered: 0, learning: 0 });

  const learningWordsRef = useRef<WordEntry[]>([]);
  const [preGameCurrentIdx, setPreGameCurrentIdx] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [allCardsViewed, setAllCardsViewed] = useState(false);
  const [preGameLoading, setPreGameLoading] = useState(false);

  const [quizCurrentIdx, setQuizCurrentIdx] = useState(0);
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState<number | null>(null);
  const [quizAnswerCorrect, setQuizAnswerCorrect] = useState<boolean | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizCorrectCount, setQuizCorrectCount] = useState(0);
  const [quizChoices, setQuizChoices] = useState<string[][]>([]);
  const [quizResultDetail, setQuizResultDetail] = useState<boolean[]>([]);

  useEffect(() => {
    const hs = localStorage.getItem('lexi_strike_highscore');
    if (hs) setHighScore(parseInt(hs));
    setWordStats(wordManagerRef.current.getStats());
  }, []);

  const initGame = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const app = new PIXI.Application({
      view: canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x0A0A0A,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    appRef.current = app;
    const resources = resourceManagerRef.current;
    resources.generateTextures(app);
    resources.generateSounds();

    const input = inputManagerRef.current;
    input.setup(canvas);
    setIsMobile(input.isMobile);

    const loop = new GameLoop(app, resources, wordManagerRef.current, input);
    loop.init();
    loop.onStateUpdate = (state) => {
      setGameState({ ...state });
      if (state.status === 'over') {
        const newHS = Math.max(highScore, state.score);
        setHighScore(newHS);
        localStorage.setItem('lexi_strike_highscore', String(newHS));
        if (userId) {
          try {
            fetch('/api/english-games/score', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, score: state.score, gameType: 'lexi_strike' }),
            });
          } catch { /* ignore */ }
        }
        progressStore.addXP(state.xpGained);
        progressStore.recordGame('lexi_strike', state.score);
        setGameResult(state.hp > 0 ? 'victory' : 'defeat');
        startPostGameQuiz();
      }
    };
    loop.onModeSwitch = (newMode) => {
      setMode(newMode);
    };
    loop.onChoicesUpdate = (word, newChoices) => {
      setCurrentWord(word);
      setChoices(newChoices);
    };
    loop.onFeedback = (info) => {
      setFeedback(info);
    };
    loop.onGameOver = (result) => {
      setGameResult(result);
    };
    gameLoopRef.current = loop;

    const resize = () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', resize);

    app.ticker.add((delta) => {
      loop.update(delta);
    });
  }, [highScore, userId, progressStore]);

  useEffect(() => {
    return () => {
      gameLoopRef.current?.destroy();
      appRef.current?.destroy(true, { children: true });
    };
  }, []);

  const fetchLearningWords = async (): Promise<WordEntry[]> => {
    if (userId) {
      try {
        const res = await api.getUserWords(userId);
        if ((res as any).words && Array.isArray((res as any).words) && (res as any).words.length > 0) {
          const reviewWords = (res as any).words.slice(0, 5).map((w: any) => ({
            en: w.en || w.word || '',
            zh: w.zh || w.meaning || '',
            distractors: w.distractors || [],
          }));
          if (reviewWords.length > 0) return reviewWords;
        }
      } catch { /* fall through */ }
    }

    try {
      const res = await api.getWords({ difficulty: '1', limit: '5' });
      if ((res as any).words && Array.isArray((res as any).words)) {
        return (res as any).words.slice(0, 5).map((w: any) => ({
          en: w.en || w.word || '',
          zh: w.zh || w.meaning || '',
          distractors: w.distractors || [],
        }));
      }
    } catch { /* fall through */ }

    const builtIn = wordManagerRef.current.getAllWords();
    const shuffled = [...builtIn].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  };

  const startPreGame = async () => {
    setPreGameLoading(true);
    setPageState('preGame');
    const words = await fetchLearningWords();
    learningWordsRef.current = words;
    setPreGameCurrentIdx(0);
    setFlashcardFlipped(false);
    setAllCardsViewed(false);
    setPreGameLoading(false);
  };

  const handleNextCard = () => {
    if (preGameCurrentIdx < learningWordsRef.current.length - 1) {
      setPreGameCurrentIdx(preGameCurrentIdx + 1);
      setFlashcardFlipped(false);
    } else {
      setAllCardsViewed(true);
    }
  };

  const handlePrevCard = () => {
    if (preGameCurrentIdx > 0) {
      setPreGameCurrentIdx(preGameCurrentIdx - 1);
      setFlashcardFlipped(false);
      setAllCardsViewed(false);
    }
  };

  const handleFlipCard = () => {
    setFlashcardFlipped(!flashcardFlipped);
  };

  const handlePreGameDone = async () => {
    const words = learningWordsRef.current;
    wordManagerRef.current.setPriorityWords(words);
    setChoices([]);
    setCurrentWord('');
    setFeedback(null);
    setPageState('playing');
    await initGame();
  };

  const generateQuizChoices = (correctZh: string): string[] => {
    const allWords = wordManagerRef.current.getAllWords();
    const otherDefs = allWords
      .filter(w => w.zh !== correctZh && w.zh)
      .map(w => w.zh);
    const uniqueDefs = [...new Set(otherDefs)].filter(d => d !== correctZh);
    const shuffled = uniqueDefs.sort(() => Math.random() - 0.5);
    const distractors = shuffled.slice(0, 3);
    const choices = [correctZh, ...distractors];
    return choices.sort(() => Math.random() - 0.5);
  };

  const startPostGameQuiz = () => {
    const words = learningWordsRef.current;
    if (words.length === 0) {
      setPageState('result');
      return;
    }
    const choicesForAll = words.map(w => generateQuizChoices(w.zh));
    setQuizChoices(choicesForAll);
    setQuizCurrentIdx(0);
    setQuizSelectedAnswer(null);
    setQuizAnswerCorrect(null);
    setQuizCompleted(false);
    setQuizCorrectCount(0);
    setQuizResultDetail([]);
    setPageState('postGameQuiz');
  };

  const handleQuizSelect = (choiceIdx: number) => {
    if (quizSelectedAnswer !== null) return;
    const words = learningWordsRef.current;
    const correct = quizChoices[quizCurrentIdx][choiceIdx] === words[quizCurrentIdx].zh;
    setQuizSelectedAnswer(choiceIdx);
    setQuizAnswerCorrect(correct);
    if (correct) {
      setQuizCorrectCount(prev => prev + 1);
    }
    setQuizResultDetail(prev => [...prev, correct]);
  };

  const handleQuizNext = () => {
    const words = learningWordsRef.current;
    if (quizCurrentIdx < words.length - 1) {
      setQuizCurrentIdx(quizCurrentIdx + 1);
      setQuizSelectedAnswer(null);
      setQuizAnswerCorrect(null);
    } else {
      setQuizCompleted(true);
    }
  };

  const handleQuizRetry = () => {
    const words = learningWordsRef.current;
    const choicesForAll = words.map(w => generateQuizChoices(w.zh));
    setQuizChoices(choicesForAll);
    setQuizCurrentIdx(0);
    setQuizSelectedAnswer(null);
    setQuizAnswerCorrect(null);
    setQuizCompleted(false);
    setQuizCorrectCount(0);
    setQuizResultDetail([]);
  };

  const handleQuizDone = () => {
    setPageState('result');
  };

  const handleStart = async () => {
    await startPreGame();
  };

  const handleSelect = (key: 'A' | 'B' | 'C') => {
    gameLoopRef.current?.handleSelect(key);
    inputManagerRef.current.setMobileInput('select', key);
  };

  const handleImport = (jsonString: string): boolean => {
    const result = wordManagerRef.current.loadCustomWords(jsonString);
    if (result) {
      setWordStats(wordManagerRef.current.getStats());
    }
    return result;
  };

  const handleRestart = () => {
    gameLoopRef.current?.destroy();
    appRef.current?.destroy(true, { children: true });
    appRef.current = null;
    gameLoopRef.current = null;
    setQuizCurrentIdx(0);
    setQuizSelectedAnswer(null);
    setQuizAnswerCorrect(null);
    setQuizCompleted(false);
    setQuizCorrectCount(0);
    setQuizResultDetail([]);
    setQuizChoices([]);
    startPreGame();
  };

  const handleGoToMenu = () => {
    gameLoopRef.current?.destroy();
    appRef.current?.destroy(true, { children: true });
    appRef.current = null;
    gameLoopRef.current = null;
    setPageState('menu');
    setGameResult(null);
    setChoices([]);
    setCurrentWord('');
    setFeedback(null);
    setWordStats(wordManagerRef.current.getStats());
    setPreGameCurrentIdx(0);
    setFlashcardFlipped(false);
    setAllCardsViewed(false);
    setQuizCurrentIdx(0);
    setQuizSelectedAnswer(null);
    setQuizAnswerCorrect(null);
    setQuizCompleted(false);
    setQuizCorrectCount(0);
    setQuizResultDetail([]);
    setQuizChoices([]);
  };

  const formatScore = (s: number) => s.toLocaleString();

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {pageState === 'menu' && (
        <Menu
          onStart={handleStart}
          onShop={() => setPageState('shop')}
          onImport={() => setPageState('import')}
          highScore={highScore}
          stats={wordStats}
        />
      )}

      {pageState === 'import' && (
        <ImportWords
          onImport={handleImport}
          onClose={() => setPageState('menu')}
        />
      )}

      {pageState === 'preGame' && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/90">
          <div className="bg-[#1A1D24] border border-gray-700 rounded-2xl p-8 max-w-lg w-full mx-4 text-center space-y-6">
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="w-6 h-6 text-[#00FF9C]" />
              <h2 className="text-2xl font-bold text-white">战前词汇训练</h2>
            </div>
            <p className="text-gray-400 text-sm">
              请翻看以下 {learningWordsRef.current.length} 个单词，准备战斗！
            </p>

            {preGameLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#00FF9C] border-t-transparent" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={handlePrevCard}
                    disabled={preGameCurrentIdx === 0}
                    className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-300" />
                  </button>

                  <div
                    onClick={handleFlipCard}
                    className="relative w-56 h-36 cursor-pointer perspective-500"
                    style={{ perspective: '800px' }}
                  >
                    <div
                      className="relative w-full h-full transition-transform duration-500"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: flashcardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      }}
                    >
                      <div
                        className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#1A1D24] to-[#252830] border-2 border-[#00FF9C]/30 flex flex-col items-center justify-center"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <span className="text-sm text-gray-500 mb-2">点击翻转</span>
                        <span className="text-2xl font-bold text-white">
                          {learningWordsRef.current[preGameCurrentIdx]?.en}
                        </span>
                      </div>
                      <div
                        className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#0D1F17] to-[#1A1D24] border-2 border-[#00FF9C]/50 flex flex-col items-center justify-center"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      >
                        <span className="text-sm text-[#00FF9C]/70 mb-2">释义</span>
                        <span className="text-xl font-bold text-[#00FF9C] px-4 text-center">
                          {learningWordsRef.current[preGameCurrentIdx]?.zh}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleNextCard}
                    disabled={allCardsViewed}
                    className="p-2 rounded-full hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2">
                  {learningWordsRef.current.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        idx === preGameCurrentIdx ? 'bg-[#00FF9C]' : idx < preGameCurrentIdx ? 'bg-[#00FF9C]/40' : 'bg-gray-600'
                      } ${allCardsViewed ? 'bg-[#00FF9C]/40' : ''}`}
                    />
                  ))}
                </div>

                {allCardsViewed && (
                  <button
                    onClick={handlePreGameDone}
                    className="w-full py-3 rounded-xl font-bold bg-[#00FF9C]/20 border-2 border-[#00FF9C]/60 text-[#00FF9C] hover:bg-[#00FF9C]/30 flex items-center justify-center gap-2"
                  >
                    准备就绪！
                    <ArrowRight size={18} />
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => {
                setPageState('menu');
                setPreGameCurrentIdx(0);
                setFlashcardFlipped(false);
                setAllCardsViewed(false);
              }}
              className="text-gray-500 hover:text-gray-300 text-sm"
            >
              返回菜单
            </button>
          </div>
        </div>
      )}

      {pageState === 'shop' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0A0A] z-20 px-6">
          <div className="max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">词库商店</h2>
              <button onClick={() => setPageState('menu')} className="text-gray-400 hover:text-white">返回</button>
            </div>
            <div className="space-y-2">
              {[
                { id: 'free', name: '考研核心100词', desc: '免费内置词库', price: 0, owned: true },
                { id: 'custom', name: '自定义词库', desc: '导入你自己的词库', price: 0, owned: true },
              ].map(book => (
                <div key={book.id} className="flex items-center justify-between p-3 rounded-xl bg-[#1A1D24] border border-gray-700">
                  <div>
                    <p className="text-white text-sm">{book.name}</p>
                    <p className="text-gray-500 text-xs">{book.desc}</p>
                  </div>
                  {book.owned ? (
                    <span className="text-[#00FF9C] text-xs">已拥有</span>
                  ) : (
                    <button className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold">
                      💎 {book.price}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {pageState === 'playing' && (
        <HUD
          state={gameState}
          mode={mode}
          isMobile={isMobile}
          choices={choices}
          currentWord={currentWord}
          feedback={feedback}
          onSelect={handleSelect}
          onPause={() => {}}
        />
      )}

      {pageState === 'postGameQuiz' && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/90">
          <div className="bg-[#1A1D24] border border-gray-700 rounded-2xl p-8 max-w-lg w-full mx-4 text-center space-y-6">
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="w-6 h-6 text-[#FFD700]" />
              <h2 className="text-2xl font-bold text-white">战后词汇检验</h2>
            </div>

            {quizCompleted ? (
              <>
                <div className={`text-5xl font-bold ${quizCorrectCount === learningWordsRef.current.length ? 'text-[#00FF9C]' : 'text-[#FFD700]'}`}>
                  {quizCorrectCount === learningWordsRef.current.length ? '🏆' : '📖'}
                </div>
                <div>
                  <p className="text-xl font-bold text-white">
                    词汇掌握 <span className={quizCorrectCount === learningWordsRef.current.length ? 'text-[#00FF9C]' : 'text-[#FFD700]'}>{quizCorrectCount}</span>/{learningWordsRef.current.length}
                  </p>
                </div>

                <div className="space-y-2">
                  {learningWordsRef.current.map((word, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        quizResultDetail[idx] ? 'bg-[#00FF9C]/10 border border-[#00FF9C]/20' : 'bg-red-500/10 border border-red-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {quizResultDetail[idx] ? (
                          <Check size={16} className="text-[#00FF9C]" />
                        ) : (
                          <X size={16} className="text-red-400" />
                        )}
                        <span className="text-white text-sm">{word.en}</span>
                      </div>
                      <span className={`text-xs ${quizResultDetail[idx] ? 'text-[#00FF9C]' : 'text-red-400'}`}>
                        {word.zh}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  {quizCorrectCount < learningWordsRef.current.length && (
                    <button
                      onClick={handleQuizRetry}
                      className="flex-1 py-3 rounded-xl font-bold border border-[#FFD700]/40 text-[#FFD700] hover:bg-[#FFD700]/10 flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={16} /> 再来一次
                    </button>
                  )}
                  <button
                    onClick={handleQuizDone}
                    className="flex-1 py-3 rounded-xl font-bold bg-[#00FF9C]/20 border-2 border-[#00FF9C]/60 text-[#00FF9C] hover:bg-[#00FF9C]/30 flex items-center justify-center gap-2"
                  >
                    查看成绩 <ArrowRight size={16} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm">
                  请选择单词的正确释义 ({quizCurrentIdx + 1}/{learningWordsRef.current.length})
                </p>

                <div className="bg-[#0D0F14] rounded-xl p-6 border border-gray-700">
                  <p className="text-3xl font-bold text-white mb-4">
                    {learningWordsRef.current[quizCurrentIdx]?.en}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {quizChoices[quizCurrentIdx]?.map((choice, idx) => {
                      let btnStyle = 'border-gray-600 bg-[#1A1D24] text-gray-300 hover:border-gray-400 hover:bg-[#252830]';
                      if (quizSelectedAnswer !== null) {
                        const correctAnswer = learningWordsRef.current[quizCurrentIdx].zh;
                        if (choice === correctAnswer) {
                          btnStyle = 'border-[#00FF9C] bg-[#00FF9C]/10 text-[#00FF9C]';
                        } else if (idx === quizSelectedAnswer && !quizAnswerCorrect) {
                          btnStyle = 'border-red-400 bg-red-500/10 text-red-400';
                        } else {
                          btnStyle = 'border-gray-700 bg-[#1A1D24] text-gray-500';
                        }
                      }
                      return (
                        <button
                          key={idx}
                          onClick={() => handleQuizSelect(idx)}
                          disabled={quizSelectedAnswer !== null}
                          className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${btnStyle}`}
                        >
                          {choice}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {quizSelectedAnswer !== null && (
                  <button
                    onClick={handleQuizNext}
                    className="w-full py-3 rounded-xl font-bold bg-[#00FF9C]/20 border-2 border-[#00FF9C]/60 text-[#00FF9C] hover:bg-[#00FF9C]/30 flex items-center justify-center gap-2"
                  >
                    {quizCurrentIdx < learningWordsRef.current.length - 1 ? '下一题' : '查看结果'}
                    <ArrowRight size={16} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {pageState === 'result' && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1A1D24] border border-gray-700 rounded-2xl p-8 max-w-md w-full mx-4 text-center space-y-6">
            <div className="text-6xl">{gameResult === 'defeat' ? '💀' : '🏆'}</div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">{gameResult === 'defeat' ? '任务失败' : '任务完成!'}</h2>
              <p className="text-gray-400 text-sm">{gameResult === 'defeat' ? '你的HP归零了' : '恭喜完成所有波次!'}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0D0F14] rounded-xl p-4">
                <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-white">{formatScore(gameState.score)}</p>
                <p className="text-xs text-gray-500">得分</p>
              </div>
              <div className="bg-[#0D0F14] rounded-xl p-4">
                <Target className="w-5 h-5 text-red-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-white">{gameState.kills}</p>
                <p className="text-xs text-gray-500">正确答题</p>
              </div>
              <div className="bg-[#0D0F14] rounded-xl p-4">
                <Zap className="w-5 h-5 text-[#00FF9C] mx-auto mb-1" />
                <p className="text-2xl font-bold text-[#00FF9C]">{gameState.maxCombo}x</p>
                <p className="text-xs text-gray-500">最高连击</p>
              </div>
              <div className="bg-[#0D0F14] rounded-xl p-4">
                <Sparkles className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-purple-400">+{gameState.xpGained}</p>
                <p className="text-xs text-gray-500">XP 获得</p>
              </div>
            </div>

            <div className="bg-[#0D0F14] rounded-xl p-3">
              <div className="flex justify-between text-xs text-gray-500">
                <span>正确率</span>
                <span className="text-white">{gameState.accuracy}%</span>
              </div>
              <div className="w-full h-1 bg-gray-700 rounded-full mt-1">
                <div className="h-full bg-[#00FF9C] rounded-full" style={{ width: `${gameState.accuracy}%` }} />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleGoToMenu} className="flex-1 py-3 rounded-xl font-bold border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white">
                返回菜单
              </button>
              <button onClick={handleRestart} className="flex-1 py-3 rounded-xl font-bold bg-[#00FF9C]/20 border border-[#00FF9C]/40 text-[#00FF9C] hover:bg-[#00FF9C]/30 flex items-center justify-center gap-2">
                <RotateCcw size={16} /> 再来一局
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}