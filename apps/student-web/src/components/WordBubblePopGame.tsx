import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { GameQuestion, PowerUpEffect } from '../hooks/useGameSession';

interface WordBubblePopGameProps {
  word: string;             // 目标单词
  meaning?: string;         // 释义提示
  onAnswer: (answer: string) => void;
  submitting: boolean;
  powerUpEffect?: PowerUpEffect | null;
  onClearPowerUpEffect?: () => void;
}

interface Bubble {
  id: number;
  letter: string;
  // 位置(百分比)
  x: number;
  y: number;
  // 飘落速度(每帧 y 增量)
  speed: number;
  // 是否已被点击
  popped: boolean;
  // 是否是目标词的字母
  isTarget: boolean;
}

// 数组随机打乱
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 生成随机字母(避免目标字母)
function randomLetter(exclude: Set<string>): string {
  const all = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const candidates = all.filter((l) => !exclude.has(l));
  if (candidates.length === 0) return 'a';
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * P1-2 改进 (2026-07-21): 字母泡泡拼词特色玩法
 * 对标 Spelling Bee + bubble shooter 类游戏
 *
 * 玩法:
 *   1. 屏幕上方飘落字母泡泡(目标词字母 + 干扰字母)
 *   2. 用户按目标词的字母顺序点击泡泡
 *   3. 点对则消除并显示在拼写区
 *   4. 点错则扣 1 条命(若启用 lives)
 *   5. 拼完整个目标词后自动提交
 *   6. 揭示道具: 显示目标词长度和首字母
 */
export default function WordBubblePopGame({
  word,
  meaning,
  onAnswer,
  submitting,
  powerUpEffect,
  onClearPowerUpEffect,
}: WordBubblePopGameProps) {
  const targetWord = (word || '').toLowerCase();

  // 已点击的字母索引(目标词中的位置)
  const [collected, setCollected] = useState<string[]>([]);
  // 泡泡列表
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  // 错误次数
  const [errors, setErrors] = useState(0);
  // 反馈消息
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  // 动画帧 ID
  const animRef = useRef<number | null>(null);
  // 下一个泡泡 ID
  const bubbleIdRef = useRef(0);

  // 生成一个新泡泡(目标字母 or 干扰字母)
  const spawnBubble = useCallback(() => {
    const targetLetters = targetWord.split('');
    const collectedCount = collected.length;
    // 50% 概率生成下一个目标字母,50% 生成随机字母(包括已收集的目标字母的副本作为干扰)
    const isTarget = Math.random() < 0.5 && collectedCount < targetLetters.length;
    const targetLetterSet = new Set(targetLetters);
    const letter = isTarget
      ? targetLetters[collectedCount]
      : randomLetter(targetLetterSet);

    setBubbles((prev) => [
      ...prev,
      {
        id: bubbleIdRef.current++,
        letter,
        x: 5 + Math.random() * 90,  // 5%~95%
        y: -5,
        speed: 0.3 + Math.random() * 0.4,  // 0.3~0.7
        popped: false,
        isTarget,
      },
    ]);
  }, [targetWord, collected]);

  // 初始化: 生成 5 个泡泡
  useEffect(() => {
    setCollected([]);
    setErrors(0);
    setBubbles([]);
    bubbleIdRef.current = 0;
    for (let i = 0; i < 5; i++) {
      spawnBubble();
    }
  }, [targetWord, spawnBubble]);

  // 飘落动画
  useEffect(() => {
    if (submitting) return;
    let last = performance.now();
    let spawnCounter = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 16.67; // 标准化到 60fps
      last = now;
      setBubbles((prev) => {
        const next: Bubble[] = [];
        for (const b of prev) {
          if (b.popped) continue;
          const newY = b.y + b.speed * dt;
          if (newY > 105) continue; // 飘出底部,丢弃
          next.push({ ...b, y: newY });
        }
        return next;
      });
      // 每 ~40 帧(约 0.7s)生成一个新泡泡
      spawnCounter += 1;
      if (spawnCounter >= 40) {
        spawnCounter = 0;
        if (bubbles.length < 12) spawnBubble();
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [submitting, spawnBubble, bubbles.length]);

  // 反馈自动消失
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 800);
    return () => clearTimeout(t);
  }, [feedback]);

  // P1-1: reveal 道具 — 揭示目标词长度和首字母
  useEffect(() => {
    if (!powerUpEffect) return;
    if (powerUpEffect.type === 'reveal') {
      setFeedback({ type: 'ok', text: `👁️ ${targetWord.length} 字母,首字母 ${targetWord[0].toUpperCase()}` });
      onClearPowerUpEffect?.();
    } else if (powerUpEffect.type === 'hint') {
      // hint: 自动消除下一个目标字母泡泡
      const nextLetter = targetWord[collected.length];
      if (nextLetter) {
        setBubbles((prev) => {
          const target = prev.find((b) => !b.popped && b.letter === nextLetter);
          if (!target) return prev;
          return prev.map((b) => (b.id === target.id ? { ...b, popped: true } : b));
        });
        setCollected((prev) => [...prev, nextLetter]);
        setFeedback({ type: 'ok', text: `💡 已点出字母 ${nextLetter.toUpperCase()}` });
      }
      onClearPowerUpEffect?.();
    }
  }, [powerUpEffect, targetWord, collected, onClearPowerUpEffect]);

  // 点击泡泡
  const handleBubbleClick = useCallback(
    (bubble: Bubble) => {
      if (submitting || bubble.popped) return;
      const expectedLetter = targetWord[collected.length];
      if (bubble.letter === expectedLetter) {
        // 正确字母
        setBubbles((prev) => prev.map((b) => (b.id === bubble.id ? { ...b, popped: true } : b)));
        const newCollected = [...collected, bubble.letter];
        setCollected(newCollected);
        setFeedback({ type: 'ok', text: `✓ ${bubble.letter.toUpperCase()}` });
        // 全部拼完则提交
        if (newCollected.length === targetWord.length) {
          setTimeout(() => {
            onAnswer(targetWord);
          }, 500);
        }
      } else {
        // 错误字母
        setErrors((e) => e + 1);
        setFeedback({ type: 'err', text: `✗ 期望 ${expectedLetter.toUpperCase()}` });
      }
    },
    [submitting, targetWord, collected, onAnswer]
  );

  // 拼写进度(已收集字母 vs 目标词)
  const progress = useMemo(() => {
    return targetWord.split('').map((letter, i) => ({
      letter,
      filled: i < collected.length,
    }));
  }, [targetWord, collected]);

  return (
    <div>
      {/* 顶部:目标词进度 + 释义 */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-gray-500 mb-2">
          🎯 按顺序点击字母拼出单词 {meaning && `· 释义: ${meaning}`}
        </p>
        <div className="flex justify-center gap-1.5 flex-wrap">
          {progress.map((p, i) => (
            <span
              key={i}
              className={`w-9 h-11 rounded-md border-2 flex items-center justify-center text-lg font-bold uppercase
                ${p.filled
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-white text-gray-300'}`}
            >
              {p.filled ? p.letter : '_'}
            </span>
          ))}
        </div>
      </div>

      {/* 反馈 */}
      {feedback && (
        <div
          className={`mb-3 p-2 rounded-lg text-sm font-medium text-center ${
            feedback.type === 'ok'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* 泡泡区 */}
      <div className="relative h-80 bg-gradient-to-b from-sky-50 to-blue-100 rounded-xl overflow-hidden border-2 border-blue-200">
        {bubbles.filter((b) => !b.popped).map((bubble) => (
          <button
            key={bubble.id}
            type="button"
            onClick={() => handleBubbleClick(bubble)}
            disabled={submitting}
            className="absolute w-12 h-12 rounded-full bg-white/80 backdrop-blur border-2 border-blue-300
                       text-blue-700 font-bold text-xl flex items-center justify-center
                       hover:bg-white hover:scale-110 transition-transform shadow-md uppercase"
            style={{
              left: `${bubble.x}%`,
              top: `${bubble.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {bubble.letter}
          </button>
        ))}
        {/* 错误数显示 */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-white/80 rounded text-xs text-red-600 font-medium">
          错误 {errors}
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400 text-center">
        按目标词字母顺序点击飘落的字母 · 错点会扣分
      </p>
    </div>
  );
}
