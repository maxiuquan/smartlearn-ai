import { useState, useEffect, useMemo, useCallback } from 'react';
import type { GameQuestion, PowerUpEffect } from '../hooks/useGameSession';

interface MemoryFlipMatchGameProps {
  pairs: Array<{ left: string; right: string }>;
  onAnswer: (answer: string | undefined, structuredAnswer: Record<string, unknown>) => void;
  submitting: boolean;
  powerUpEffect?: PowerUpEffect | null;
  onClearPowerUpEffect?: () => void;
}

interface FlipCard {
  id: number;          // 卡片唯一 ID
  pairId: number;      // 配对 ID(同 pairId 的两张卡匹配)
  side: 'left' | 'right';
  text: string;
  flipped: boolean;    // 当前是否翻开
  matched: boolean;    // 是否已配对消除
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

/**
 * P1-2 改进 (2026-07-21): 记忆翻牌特色玩法
 * 对标 Quizlet Match + 经典 Memory Game
 *
 * 玩法:
 *   1. 卡片初始全部背面朝下
 *   2. 点击翻开 1 张,再翻开第 2 张
 *   3. 若两张配对(pairId 相同)则保持翻开,记为消除
 *   4. 若不配对则 0.8s 后翻回
 *   5. 全部配对完成时自动提交结构化答案
 *   6. 步数统计(步数越少越优秀)
 *
 * 与 tap_match 数据格式相同(后端不变),仅前端渲染方式不同。
 */
export default function MemoryFlipMatchGame({
  pairs,
  onAnswer,
  submitting,
  powerUpEffect,
  onClearPowerUpEffect,
}: MemoryFlipMatchGameProps) {
  // 构建卡片数组:每对生成两张卡(left + right),全部打乱
  const [cards, setCards] = useState<FlipCard[]>(() => {
    const all: FlipCard[] = [];
    pairs.forEach((p, i) => {
      all.push({ id: i * 2, pairId: i, side: 'left', text: p.left, flipped: false, matched: false });
      all.push({ id: i * 2 + 1, pairId: i, side: 'right', text: p.right, flipped: false, matched: false });
    });
    return shuffle(all);
  });

  // 当前已翻开但未配对的卡片(最多 1 张)
  const [firstFlip, setFirstFlip] = useState<number | null>(null);
  // 步数(每翻开两张算 1 步)
  const [moves, setMoves] = useState(0);
  // 状态消息
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  // 锁定(等待不配对卡片翻回时禁止点击)
  const [locked, setLocked] = useState(false);

  // P1-1: hint 道具 — 临时翻开所有未配对卡片 1 秒
  useEffect(() => {
    if (!powerUpEffect) return;
    if (powerUpEffect.type === 'hint') {
      // 短暂翻开所有未配对卡片
      setCards((prev) => prev.map((c) => (c.matched ? c : { ...c, flipped: true })));
      setStatusMsg({ type: 'ok', text: '💡 偷看 1 秒' });
      setTimeout(() => {
        setCards((prev) => prev.map((c) => (c.matched ? c : { ...c, flipped: false })));
        setStatusMsg(null);
      }, 1000);
      onClearPowerUpEffect?.();
    } else if (powerUpEffect.type === 'shuffle') {
      // 重新打乱未配对的卡片
      setCards((prev) => {
        const matched = prev.filter((c) => c.matched);
        const unmatched = shuffle(prev.filter((c) => !c.matched).map((c) => ({ ...c, flipped: false })));
        return [...matched, ...unmatched];
      });
      setFirstFlip(null);
      setStatusMsg({ type: 'ok', text: '🔀 已重新打乱' });
      setTimeout(() => setStatusMsg(null), 1000);
      onClearPowerUpEffect?.();
    }
  }, [powerUpEffect, onClearPowerUpEffect]);

  const allMatched = cards.length > 0 && cards.every((c) => c.matched);

  // 全部配对完成自动提交
  useEffect(() => {
    if (allMatched && !submitting) {
      // 按 pairId 顺序输出 [left, right] 对
      const matchedPairs: Array<[string, string]> = pairs.map((p, i) => [p.left, p.right]);
      const timer = setTimeout(
        () => onAnswer(undefined, { pairs: matchedPairs }),
        600
      );
      return () => clearTimeout(timer);
    }
  }, [allMatched, submitting, onAnswer, pairs]);

  const handleCardClick = useCallback(
    (cardId: number) => {
      if (submitting || locked) return;
      const card = cards.find((c) => c.id === cardId);
      if (!card || card.matched || card.flipped) return;

      // 翻开这张卡
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, flipped: true } : c)));

      if (firstFlip === null) {
        // 第一张
        setFirstFlip(cardId);
      } else {
        // 第二张 — 判定是否配对
        const firstCard = cards.find((c) => c.id === firstFlip);
        setMoves((m) => m + 1);
        if (firstCard && firstCard.pairId === card.pairId) {
          // 配对成功
          setCards((prev) =>
            prev.map((c) =>
              c.id === cardId || c.id === firstFlip ? { ...c, matched: true } : c
            )
          );
          setFirstFlip(null);
          setStatusMsg({ type: 'ok', text: '✓ 配对成功' });
          setTimeout(() => setStatusMsg(null), 800);
        } else {
          // 不配对 — 锁定并 0.8s 后翻回
          setLocked(true);
          setStatusMsg({ type: 'err', text: '✗ 不配对' });
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === cardId || c.id === firstFlip ? { ...c, flipped: false } : c
              )
            );
            setFirstFlip(null);
            setLocked(false);
            setStatusMsg(null);
          }, 800);
        }
      }
    },
    [cards, firstFlip, submitting, locked]
  );

  // 卡片样式
  function cardClass(card: FlipCard): string {
    if (card.matched) {
      return 'border-green-400 bg-green-50 text-green-700';
    }
    if (card.flipped) {
      return 'border-blue-500 bg-blue-50 text-gray-800';
    }
    // 背面 — 神秘紫色卡背
    return 'border-purple-300 bg-gradient-to-br from-purple-400 to-purple-600 text-white cursor-pointer hover:from-purple-500 hover:to-purple-700';
  }

  return (
    <div>
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <span className="text-gray-500">🎯 翻牌找配对</span>
        <span className="text-gray-600">步数: <span className="font-bold text-purple-600">{moves}</span></span>
      </div>

      {/* 卡片网格 — 自适应列数(2 对=4 卡=2 列; 3 对=6 卡=3 列; 4+ 对=4 列) */}
      <div
        className="grid gap-3 mb-4"
        style={{
          gridTemplateColumns: `repeat(${pairs.length <= 2 ? 2 : pairs.length <= 3 ? 3 : 4}, minmax(0, 1fr))`,
        }}
      >
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => handleCardClick(card.id)}
            disabled={submitting || card.matched || card.flipped || locked}
            className={`relative h-24 rounded-lg border-2 transition-all duration-300 flex items-center justify-center p-2 text-center font-medium
              ${cardClass(card)}
              ${!card.flipped && !card.matched ? 'hover:scale-105' : ''}
              disabled:cursor-default`}
          >
            {card.flipped || card.matched ? (
              <span className="text-sm break-words leading-tight">{card.text}</span>
            ) : (
              <span className="text-3xl">?</span>
            )}
          </button>
        ))}
      </div>

      {/* 状态消息 */}
      {statusMsg && (
        <div
          className={`text-center text-sm font-medium ${
            statusMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400 text-center">
        翻开两张卡,若词与释义匹配则消除 · 步数越少越优秀
      </p>
    </div>
  );
}
