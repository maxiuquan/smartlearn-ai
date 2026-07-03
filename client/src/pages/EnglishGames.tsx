import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useProgressStore, ALL_ACHIEVEMENTS } from '../store/progress';
import { useMembershipStore } from '../store/membership';
import { toast } from '../store/toast';
import {
  Gamepad2, Trophy, Zap, Puzzle, Timer, Target, RotateCcw,
  Check, SkipForward, Lightbulb, Clock, Flame, Star, Award,
  Brain, Grid3X3, Eye, EyeOff, Swords, Search, Sparkles, TrendingUp,
  Shield,
} from 'lucide-react';
import { ProgressionSystem } from '../core';
import { LexiconDefenseGame } from '../components/games/LexiconDefenseGame';
import {
  GameInstructions,
  WORD_MATCH_INSTRUCTIONS,
  SPEED_CHALLENGE_INSTRUCTIONS,
  WORD_PUZZLE_INSTRUCTIONS,
  MEMORY_FLIP_INSTRUCTIONS,
  WORD_SEARCH_INSTRUCTIONS,
  HANGMAN_INSTRUCTIONS,
  LEXICON_DEFENSE_INSTRUCTIONS,
} from '../components/games/GameInstructions';

interface GameWord {
  id: number;
  word: string;
  phonetic: string | null;
  definition: string;
  exampleSentence: string | null;
  partOfSpeech: string | null;
  difficulty: number;
  category: string | null;
}

type GameType = 'word_match' | 'speed_challenge' | 'word_puzzle' | 'memory_flip' | 'word_search' | 'hangman' | 'lexicon_defense';

interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_game', icon: '🎮', name: '初次体验', description: '完成第一次游戏' },
  { id: 'streak_10', icon: '🔥', name: '连击大师', description: '在消消乐中连续正确匹配10次' },
  { id: 'score_100', icon: '💯', name: '百分玩家', description: '单次游戏获得100分' },
  { id: 'score_500', icon: '🏆', name: '高分选手', description: '单次游戏获得500分' },
  { id: 'perfect', icon: '✨', name: '完美通关', description: '一局游戏零失误完成' },
  { id: 'speed_master', icon: '⚡', name: '速度达人', description: '在30秒内完成游戏' },
];

const LEVEL_NAMES = ['', '英语新手', '单词学徒', '记词达人', '词汇大师', '英语学霸', '单词王者', '词汇传奇', '英语专家', '词汇之神', '至尊词圣'];

const COLORS = ['#FF6B6B', '#FECA57', '#48DBFB', '#FF9FF3', '#54A0FF', '#5F27CD', '#01A3A4', '#F368E0', '#FF6348', '#7BED9F', '#E056A0', '#2ED573'];

function loadProgressionStats() {
  try {
    const raw = localStorage.getItem('lexiverse_progression');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        vocabPower: parsed.vocabPower ?? 100,
        readingSpeed: parsed.readingSpeed ?? 100,
        logicIndex: parsed.logicIndex ?? 100,
        mathPower: parsed.mathPower ?? 100,
      };
    }
  } catch { /* ignore */ }
  return { vocabPower: 100, readingSpeed: 100, logicIndex: 100, mathPower: 100 };
}

function LexiVerseStatsBar() {
  const [stats] = useState(loadProgressionStats);

  const items = [
    { icon: '📖', label: '词汇算力', value: stats.vocabPower },
    { icon: '👁️', label: '阅读速度', value: stats.readingSpeed },
    { icon: '🧠', label: '逻辑指数', value: stats.logicIndex },
    { icon: '📐', label: '数学算力', value: stats.mathPower },
  ];

  return (
    <div className="card py-3 px-5 bg-[#1a1d24] border-[#00FF9C]/10">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2">LexiVerse 算力面板</p>
      <div className="grid grid-cols-4 gap-3">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <span className="text-xs">{item.icon}</span>
            <div className="text-[10px] text-gray-400 mt-0.5">{item.label}</div>
            <div className="text-xs text-[#00FF9C] font-mono font-bold">{item.value}</div>
            <div className="w-full bg-[#0D0F14] rounded-full h-1 mt-0.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#00FF9C] transition-all duration-500"
                style={{ width: `${Math.min((item.value / 300) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ConfettiEffect({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<{ id: number; color: string; left: number; delay: number; size: number }[]>([]);

  useEffect(() => {
    if (active) {
      const items = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        left: Math.random() * 100,
        delay: Math.random() * 2,
        size: 6 + Math.random() * 10,
      }));
      setParticles(items);
      const timer = setTimeout(() => setParticles([]), 3500);
      return () => clearTimeout(timer);
    } else {
      setParticles([]);
    }
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm animate-confetti-fall"
          style={{
            left: `${p.left}%`,
            top: '-20px',
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}

function LevelUpModal({ level, onClose }: { level: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center animate-scale-in shadow-2xl">
        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400 flex items-center justify-center">
          <span className="text-5xl font-bold text-white drop-shadow-lg">{level}</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">等级提升！</h2>
        <p className="text-lg text-orange-600 font-semibold mb-1">{LEVEL_NAMES[level]}</p>
        <p className="text-sm text-gray-500 mb-6">恭喜你达到了新的等级！继续加油！</p>
        <button
          onClick={onClose}
          className="w-full py-3 bg-gradient-to-r from-orange-400 to-red-400 text-white font-bold rounded-xl hover:from-orange-500 hover:to-red-500 transition-all"
        >
          继续
        </button>
      </div>
      <style>{`
        @keyframes scale-in {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scale-in 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}

function AchievementPopup({ achievement, onDone }: { achievement: Achievement | null; onDone: () => void }) {
  useEffect(() => {
    if (achievement) {
      const timer = setTimeout(onDone, 3000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onDone]);

  if (!achievement) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className="bg-white rounded-2xl shadow-xl border border-yellow-200 p-4 flex items-center gap-3 max-w-xs">
        <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl flex-shrink-0">
          {achievement.icon}
        </div>
        <div>
          <p className="text-xs text-yellow-600 font-medium">成就解锁！</p>
          <p className="text-sm font-bold text-gray-900">{achievement.name}</p>
          <p className="text-xs text-gray-500">{achievement.description}</p>
        </div>
      </div>
      <style>{`
        @keyframes slide-up {
          0% { transform: translateY(100px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
}

function XPRewardAnimation({ xp, id }: { xp: number; id: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      key={id}
      className="fixed top-20 right-8 z-50 pointer-events-none"
      style={{ animation: 'xp-fly 1.5s ease-out forwards' }}
    >
      <span className="text-xl font-bold text-yellow-500 drop-shadow-md">
        +{xp} XP
      </span>
      <style>{`
        @keyframes xp-fly {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          30% { transform: translateY(-20px) scale(1.2); opacity: 1; }
          100% { transform: translateY(-60px) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

interface GameStats {
  gamesPlayed: number;
  totalScore: number;
  todayScore: number;
  highestScore: number;
  streak: number;
  level: number;
  xp: number;
}

interface GameTab {
  key: GameType;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  desc: string;
  isPremium?: boolean;
}

const GAMES: GameTab[] = [
  { key: 'word_match', label: '单词消消乐', icon: Puzzle as React.FC<{ size?: number; className?: string }>, desc: '配对英文与中文释义' },
  { key: 'speed_challenge', label: '速拼挑战', icon: Zap as React.FC<{ size?: number; className?: string }>, desc: '限时拼写英文单词' },
  { key: 'word_puzzle', label: '单词拼图', icon: Gamepad2 as React.FC<{ size?: number; className?: string }>, desc: '看释义拼写单词' },
  { key: 'memory_flip', label: '翻牌记忆', icon: Brain as React.FC<{ size?: number; className?: string }>, desc: '翻牌配对中英释义' },
  { key: 'word_search', label: '单词搜索', icon: Search as React.FC<{ size?: number; className?: string }>, desc: '在字母网格中找单词' },
  { key: 'hangman', label: '猜词大挑战', icon: Swords as React.FC<{ size?: number; className?: string }>, desc: '猜字母拼出单词' },
  { key: 'lexicon_defense', label: '防线突围', icon: Shield as React.FC<{ size?: number; className?: string }>, desc: '塔防策略，词汇炮塔消灭怪兽', isPremium: true },
];

export default function EnglishGames() {
  const { userId } = useAuthStore();
  const navigate = useNavigate();
  const progressStore = useProgressStore();
  const { getLevel, getLevelName, getXPProgress, addXP, recordGame, checkAchievements, isDailyChallenge, getDailyChallengeGame, getStreakDays } = progressStore;
  const { tier, isPremiumGame } = useMembershipStore();

  const level = getLevel();
  const levelName = getLevelName();
  const xpPercent = getXPProgress();
  const streakDays = getStreakDays();

  const [activeGame, setActiveGame] = useState<GameType>('word_match');
  const [stats, setStats] = useState<GameStats>(() => {
    const saved = loadFromStorage<Partial<GameStats>>('english_game_stats', {});
    return {
      gamesPlayed: saved.gamesPlayed ?? 0,
      totalScore: saved.totalScore ?? 0,
      todayScore: saved.todayScore ?? 0,
      highestScore: saved.highestScore ?? 0,
      streak: saved.streak ?? 0,
      level: level,
      xp: progressStore.xp,
    };
  });

  const [showConfetti, setShowConfetti] = useState(false);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [achievements, setAchievements] = useState<string[]>(() =>
    loadFromStorage<string[]>('english_game_achievements', [])
  );
  const [xpAnimations, setXpAnimations] = useState<{ id: number; xp: number }[]>([]);
  const xpIdRef = useRef(0);

  const [apiStats, setApiStats] = useState<{ gamesPlayed: number; totalScore: number; highestScore: number }>({
    gamesPlayed: 0, totalScore: 0, highestScore: 0,
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  const [dailyChallenge] = useState<{ date: string; gameType: GameType }>(() => {
    const saved = loadFromStorage<{ date: string; gameType: GameType } | null>('english_daily_challenge', null);
    if (saved && saved.date === todayStr) return saved;
    const gameTypes: GameType[] = ['word_match', 'speed_challenge', 'word_puzzle', 'memory_flip', 'word_search', 'hangman', 'lexicon_defense'];
    const random = gameTypes[Math.floor(Math.random() * gameTypes.length)];
    const challenge = { date: todayStr, gameType: random };
    saveToStorage('english_daily_challenge', challenge);
    return challenge;
  });

  useEffect(() => {
    saveToStorage('english_game_stats', { gamesPlayed: stats.gamesPlayed, totalScore: stats.totalScore, todayScore: stats.todayScore, highestScore: stats.highestScore, streak: stats.streak });
  }, [stats]);

  useEffect(() => {
    saveToStorage('english_game_achievements', achievements);
  }, [achievements]);

  useEffect(() => {
    const lastPlayDate = loadFromStorage<string | null>('english_last_play_date', null);
    if (lastPlayDate !== todayStr) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      let newStreak = stats.streak;
      if (lastPlayDate === yesterdayStr) {
        newStreak = stats.streak + 1;
      } else if (lastPlayDate !== todayStr) {
        newStreak = 1;
      }
      setStats(prev => ({ ...prev, streak: newStreak, todayScore: 0 }));
      saveToStorage('english_last_play_date', todayStr);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetch(`/api/english-games/stats/${userId}`)
        .then(r => r.json())
        .then(data => setApiStats(data))
        .catch(() => {});
    }
  }, [userId]);

  const handleScoreSubmit = useCallback(async (score: number, gameType: string, extraParams?: { combo?: number; mistakes?: number; timeSpent?: number }) => {
    const isDaily = isDailyChallenge(gameType);
    const xpGain = Math.floor(score / 10) * (isDaily ? 2 : 1);

    const oldLevel = getLevel();
    addXP(xpGain);
    recordGame(gameType, score);
    const newLevel = getLevel();

    const newAchievements = checkAchievements();
    if (newAchievements.length > 0) {
      const ach = ALL_ACHIEVEMENTS.find(a => a.id === newAchievements[0]);
      if (ach) setCurrentAchievement(ach);
    }

    if (newLevel > oldLevel) {
      setLevelUp(newLevel);
    }

    setStats(prev => ({
      ...prev,
      gamesPlayed: prev.gamesPlayed + 1,
      totalScore: prev.totalScore + score,
      todayScore: prev.todayScore + score,
      highestScore: Math.max(prev.highestScore, score),
      level: newLevel,
      xp: progressStore.xp + xpGain,
    }));

    if (score >= 100) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
    }

    xpIdRef.current += 1;
    setXpAnimations(prev => [...prev, { id: xpIdRef.current, xp: xpGain }]);
    setTimeout(() => {
      setXpAnimations(prev => prev.filter(x => x.id !== xpIdRef.current));
    }, 1600);

    if (userId) {
      try {
        await fetch('/api/english-games/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, score, gameType }),
        });
        setApiStats(prev => ({
          gamesPlayed: prev.gamesPlayed + 1,
          totalScore: prev.totalScore + score,
          highestScore: Math.max(prev.highestScore, score),
        }));
      } catch {
        toast.error('保存分数失败');
      }
    }
  }, [userId, addXP, recordGame, checkAchievements, getLevel, isDailyChallenge, progressStore.xp]);

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3500);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <ConfettiEffect active={showConfetti} />
      {levelUp && <LevelUpModal level={levelUp} onClose={() => setLevelUp(null)} />}
      <AchievementPopup achievement={currentAchievement} onDone={() => setCurrentAchievement(null)} />
      {xpAnimations.map(xa => <XPRewardAnimation key={xa.id} xp={xa.xp} id={xa.id} />)}

      <button
        onClick={() => navigate('/lexi-strike')}
        className="w-full card p-4 bg-gradient-to-r from-[#0D0F14] via-[#1A1D24] to-[#0D0F14] border-[#00FF9C]/20 hover:border-[#00FF9C]/50 transition-all group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#00FF9C]/5 to-transparent" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#00FF9C]/10 border border-[#00FF9C]/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Target size={28} className="text-[#00FF9C]" />
          </div>
          <div className="text-left flex-1">
            <h3 className="text-white font-bold text-lg" style={{ fontFamily: '"Orbitron", monospace' }}>
              LEXI-STRIKE <span className="text-[#00FF9C]/50 text-xs tracking-wider">GLOBAL</span>
            </h3>
            <p className="text-gray-400 text-sm mt-0.5">赛博军事风 · FPS射击 + 擂台格斗 · 新游戏上线</p>
          </div>
          <div className="text-[#00FF9C] group-hover:translate-x-1 transition-transform">
            <Zap size={24} />
          </div>
        </div>
      </button>

      {/* 共享进度条 */}
      <div className="card py-3 px-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl px-3 py-1.5 border border-orange-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow">
              {level}
            </div>
            <div>
              <p className="text-xs font-semibold text-orange-700">{levelName}</p>
              <div className="w-24 h-1.5 bg-orange-200 rounded-full mt-0.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-500"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Flame size={16} className="text-orange-500" />
            <span className="font-semibold">{streakDays}</span>
            <span className="text-gray-400">天连胜</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-600 ml-auto">
            <Trophy size={16} className="text-yellow-500" />
            <span className="font-semibold text-primary-600">{progressStore.todayScore}</span>
            <span className="text-gray-400">今日得分</span>
          </div>
        </div>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
          <Brain className="w-8 h-8 text-[#00FF9C]" />
          LexiVerse 训练舱
        </h1>
        <p className="text-gray-400 mt-2">选择训练模式 · 每次60秒 · 碎片时间高效学习</p>
        <LexiVerseStatsBar />
        {isDailyChallenge(getDailyChallengeGame()) && (
          <div className="flex items-center justify-center gap-1.5 mt-4">
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl px-3 py-1.5 border border-purple-500/20">
              <Sparkles size={16} className="text-purple-400" />
              <span className="text-xs font-medium text-purple-400">
                每日挑战：{GAMES.find(g => g.key === getDailyChallengeGame())?.label}
                <span className="text-purple-500/70 ml-1">(双倍XP)</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="card py-3 px-5">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-400">总游戏数</p>
            <p className="text-lg font-bold text-gray-900">{stats.gamesPlayed}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">总分</p>
            <p className="text-lg font-bold text-primary-600">{stats.totalScore}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">今日得分</p>
            <p className="text-lg font-bold text-green-600">{stats.todayScore}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">最高分</p>
            <p className="text-lg font-bold text-yellow-600">{stats.highestScore}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">连胜</p>
            <p className="text-lg font-bold text-orange-600 flex items-center justify-center gap-0.5">
              <Flame size={16} />{streakDays}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">等级</p>
            <p className="text-lg font-bold text-purple-600 flex items-center justify-center gap-0.5">
              <Star size={16} />Lv.{level}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {GAMES.map(({ key, label, icon: Icon, desc, isPremium }) => (
          <button
            key={key}
            onClick={() => setActiveGame(key)}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-left relative ${
              activeGame === key
                ? 'border-primary-400 bg-primary-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              activeGame === key ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'
            }`}>
              <Icon size={22} />
            </div>
            <span className={`text-sm font-semibold ${activeGame === key ? 'text-primary-700' : 'text-gray-700'}`}>
              {label}
              {isDailyChallenge(key) && (
                <span className="ml-1 text-yellow-500"><Sparkles size={12} className="inline" /></span>
              )}
            </span>
            <span className="text-xs text-gray-400 leading-tight">{desc}</span>
            {isPremium && (
              <span className="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Star size={10} />VIP
              </span>
            )}
          </button>
        ))}
      </div>

      {activeGame === 'word_match' && (
        <GameWithInstructions gameKey="word_match" instructions={WORD_MATCH_INSTRUCTIONS} accentColor="#48DBFB">
          <WordMatchGame userId={userId} onScoreSubmit={handleScoreSubmit} triggerConfetti={triggerConfetti} />
        </GameWithInstructions>
      )}
      {activeGame === 'speed_challenge' && (
        <GameWithInstructions gameKey="speed_challenge" instructions={SPEED_CHALLENGE_INSTRUCTIONS} accentColor="#FECA57">
          <SpeedChallengeGame userId={userId} onScoreSubmit={handleScoreSubmit} triggerConfetti={triggerConfetti} />
        </GameWithInstructions>
      )}
      {activeGame === 'word_puzzle' && (
        <GameWithInstructions gameKey="word_puzzle" instructions={WORD_PUZZLE_INSTRUCTIONS} accentColor="#54A0FF">
          <WordPuzzleGame userId={userId} onScoreSubmit={handleScoreSubmit} triggerConfetti={triggerConfetti} />
        </GameWithInstructions>
      )}
      {activeGame === 'memory_flip' && (
        <GameWithInstructions gameKey="memory_flip" instructions={MEMORY_FLIP_INSTRUCTIONS} accentColor="#A29BFE">
          <MemoryFlipGame userId={userId} onScoreSubmit={handleScoreSubmit} triggerConfetti={triggerConfetti} />
        </GameWithInstructions>
      )}
      {activeGame === 'word_search' && (
        <GameWithInstructions gameKey="word_search" instructions={WORD_SEARCH_INSTRUCTIONS} accentColor="#1DD1A1">
          <WordSearchGame userId={userId} onScoreSubmit={handleScoreSubmit} triggerConfetti={triggerConfetti} />
        </GameWithInstructions>
      )}
      {activeGame === 'hangman' && (
        <GameWithInstructions gameKey="hangman" instructions={HANGMAN_INSTRUCTIONS} accentColor="#FF6B6B">
          <HangmanGame userId={userId} onScoreSubmit={handleScoreSubmit} triggerConfetti={triggerConfetti} />
        </GameWithInstructions>
      )}

      {activeGame === 'lexicon_defense' && (
        isPremiumGame(activeGame) && tier === 'free' ? (
          <PremiumGate />
        ) : (
          <GameWithInstructions gameKey="lexicon_defense" instructions={LEXICON_DEFENSE_INSTRUCTIONS} accentColor="#FF6B6B">
            <LexiconDefenseGame onScoreSubmit={handleScoreSubmit} />
          </GameWithInstructions>
        )
      )}
    </div>
  );
}

function GameWithInstructions({ children, gameKey, instructions, accentColor }: { children: React.ReactNode; gameKey: string; instructions: import('../components/games/GameInstructions').GameInstruction; accentColor: string }) {
  return (
    <div className='space-y-2'>
      <div className='flex justify-end'>
        <GameInstructions instructions={instructions} gameName={gameKey} accentColor={accentColor} />
      </div>
      {children}
    </div>
  );
}

function PremiumGate() {
  const navigate = useNavigate();
  return (
    <div className="card text-center py-12 space-y-4 bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200 relative overflow-hidden">
      <div className="absolute inset-0 bg-black/5 backdrop-blur-sm" />
      <div className="relative z-10 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
          <Star size={32} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">该游戏需要VIP会员</h3>
          <p className="text-sm text-gray-500 mt-1">升级会员即可解锁全部高级游戏</p>
        </div>
        <button
          onClick={() => navigate('/membership')}
          className="px-6 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-bold rounded-xl hover:from-yellow-500 hover:to-amber-600 transition-all shadow-md"
        >
          <Star size={16} className="inline mr-1.5" />
          立即升级
        </button>
      </div>
    </div>
  );
}

function WordMatchGame({ userId, onScoreSubmit, triggerConfetti }: { userId: number | null; onScoreSubmit: (score: number, gameType: string, extraParams?: { combo?: number; mistakes?: number; timeSpent?: number }) => void; triggerConfetti: () => void }) {
  const [words, setWords] = useState<GameWord[]>([]);
  const [leftWords, setLeftWords] = useState<GameWord[]>([]);
  const [rightWords, setRightWords] = useState<GameWord[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const initGame = useCallback(async () => {
    setLoading(true);
    setMatched(new Set());
    setSelectedLeft(null);
    setSelectedRight(null);
    setFeedback(null);
    setScore(0);
    setMistakes(0);
    setCombo(0);
    setFinished(false);
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const res = await fetch('/api/english-games/words-pool?category=考研英语&limit=12');
      const data = await res.json();
      const allWords: GameWord[] = data.words || [];
      setWords(allWords);
      setLeftWords(shuffleArray(allWords.slice(0, 6)));
      setRightWords(shuffleArray(allWords.slice(0, 6).map(w => ({ ...w }))));
      setStartTime(Date.now());
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } catch {
      toast.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initGame();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [initGame]);

  useEffect(() => {
    if (matched.size === 6 && !finished) {
      setFinished(true);
      if (timerRef.current) clearInterval(timerRef.current);
      const finalScore = Math.max(0, 60 - mistakes * 2 + combo * 3);
      setScore(finalScore);
      if (mistakes === 0) triggerConfetti();
      onScoreSubmit(finalScore, 'word_match', { combo, mistakes, timeSpent: elapsed });
    }
  }, [matched.size, finished, mistakes, combo, elapsed, onScoreSubmit, triggerConfetti]);

  const handleLeftClick = (wordId: number) => {
    if (matched.has(wordId) || finished) return;
    setSelectedLeft(wordId);
    setFeedback(null);
  };

  const handleRightClick = (wordId: number) => {
    if (matched.has(wordId) || finished || selectedLeft === null) return;
    setSelectedRight(wordId);

    if (selectedLeft === wordId) {
      setCombo(prev => prev + 1);
      setFeedback({ correct: true, message: combo + 1 >= 5 ? `🔥 连对x${combo + 1}!` : '✓ 正确！' });
      setTimeout(() => {
        setMatched(prev => new Set([...prev, wordId]));
        setSelectedLeft(null);
        setSelectedRight(null);
        setFeedback(null);
      }, 800);
    } else {
      setCombo(0);
      setFeedback({ correct: false, message: '✗ 再试试' });
      setMistakes(prev => prev + 1);
      setTimeout(() => {
        setSelectedLeft(null);
        setSelectedRight(null);
        setFeedback(null);
      }, 800);
    }
  };

  if (loading) {
    return (
      <div className="card text-center py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="card text-center py-12 space-y-6">
        <ConfettiEffect active={mistakes === 0} />
        <div className="text-6xl animate-bounce">🎉</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">配对完成！</h2>
          <p className="text-gray-500 mt-2">你成功匹配了所有单词</p>
          {combo >= 5 && <p className="text-orange-500 font-semibold mt-1">最高连击: {combo}</p>}
        </div>
        <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
          <div className="bg-primary-50 rounded-xl p-3">
            <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-primary-600">{score}</p>
            <p className="text-xs text-gray-500">得分</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <Clock className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-blue-600">{formatTime(elapsed)}</p>
            <p className="text-xs text-gray-500">用时</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3">
            <Target className="w-5 h-5 text-orange-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-orange-600">{mistakes}</p>
            <p className="text-xs text-gray-500">错误</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3">
            <Flame className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-purple-600">{combo}</p>
            <p className="text-xs text-gray-500">连击</p>
          </div>
        </div>
        <button onClick={initGame} className="btn-primary">
          <RotateCcw size={16} className="mr-1" />
          再来一局
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            得分：<span className="text-primary-600 font-bold">{Math.max(0, matched.size * 10 - mistakes * 2 + combo * 3)}</span>
          </span>
          <span className="text-sm text-gray-500">用时：{formatTime(elapsed)}</span>
          {combo > 0 && (
            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
              连对x{combo}
            </span>
          )}
        </div>
        <span className="text-sm text-gray-400">已匹配 {matched.size}/6</span>
      </div>

      {feedback && (
        <div className={`text-center py-2 rounded-lg font-medium animate-fade-in ${feedback.correct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500 mb-2">英文单词</p>
          {leftWords.map((w) => (
            <button
              key={w.id}
              onClick={() => handleLeftClick(w.id)}
              disabled={matched.has(w.id)}
              className={`w-full p-3 rounded-xl text-left font-semibold text-lg transition-all duration-300 ${
                matched.has(w.id)
                  ? 'bg-green-100 text-green-600 opacity-0 scale-95 pointer-events-none'
                  : selectedLeft === w.id
                    ? feedback && !feedback.correct
                      ? 'bg-red-100 text-red-700 border-2 border-red-300 animate-pulse'
                      : 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                    : 'bg-white border border-gray-200 hover:border-primary-300 hover:bg-primary-50/50'
              }`}
            >
              {w.word}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500 mb-2">中文释义</p>
          {rightWords.map((w) => (
            <button
              key={w.id}
              onClick={() => handleRightClick(w.id)}
              disabled={matched.has(w.id) || selectedLeft === null}
              className={`w-full p-3 rounded-xl text-left text-lg transition-all duration-300 ${
                matched.has(w.id)
                  ? 'bg-green-100 text-green-600 opacity-0 scale-95 pointer-events-none'
                  : selectedRight === w.id
                    ? feedback && !feedback.correct
                      ? 'bg-red-100 text-red-700 border-2 border-red-300 animate-pulse'
                      : 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                    : selectedLeft === null
                      ? 'bg-white border border-gray-200'
                      : 'bg-white border border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 cursor-pointer'
              }`}
            >
              {w.definition}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SpeedChallengeGame({ userId, onScoreSubmit, triggerConfetti }: { userId: number | null; onScoreSubmit: (score: number, gameType: string, extraParams?: { combo?: number; mistakes?: number; timeSpent?: number }) => void; triggerConfetti: () => void }) {
  const [words, setWords] = useState<GameWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'wrong' | null; show: boolean; correctAnswer?: string }>({ type: null, show: false });
  const [shakeInput, setShakeInput] = useState(false);
  const [flyScore, setFlyScore] = useState<{ show: boolean; value: number }>({ show: false, value: 0 });
  const [comboText, setComboText] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initGame = useCallback(async () => {
    setLoading(true);
    setCurrentIndex(0);
    setInput('');
    setScore(0);
    setCorrectCount(0);
    setCombo(0);
    setTimeLeft(30);
    setFinished(false);
    setFeedback({ type: null, show: false });
    setComboText(null);
    if (timerRef.current) clearInterval(timerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    try {
      const res = await fetch('/api/english-games/words-pool?category=考研英语&limit=20');
      const data = await res.json();
      setWords(data.words || []);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      toast.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [initGame]);

  useEffect(() => {
    if (timeLeft === 0 && !finished) {
      setFinished(true);
      const isPerfect = correctCount === currentIndex && currentIndex > 0;
      if (isPerfect) triggerConfetti();
      onScoreSubmit(score, 'speed_challenge', { combo, mistakes: currentIndex - correctCount, timeSpent: 30 });
    }
  }, [timeLeft, finished, score, onScoreSubmit, triggerConfetti, currentIndex, correctCount, combo]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [currentIndex]);

  const currentWord = words[currentIndex];

  const handleSubmit = () => {
    if (!currentWord || finished || feedback.show) return;
    const trimmed = input.trim().toLowerCase();
    const correct = trimmed === currentWord.word.toLowerCase();

    if (correct) {
      const newCombo = combo + 1;
      const baseScore = 10;
      const comboBonus = newCombo % 5 === 0 ? 5 : 0;
      const totalAdd = baseScore + comboBonus;
      setScore(prev => prev + totalAdd);
      setCorrectCount(prev => prev + 1);
      setCombo(newCombo);
      setFeedback({ type: 'correct', show: true });
      setFlyScore({ show: true, value: totalAdd });
      if (newCombo === 5) setComboText('🔥 连击x5!');
      else if (newCombo === 10) setComboText('⚡ 连击x10!');
      else if (newCombo === 15) setComboText('💥 连击x15!');
      else setComboText(null);
      setTimeout(() => setFlyScore({ show: false, value: 0 }), 1000);
      setTimeout(() => setComboText(null), 2000);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedback({ type: null, show: false });
        setInput('');
        if (currentIndex + 1 < words.length) {
          setCurrentIndex(prev => prev + 1);
        }
      }, 600);
    } else {
      setCombo(0);
      setComboText(null);
      setShakeInput(true);
      setTimeout(() => setShakeInput(false), 500);
      setFeedback({ type: 'wrong', show: true, correctAnswer: currentWord.word });
      feedbackTimerRef.current = setTimeout(() => {
        setFeedback({ type: null, show: false });
        setInput('');
        if (currentIndex + 1 < words.length) {
          setCurrentIndex(prev => prev + 1);
        }
      }, 1500);
    }
  };

  const handleSkip = () => {
    if (finished || feedback.show) return;
    if (currentIndex + 1 < words.length) {
      setCurrentIndex(prev => prev + 1);
      setInput('');
    }
  };

  const progressColor = timeLeft > 15 ? 'bg-green-500' : timeLeft > 8 ? 'bg-yellow-500' : 'bg-red-500';

  if (loading) {
    return (
      <div className="card text-center py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (finished) {
    const totalAttempted = currentIndex;
    const mistakes = totalAttempted - correctCount;
    const accuracy = totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0;
    const isPerfect = mistakes === 0 && totalAttempted > 0;
    return (
      <div className="card text-center py-12 space-y-6">
        <ConfettiEffect active={isPerfect} />
        <div className="text-6xl animate-bounce">⏰</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">时间到！</h2>
          <p className="text-gray-500 mt-2">挑战结束</p>
          {combo >= 5 && <p className="text-orange-500 font-semibold mt-1">最高连击: {combo}</p>}
        </div>
        <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
          <div className="bg-primary-50 rounded-xl p-3">
            <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-primary-600">{score}</p>
            <p className="text-xs text-gray-500">总分</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <Check className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-600">{correctCount}</p>
            <p className="text-xs text-gray-500">正确</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <Target className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-blue-600">{accuracy}%</p>
            <p className="text-xs text-gray-500">正确率</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3">
            <Flame className="w-5 h-5 text-purple-500 mx-auto mb-1" />
            <p className="text-xl font-bold text-purple-600">{combo}</p>
            <p className="text-xs text-gray-500">连击</p>
          </div>
        </div>
        <button onClick={initGame} className="btn-primary">
          <RotateCcw size={16} className="mr-1" />
          再来一局
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            得分：<span className="text-primary-600 font-bold">{score}</span>
          </span>
          <span className="text-sm text-gray-500">连对：{combo}</span>
        </div>
        <div className="flex items-center gap-2">
          <Timer size={16} className={timeLeft <= 8 ? 'text-red-500' : 'text-gray-400'} />
          <span className={`text-lg font-bold ${timeLeft <= 8 ? 'text-red-500 animate-pulse' : 'text-gray-700'}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${progressColor}`}
          style={{ width: `${(timeLeft / 30) * 100}%` }}
        />
      </div>

      {comboText && (
        <div className="text-center text-xl font-bold text-orange-500 animate-bounce">
          {comboText}
        </div>
      )}

      {currentWord && (
        <div className="card text-center space-y-6 relative">
          <div className="text-sm text-gray-500">
            第 {currentIndex + 1} / {words.length} 题
          </div>

          <div>
            <p className="text-2xl font-bold text-gray-900 mb-2">{currentWord.definition}</p>
            {currentWord.partOfSpeech && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {currentWord.partOfSpeech}
              </span>
            )}
          </div>

          {flyScore.show && (
            <div className="absolute top-8 right-8 text-primary-600 font-bold text-xl animate-slide-up">
              +{flyScore.value}
            </div>
          )}

          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="输入英文单词..."
              className={`input-field flex-1 text-lg text-center ${shakeInput ? 'animate-pulse' : ''}`}
              disabled={feedback.show}
              autoComplete="off"
            />
            <button onClick={handleSubmit} disabled={feedback.show || !input.trim()} className="btn-primary">
              确认
            </button>
            <button onClick={handleSkip} disabled={feedback.show} className="btn-secondary">
              <SkipForward size={16} />
            </button>
          </div>

          {feedback.type === 'correct' && feedback.show && (
            <div className="text-green-600 font-medium animate-fade-in">✓ 正确！</div>
          )}
          {feedback.type === 'wrong' && feedback.show && (
            <div className="text-red-600 font-medium animate-fade-in">
              正确答案：<span className="font-bold">{feedback.correctAnswer}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WordPuzzleGame({ userId, onScoreSubmit, triggerConfetti }: { userId: number | null; onScoreSubmit: (score: number, gameType: string, extraParams?: { combo?: number; mistakes?: number; timeSpent?: number }) => void; triggerConfetti: () => void }) {
  const [words, setWords] = useState<GameWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(3);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'wrong' | 'hint' | null; show: boolean; message?: string }>({ type: null, show: false });
  const [showExample, setShowExample] = useState(false);
  const [showPerfect, setShowPerfect] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const TOTAL_QUESTIONS = 10;

  const initGame = useCallback(async () => {
    setLoading(true);
    setCurrentIndex(0);
    setInput('');
    setScore(0);
    setAttempts(3);
    setCorrectCount(0);
    setFinished(false);
    setFeedback({ type: null, show: false });
    setShowExample(false);
    setShowPerfect(false);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    try {
      const res = await fetch('/api/english-games/words-pool?category=考研英语&limit=15');
      const data = await res.json();
      setWords((data.words || []).slice(0, TOTAL_QUESTIONS));
    } catch {
      toast.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initGame();
    return () => { if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current); };
  }, [initGame]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [currentIndex, attempts]);

  const currentWord = words[currentIndex];

  const getRating = (s: number): { grade: string; color: string } => {
    if (s >= 130) return { grade: 'S', color: 'text-yellow-500' };
    if (s >= 100) return { grade: 'A', color: 'text-green-500' };
    if (s >= 70) return { grade: 'B', color: 'text-blue-500' };
    return { grade: 'C', color: 'text-gray-500' };
  };

  const handleSubmit = () => {
    if (!currentWord || finished || feedback.show) return;
    const trimmed = input.trim().toLowerCase();
    const correct = trimmed === currentWord.word.toLowerCase();

    if (correct) {
      const newScore = score + 15;
      const newCorrect = correctCount + 1;
      setScore(newScore);
      setCorrectCount(newCorrect);
      setFeedback({ type: 'correct', show: true });
      feedbackTimerRef.current = setTimeout(() => {
        setFeedback({ type: null, show: false });
        setInput('');
        setAttempts(3);
        setShowExample(false);
        if (currentIndex + 1 < TOTAL_QUESTIONS) {
          setCurrentIndex(prev => prev + 1);
        } else {
          setFinished(true);
          const finalScore = newScore;
          const rating = getRating(finalScore);
          if (rating.grade === 'S') {
            setShowPerfect(true);
            triggerConfetti();
          }
          onScoreSubmit(finalScore, 'word_puzzle', { mistakes: TOTAL_QUESTIONS - newCorrect, timeSpent: 0 });
        }
      }, 1000);
    } else {
      const newAttempts = attempts - 1;
      setAttempts(newAttempts);
      if (newAttempts <= 0) {
        setFeedback({ type: 'wrong', show: true, message: currentWord.word });
        feedbackTimerRef.current = setTimeout(() => {
          setFeedback({ type: null, show: false });
          setInput('');
          setAttempts(3);
          setShowExample(false);
          if (currentIndex + 1 < TOTAL_QUESTIONS) {
            setCurrentIndex(prev => prev + 1);
          } else {
            setFinished(true);
            onScoreSubmit(score, 'word_puzzle', { mistakes: TOTAL_QUESTIONS - correctCount, timeSpent: 0 });
          }
        }, 1500);
      } else {
        setFeedback({ type: 'wrong', show: true });
        setTimeout(() => setFeedback({ type: null, show: false }), 800);
      }
    }
  };

  const handleHint = () => {
    if (attempts <= 1 || feedback.show) return;
    setShowExample(true);
    setAttempts(prev => prev - 1);
    setFeedback({ type: 'hint', show: true });
    setTimeout(() => setFeedback({ type: null, show: false }), 1500);
  };

  if (loading) {
    return (
      <div className="card text-center py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (finished) {
    const rating = getRating(score);
    const accuracy = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
    return (
      <div className="card text-center py-12 space-y-6">
        <ConfettiEffect active={showPerfect} />
        {showPerfect && (
          <div className="text-6xl font-bold text-yellow-500 animate-bounce drop-shadow-lg">
            完美!
          </div>
        )}
        <div className="text-6xl animate-bounce">
          {rating.grade === 'S' ? '🏆' : rating.grade === 'A' ? '🌟' : rating.grade === 'B' ? '👍' : '📚'}
        </div>
        <div>
          <div className={`text-5xl font-bold ${rating.color} mb-2`}>{rating.grade}</div>
          <h2 className="text-2xl font-bold text-gray-900">拼图完成！</h2>
          <p className="text-gray-500 mt-2">
            {rating.grade === 'S' ? '完美表现！' : rating.grade === 'A' ? '非常出色！' : rating.grade === 'B' ? '继续加油！' : '多多练习！'}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
          <div className="bg-primary-50 rounded-xl p-4">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-primary-600">{score}</p>
            <p className="text-xs text-gray-500">总分</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <Check className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{correctCount}/{TOTAL_QUESTIONS}</p>
            <p className="text-xs text-gray-500">正确</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <Target className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-600">{accuracy}%</p>
            <p className="text-xs text-gray-500">正确率</p>
          </div>
        </div>
        <button onClick={initGame} className="btn-primary">
          <RotateCcw size={16} className="mr-1" />
          再来一局
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            得分：<span className="text-primary-600 font-bold">{score}</span>
          </span>
          <span className="text-sm text-gray-500">正确：{correctCount}</span>
        </div>
        <span className="text-sm text-gray-400">第 {currentIndex + 1}/{TOTAL_QUESTIONS} 题</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary-500 transition-all duration-500"
          style={{ width: `${((currentIndex + 1) / TOTAL_QUESTIONS) * 100}%` }}
        />
      </div>

      {currentWord && (
        <div className="card text-center space-y-6">
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all ${i <= attempts ? 'bg-primary-400' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          <div>
            <p className="text-2xl font-bold text-gray-900 mb-2">{currentWord.definition}</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-gray-400">首字母：</span>
              <span className="text-lg font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-lg">
                {currentWord.word.charAt(0).toUpperCase()}
              </span>
              <span className="text-gray-300">{' _ '.repeat(currentWord.word.length - 1)}</span>
              <span className="text-xs text-gray-400">({currentWord.word.length}个字母)</span>
            </div>
          </div>

          {showExample && currentWord.exampleSentence && (
            <div className="bg-blue-50 rounded-xl p-4 animate-fade-in">
              <Lightbulb size={16} className="text-blue-500 inline-block mr-1" />
              <span className="text-sm text-blue-700 italic">{currentWord.exampleSentence}</span>
            </div>
          )}

          {feedback.type === 'hint' && feedback.show && (
            <div className="text-blue-600 text-sm font-medium animate-fade-in">已使用提示（消耗1次尝试机会）</div>
          )}
          {feedback.type === 'correct' && feedback.show && (
            <div className="flex items-center justify-center gap-2 text-green-600 font-medium animate-fade-in">
              <Check size={20} className="text-green-500" /> 正确！
            </div>
          )}
          {feedback.type === 'wrong' && feedback.show && feedback.message && (
            <div className="text-red-600 font-medium animate-fade-in">
              正确答案：<span className="font-bold">{feedback.message}</span>
            </div>
          )}
          {feedback.type === 'wrong' && feedback.show && !feedback.message && (
            <div className="text-red-600 font-medium animate-fade-in">再试一次！</div>
          )}

          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="输入完整英文单词..."
              className={`input-field flex-1 text-lg text-center ${feedback.type === 'wrong' && feedback.show && !feedback.message ? 'animate-pulse' : ''}`}
              disabled={feedback.type === 'correct' || (feedback.type === 'wrong' && !!feedback.message)}
              autoComplete="off"
            />
            <button onClick={handleSubmit} disabled={feedback.show || !input.trim()} className="btn-primary">
              确认
            </button>
            <button
              onClick={handleHint}
              disabled={attempts <= 1 || feedback.show || showExample}
              className="btn-secondary"
              title="使用提示（消耗1次尝试机会）"
            >
              <Lightbulb size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CardData {
  id: number;
  pairId: number;
  type: 'word' | 'definition';
  content: string;
}

function MemoryFlipGame({ userId, onScoreSubmit, triggerConfetti }: { userId: number | null; onScoreSubmit: (score: number, gameType: string, extraParams?: { mistakes?: number; timeSpent?: number }) => void; triggerConfetti: () => void }) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pulsePair, setPulsePair] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockRef = useRef(false);

  const initGame = useCallback(async () => {
    setLoading(true);
    setFlipped(new Set());
    setMatched(new Set());
    setSelected([]);
    setScore(0);
    setMistakes(0);
    setElapsed(0);
    setFinished(false);
    setPulsePair(null);
    lockRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const res = await fetch('/api/english-games/words-pool?category=考研英语&limit=8');
      const data = await res.json();
      const words: GameWord[] = (data.words || []).slice(0, 8);
      const cardList: CardData[] = [];
      words.forEach((w, idx) => {
        cardList.push({ id: idx * 2, pairId: idx, type: 'word', content: w.word });
        cardList.push({ id: idx * 2 + 1, pairId: idx, type: 'definition', content: w.definition });
      });
      setCards(shuffleArray(cardList));
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } catch {
      toast.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initGame();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [initGame]);

  useEffect(() => {
    if (matched.size === cards.length && cards.length > 0 && !finished) {
      setFinished(true);
      if (timerRef.current) clearInterval(timerRef.current);
      triggerConfetti();
      onScoreSubmit(score, 'memory_flip', { mistakes, timeSpent: elapsed });
    }
  }, [matched.size, cards.length, finished, score, mistakes, elapsed, onScoreSubmit, triggerConfetti]);

  const handleCardClick = (cardIndex: number) => {
    if (lockRef.current || finished || matched.has(cardIndex) || flipped.has(cardIndex) || selected.includes(cardIndex)) return;

    const newSelected = [...selected, cardIndex];
    setSelected(newSelected);
    setFlipped(prev => new Set([...prev, cardIndex]));

    if (newSelected.length === 2) {
      lockRef.current = true;
      const [first, second] = newSelected;
      const cardA = cards[first];
      const cardB = cards[second];

      if (cardA.pairId === cardB.pairId && cardA.type !== cardB.type) {
        setScore(prev => prev + 10);
        setPulsePair(cardA.pairId);
        setTimeout(() => {
          setMatched(prev => new Set([...prev, first, second]));
          setSelected([]);
          setPulsePair(null);
          lockRef.current = false;
        }, 600);
      } else {
        setMistakes(prev => prev + 1);
        setScore(prev => Math.max(0, prev - 1));
        setTimeout(() => {
          setFlipped(prev => {
            const next = new Set(prev);
            next.delete(first);
            next.delete(second);
            return next;
          });
          setSelected([]);
          lockRef.current = false;
        }, 1000);
      }
    }
  };

  if (loading) {
    return (
      <div className="card text-center py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="card text-center py-12 space-y-6">
        <ConfettiEffect active={true} />
        <div className="text-6xl animate-bounce">🧠</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">全部配对完成！</h2>
          <p className="text-gray-500 mt-2">记忆力真棒！</p>
        </div>
        <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
          <div className="bg-primary-50 rounded-xl p-4">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-primary-600">{score}</p>
            <p className="text-xs text-gray-500">得分</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-600">{formatTime(elapsed)}</p>
            <p className="text-xs text-gray-500">用时</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-4">
            <Target className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-orange-600">{mistakes}</p>
            <p className="text-xs text-gray-500">错误</p>
          </div>
        </div>
        <button onClick={initGame} className="btn-primary">
          <RotateCcw size={16} className="mr-1" />
          再来一局
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            得分：<span className="text-primary-600 font-bold">{score}</span>
          </span>
          <span className="text-sm text-gray-500">用时：{formatTime(elapsed)}</span>
        </div>
        <span className="text-sm text-gray-400">已配对 {matched.size / 2}/8</span>
      </div>

      <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto">
        {cards.map((card, index) => {
          const isFlipped = flipped.has(index) || matched.has(index);
          const isMatched = matched.has(index);
          const isPulse = pulsePair === card.pairId && isMatched;

          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(index)}
              disabled={isMatched || lockRef.current}
              className={`aspect-square rounded-xl text-center transition-all duration-500 select-none ${
                isPulse ? 'animate-pulse' : ''
              }`}
              style={{
                perspective: '1000px',
              }}
            >
              <div
                className="relative w-full h-full"
                style={{
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.5s',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                <div
                  className="absolute inset-0 rounded-xl flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <span className="text-3xl font-bold text-gray-400">?</span>
                </div>
                <div
                  className={`absolute inset-0 rounded-xl flex items-center justify-center p-1 border-2 ${
                    isMatched
                      ? 'bg-green-100 border-green-300'
                      : 'bg-white border-primary-300'
                  }`}
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <span className={`text-center leading-tight ${
                    card.type === 'word'
                      ? 'text-sm font-bold text-primary-700'
                      : 'text-xs text-gray-600'
                  }`}>
                    {card.content}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WordSearchGame({ userId, onScoreSubmit, triggerConfetti }: { userId: number | null; onScoreSubmit: (score: number, gameType: string, extraParams?: { mistakes?: number; timeSpent?: number }) => void; triggerConfetti: () => void }) {
  const [grid, setGrid] = useState<string[][]>([]);
  const [words, setWords] = useState<GameWord[]>([]);
  const [wordPositions, setWordPositions] = useState<Map<string, { start: [number, number]; end: [number, number] }>>(new Map());
  const [found, setFound] = useState<Set<string>>(new Set());
  const [selectStart, setSelectStart] = useState<[number, number] | null>(null);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(3);
  const [hintWord, setHintWord] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [glowWord, setGlowWord] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1],
  ];

  const generateGrid = useCallback((wordList: GameWord[]) => {
    const size = 10;
    const gridArr: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
    const posMap = new Map<string, { start: [number, number]; end: [number, number] }>();

    for (const w of wordList) {
      const word = w.word.toUpperCase();
      let placed = false;
      const attempts = 50;
      for (let a = 0; a < attempts && !placed; a++) {
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const [dr, dc] = dir;
        const row = Math.floor(Math.random() * size);
        const col = Math.floor(Math.random() * size);
        const endRow = row + dr * (word.length - 1);
        const endCol = col + dc * (word.length - 1);

        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

        let canPlace = true;
        for (let i = 0; i < word.length; i++) {
          const r = row + dr * i;
          const c = col + dc * i;
          if (gridArr[r][c] !== '' && gridArr[r][c] !== word[i]) {
            canPlace = false;
            break;
          }
        }

        if (canPlace) {
          for (let i = 0; i < word.length; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            gridArr[r][c] = word[i];
          }
          posMap.set(w.word, { start: [row, col], end: [endRow, endCol] });
          placed = true;
        }
      }
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (gridArr[r][c] === '') {
          gridArr[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        }
      }
    }

    return { gridArr, posMap };
  }, []);

  const initGame = useCallback(async () => {
    setLoading(true);
    setFound(new Set());
    setSelectStart(null);
    setScore(0);
    setMistakes(0);
    setHints(3);
    setHintWord(null);
    setFinished(false);
    setElapsed(0);
    setGlowWord(null);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const res = await fetch('/api/english-games/words-pool?category=考研英语&limit=10');
      const data = await res.json();
      const wordList: GameWord[] = (data.words || []).slice(0, 10);
      setWords(wordList);
      const { gridArr, posMap } = generateGrid(wordList);
      setGrid(gridArr);
      setWordPositions(posMap);
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } catch {
      toast.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  }, [generateGrid]);

  useEffect(() => {
    initGame();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [initGame]);

  useEffect(() => {
    if (words.length > 0 && found.size === words.length && !finished) {
      setFinished(true);
      if (timerRef.current) clearInterval(timerRef.current);
      triggerConfetti();
      onScoreSubmit(score, 'word_search', { mistakes, timeSpent: elapsed });
    }
  }, [found.size, words.length, finished, score, mistakes, elapsed, onScoreSubmit, triggerConfetti]);

  const handleCellClick = (row: number, col: number) => {
    if (finished) return;

    if (!selectStart) {
      setSelectStart([row, col]);
      setHintWord(null);
      return;
    }

    const [sr, sc] = selectStart;
    setSelectStart(null);

    if (sr === row && sc === col) {
      setMistakes(prev => prev + 1);
      setScore(prev => Math.max(0, prev - 5));
      return;
    }

    const dr = Math.sign(row - sr);
    const dc = Math.sign(col - sc);

    const isStraightLine = (dr === 0) !== (dc === 0);
    const isDiagonal = dr !== 0 && dc !== 0 && Math.abs(row - sr) === Math.abs(col - sc);
    if (!isStraightLine && !isDiagonal) {
      setMistakes(prev => prev + 1);
      setScore(prev => Math.max(0, prev - 5));
      return;
    }

    const selectedLetters: string[] = [];
    const cells: [number, number][] = [];
    let r = sr, c = sc;
    while (true) {
      if (r < 0 || r >= 10 || c < 0 || c >= 10) break;
      cells.push([r, c]);
      selectedLetters.push(grid[r][c]);
      if (r === row && c === col) break;
      r += dr;
      c += dc;
    }

    if (cells.length === 0) return;
    const selectedWord = selectedLetters.join('');
    const reversedWord = [...selectedLetters].reverse().join('');

    let matchedWord: string | null = null;
    for (const w of words) {
      const upperW = w.word.toUpperCase();
      if (!found.has(w.word) && (selectedWord === upperW || reversedWord === upperW)) {
        matchedWord = w.word;
        break;
      }
    }

    if (matchedWord) {
      setFound(prev => new Set([...prev, matchedWord!]));
      setScore(prev => prev + 15);
      setGlowWord(matchedWord);
      setTimeout(() => setGlowWord(null), 1000);
    } else {
      setMistakes(prev => prev + 1);
      setScore(prev => Math.max(0, prev - 5));
    }
  };

  const handleHint = () => {
    if (hints <= 0 || finished) return;
    const unfound = words.filter(w => !found.has(w.word));
    if (unfound.length === 0) return;
    const word = unfound[Math.floor(Math.random() * unfound.length)];
    setHintWord(word.word);
    setHints(prev => prev - 1);
    setScore(prev => Math.max(0, prev - 10));
    setTimeout(() => setHintWord(null), 3000);
  };

  const getHighlightedCells = (): Set<string> => {
    const cells = new Set<string>();
    if (hintWord) {
      const pos = wordPositions.get(hintWord);
      if (pos) {
        const [sr, sc] = pos.start;
        const [er, ec] = pos.end;
        const dr = Math.sign(er - sr);
        const dc = Math.sign(ec - sc);
        let r = sr, c = sc;
        while (true) {
          cells.add(`${r},${c}`);
          if (r === er && c === ec) break;
          r += dr;
          c += dc;
        }
      }
    }
    if (glowWord) {
      const pos = wordPositions.get(glowWord);
      if (pos) {
        const [sr, sc] = pos.start;
        const [er, ec] = pos.end;
        const dr = Math.sign(er - sr);
        const dc = Math.sign(ec - sc);
        let r = sr, c = sc;
        while (true) {
          cells.add(`${r},${c}`);
          if (r === er && c === ec) break;
          r += dr;
          c += dc;
        }
      }
    }
    return cells;
  };

  const highlighted = getHighlightedCells();

  if (loading) {
    return (
      <div className="card text-center py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="card text-center py-12 space-y-6">
        <ConfettiEffect active={true} />
        <div className="text-6xl animate-bounce">🔍</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">全部找到！</h2>
          <p className="text-gray-500 mt-2">你找到了所有单词</p>
        </div>
        <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
          <div className="bg-primary-50 rounded-xl p-4">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-primary-600">{score}</p>
            <p className="text-xs text-gray-500">得分</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-600">{formatTime(elapsed)}</p>
            <p className="text-xs text-gray-500">用时</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-4">
            <Target className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-orange-600">{mistakes}</p>
            <p className="text-xs text-gray-500">错误</p>
          </div>
        </div>
        <button onClick={initGame} className="btn-primary">
          <RotateCcw size={16} className="mr-1" />
          再来一局
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            得分：<span className="text-primary-600 font-bold">{score}</span>
          </span>
          <span className="text-sm text-gray-500">用时：{formatTime(elapsed)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">已找到 {found.size}/{words.length}</span>
          <button
            onClick={handleHint}
            disabled={hints <= 0}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lightbulb size={14} />
            提示({hints})
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="grid grid-cols-10 gap-0.5 bg-gray-200 p-0.5 rounded-xl w-fit mx-auto">
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const isHighlighted = highlighted.has(`${r},${c}`);
              const isStart = selectStart && selectStart[0] === r && selectStart[1] === c;
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => handleCellClick(r, c)}
                  className={`w-9 h-9 flex items-center justify-center text-sm font-bold rounded transition-all duration-300 ${
                    isHighlighted
                      ? 'bg-green-300 text-green-800 shadow-lg shadow-green-300/50'
                      : isStart
                        ? 'bg-primary-200 text-primary-800 ring-2 ring-primary-400'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {cell}
                </button>
              );
            })
          )}
        </div>

        <div className="flex-1 space-y-1.5 min-w-[200px]">
          <p className="text-sm font-medium text-gray-500 mb-2">待找单词</p>
          {words.map((w) => {
            const isFound = found.has(w.word);
            return (
              <div
                key={w.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  isFound ? 'bg-green-50 text-green-600 line-through' : 'bg-gray-50 text-gray-700'
                } ${hintWord === w.word ? 'bg-amber-100 ring-2 ring-amber-400' : ''}`}
              >
                <span className="font-semibold">{w.word}</span>
                <span className="text-xs text-gray-400">- {w.definition}</span>
                {isFound && <Check size={14} className="text-green-500 ml-auto" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HangmanGame({ userId, onScoreSubmit, triggerConfetti }: { userId: number | null; onScoreSubmit: (score: number, gameType: string, extraParams?: { mistakes?: number; timeSpent?: number }) => void; triggerConfetti: () => void }) {
  const [words, setWords] = useState<GameWord[]>([]);
  const [currentWord, setCurrentWord] = useState<GameWord | null>(null);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [lives, setLives] = useState(6);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [bounceLetter, setBounceLetter] = useState<string | null>(null);

  const TOTAL_ROUNDS = 10;
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const initGame = useCallback(async () => {
    setLoading(true);
    setGuessed(new Set());
    setLives(6);
    setScore(0);
    setRound(0);
    setFinished(false);
    setGameOver(false);
    setFeedback(null);
    setBounceLetter(null);
    try {
      const res = await fetch('/api/english-games/words-pool?category=考研英语&limit=' + TOTAL_ROUNDS);
      const data = await res.json();
      const wordList: GameWord[] = data.words || [];
      setWords(wordList);
      if (wordList.length > 0) {
        setCurrentWord(wordList[0]);
      }
    } catch {
      toast.error('加载单词失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const isWordComplete = useCallback(() => {
    if (!currentWord) return false;
    return currentWord.word.toUpperCase().split('').every(letter => guessed.has(letter));
  }, [currentWord, guessed]);

  const handleLetterClick = (letter: string) => {
    if (finished || gameOver || !currentWord || guessed.has(letter)) return;

    const newGuessed = new Set(guessed);
    newGuessed.add(letter);
    setGuessed(newGuessed);

    const upperWord = currentWord.word.toUpperCase();
    if (upperWord.includes(letter)) {
      setScore(prev => prev + 5);
      setFeedback('正确！');
      setBounceLetter(letter);
      setTimeout(() => setBounceLetter(null), 500);
      setTimeout(() => setFeedback(null), 1000);

      const allFound = upperWord.split('').every(l => newGuessed.has(l));
      if (allFound) {
        setScore(prev => prev + 20);
        setFeedback(`🎉 猜对了！+20分`);
        setTimeout(() => {
          advanceRound(newGuessed);
        }, 1000);
      }
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      setFeedback('错误！');
      setTimeout(() => setFeedback(null), 800);

      if (newLives <= 0) {
        setGameOver(true);
        onScoreSubmit(score, 'hangman', { mistakes: 0, timeSpent: 0 });
      }
    }
  };

  const advanceRound = (currentGuessed: Set<string>) => {
    const nextRound = round + 1;
    if (nextRound >= TOTAL_ROUNDS || nextRound >= words.length) {
      setFinished(true);
      const finalScore = score + 20;
      setScore(finalScore);
      const allCorrect = round + 1 === TOTAL_ROUNDS;
      if (allCorrect) triggerConfetti();
      onScoreSubmit(finalScore, 'hangman', { mistakes: 0, timeSpent: 0 });
    } else {
      setRound(nextRound);
      setCurrentWord(words[nextRound]);
      setGuessed(new Set());
      setLives(6);
    }
  };

  if (loading) {
    return (
      <div className="card text-center py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (finished) {
    const allCorrect = gameOver ? false : true;
    return (
      <div className="card text-center py-12 space-y-6">
        <ConfettiEffect active={allCorrect} />
        <div className="text-6xl animate-bounce">{allCorrect ? '🏆' : '💪'}</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {allCorrect ? '全部猜对！' : '挑战结束！'}
          </h2>
          <p className="text-gray-500 mt-2">
            {allCorrect ? '你是真正的猜词大师！' : `完成了 ${round} 轮`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
          <div className="bg-primary-50 rounded-xl p-4">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-primary-600">{score}</p>
            <p className="text-xs text-gray-500">总分</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <Check className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{round}/{TOTAL_ROUNDS}</p>
            <p className="text-xs text-gray-500">轮次</p>
          </div>
        </div>
        <button onClick={initGame} className="btn-primary">
          <RotateCcw size={16} className="mr-1" />
          再来一局
        </button>
      </div>
    );
  }

  if (gameOver && currentWord) {
    return (
      <div className="card text-center py-12 space-y-6">
        <div className="text-6xl animate-bounce">💀</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">游戏结束！</h2>
          <p className="text-gray-500 mt-2">
            正确答案：<span className="font-bold text-primary-600">{currentWord.word}</span>
          </p>
          <p className="text-sm text-gray-400">{currentWord.definition}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
          <div className="bg-primary-50 rounded-xl p-4">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-primary-600">{score}</p>
            <p className="text-xs text-gray-500">总分</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <Check className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{round}/{TOTAL_ROUNDS}</p>
            <p className="text-xs text-gray-500">轮次</p>
          </div>
        </div>
        <button onClick={initGame} className="btn-primary">
          <RotateCcw size={16} className="mr-1" />
          再来一局
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">
            得分：<span className="text-primary-600 font-bold">{score}</span>
          </span>
          <span className="text-sm text-gray-500">第 {round + 1}/{TOTAL_ROUNDS} 轮</span>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="text-lg">{i < lives ? '💚' : '🖤'}</span>
          ))}
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-red-400 transition-all duration-500"
          style={{ width: `${(lives / 6) * 100}%` }}
        />
      </div>

      {currentWord && (
        <div className="card text-center space-y-6">
          <div>
            <p className="text-sm text-gray-500 mb-2">{currentWord.definition}</p>
            {currentWord.partOfSpeech && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {currentWord.partOfSpeech}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {currentWord.word.toUpperCase().split('').map((letter, i) => (
              <span
                key={i}
                className={`w-8 h-10 flex items-center justify-center border-b-2 text-xl font-bold transition-all ${
                  guessed.has(letter)
                    ? bounceLetter === letter
                      ? 'border-primary-400 text-primary-600 animate-bounce'
                      : 'border-primary-400 text-primary-600'
                    : gameOver
                      ? 'border-red-300 text-red-400'
                      : 'border-gray-300 text-transparent'
                }`}
              >
                {guessed.has(letter) || gameOver ? letter : '_'}
              </span>
            ))}
          </div>

          {feedback && (
            <div className={`text-sm font-medium animate-fade-in ${
              feedback.startsWith('🎉') ? 'text-green-600' : feedback === '错误！' ? 'text-red-500' : 'text-green-500'
            }`}>
              {feedback}
            </div>
          )}

          <div className="grid grid-cols-9 gap-1 max-w-md mx-auto">
            {ALPHABET.map((letter) => {
              const isGuessed = guessed.has(letter);
              const isCorrect = currentWord.word.toUpperCase().includes(letter) && isGuessed;
              return (
                <button
                  key={letter}
                  onClick={() => handleLetterClick(letter)}
                  disabled={isGuessed || gameOver}
                  className={`w-9 h-9 text-sm font-semibold rounded-lg transition-all ${
                    isCorrect
                      ? 'bg-green-100 text-green-600 cursor-not-allowed'
                      : isGuessed
                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-primary-50 hover:border-primary-300'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}