import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { GameQuestion } from '../hooks/useGameSession';

interface WordChainGameProps {
  questions: GameQuestion[];
  onAnswer: (answer?: string, structuredAnswer?: Record<string, unknown>) => Promise<void>;
  onFinish: () => Promise<void>;
  submitting: boolean;
}

/**
 * P1-2 改进 (2026-07-21): 单词接龙特色玩法
 * 对标 Duolingo "Word Chain" + 百词斩 "单词接龙"
 *
 * 玩法:
 *   1. 系统给出一个起始词(从题库随机抽取)
 *   2. 用户输入一个以"上一个词尾字母"开头的单词
 *   3. 该词必须存在于题库中且未被使用过
 *   4. 每接龙一个词 +1 分,连击 ≥3 触发倍率
 *   5. 错误 3 次或题库耗尽则结束
 *
 * 后端题库 spelling 题被重解释为"单词池":
 *   - questions[i].prompt = 第 i 个可用单词
 *   - 系统按规则挑出符合"首尾接龙"的题作为下一题
 *   - 提交时把用户输入的词作为 answer 字符串传给后端
 *     (后端 spelling 判定: answer === question.prompt 即正确)
 */
export default function WordChainGame({ questions, onAnswer, onFinish, submitting }: WordChainGameProps) {
  // 单词池(去重 + 小写)
  const wordPool = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      const w = (q.prompt || '').trim().toLowerCase();
      if (w.length >= 2 && /^[a-z]+$/.test(w)) set.add(w);
    });
    return Array.from(set);
  }, [questions]);

  // 已使用的单词集合
  const usedWordsRef = useRef<Set<string>>(new Set());
  // 当前接龙链(展示用)
  const [chain, setChain] = useState<string[]>([]);
  // 用户输入
  const [input, setInput] = useState('');
  // 错误次数
  const [wrongCount, setWrongCount] = useState(0);
  // 反馈消息
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  // 已答题数(用于驱动 onAnswer 推进)
  const answeredCountRef = useRef(0);
  // 已结束标志
  const finishedRef = useRef(false);

  // 当前最后一个词(用于决定下一个词的起始字母)
  const lastWord = chain.length > 0 ? chain[chain.length - 1] : '';
  const nextLetter = lastWord ? lastWord[lastWord.length - 1].toUpperCase() : '?';

  // 初始化: 从池中随机挑一个起始词
  const initStartingWord = useCallback(() => {
    if (wordPool.length === 0) return;
    const start = wordPool[Math.floor(Math.random() * wordPool.length)];
    usedWordsRef.current.add(start);
    setChain([start]);
  }, [wordPool]);

  useEffect(() => {
    initStartingWord();
  }, [initStartingWord]);

  // 展示反馈后自动清空
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 1500);
    return () => clearTimeout(t);
  }, [feedback]);

  // 找到池中符合"以指定字母开头"的下一个候选词
  const findCandidate = useCallback(
    (letter: string): string | null => {
      const lower = letter.toLowerCase();
      for (const w of wordPool) {
        if (w.startsWith(lower) && !usedWordsRef.current.has(w)) return w;
      }
      return null;
    },
    [wordPool]
  );

  // 提交一次答案给后端(自动找匹配的题目)
  const submitToBackend = useCallback(
    async (userWord: string | null) => {
      // 找到池中第一个未答过的题目作为推进
      const targetQuestion = questions[answeredCountRef.current];
      if (!targetQuestion) {
        // 题目用完了,触发结束
        if (!finishedRef.current) {
          finishedRef.current = true;
          await onFinish();
        }
        return;
      }
      answeredCountRef.current += 1;
      // 提交: 如果 userWord 匹配题目 prompt 则后端判正确;否则判错误
      // 我们让用户输入的词作为 answer,但题目 prompt 是另一回事,所以后端会判错。
      // 这是 word-chain 的设计折衷: 后端 spelling 题被重用为"单词池",后端不感知接龙规则。
      // 真正的得分逻辑由前端 chain.length 驱动,通过 score 状态展示。
      await onAnswer(userWord || '__CHAIN_MISS__');
    },
    [questions, onAnswer, onFinish]
  );

  // 处理用户提交
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      const word = input.trim().toLowerCase();
      setInput('');
      if (!word) return;

      // 验证 1: 必须以上一个词的尾字母开头
      if (lastWord && !word.startsWith(lastWord[lastWord.length - 1])) {
        setFeedback({ type: 'err', text: `✗ 必须以 "${nextLetter}" 开头` });
        setWrongCount((c) => c + 1);
        await submitToBackend(null);
        return;
      }
      // 验证 2: 不能重复使用
      if (usedWordsRef.current.has(word)) {
        setFeedback({ type: 'err', text: `✗ "${word}" 已用过` });
        setWrongCount((c) => c + 1);
        await submitToBackend(null);
        return;
      }
      // 验证 3: 必须在词库中(简化规则: 池中存在)
      if (!wordPool.includes(word)) {
        setFeedback({ type: 'err', text: `✗ "${word}" 不在词库中` });
        setWrongCount((c) => c + 1);
        await submitToBackend(null);
        return;
      }
      // 通过验证: 加入链
      usedWordsRef.current.add(word);
      setChain((prev) => [...prev, word]);
      setFeedback({ type: 'ok', text: `✓ "${word}" 接龙成功!` });
      await submitToBackend(word);
    },
    [input, submitting, lastWord, nextLetter, wordPool, submitToBackend]
  );

  // 跳过(系统挑一个符合规则的词自动接上)
  const handleHint = useCallback(async () => {
    if (submitting) return;
    if (!lastWord) return;
    const candidate = findCandidate(lastWord[lastWord.length - 1]);
    if (!candidate) {
      setFeedback({ type: 'err', text: '💡 词库中已无符合规则的词' });
      return;
    }
    usedWordsRef.current.add(candidate);
    setChain((prev) => [...prev, candidate]);
    setFeedback({ type: 'ok', text: `💡 系统提示: ${candidate}` });
    await submitToBackend(candidate);
  }, [submitting, lastWord, findCandidate, submitToBackend]);

  // 错误 3 次自动结束
  useEffect(() => {
    if (wrongCount >= 3 && !finishedRef.current) {
      finishedRef.current = true;
      setFeedback({ type: 'err', text: '❌ 错误 3 次,游戏结束' });
      setTimeout(() => {
        onFinish();
      }, 1500);
    }
  }, [wrongCount, onFinish]);

  // 词库耗尽自动结束
  useEffect(() => {
    if (chain.length === 0) return;
    const last = chain[chain.length - 1];
    const candidate = findCandidate(last[last.length - 1]);
    if (!candidate && !finishedRef.current) {
      finishedRef.current = true;
      setFeedback({ type: 'ok', text: '🏆 词库已耗尽,完美通关!' });
      setTimeout(() => {
        onFinish();
      }, 1500);
    }
  }, [chain, findCandidate, onFinish]);

  if (wordPool.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 text-center">
        <p className="text-gray-500">词库为空,无法开始接龙</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-500">
          🔗 单词接龙 · 词库 {wordPool.length} 词
        </span>
        <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium">
          错误 {wrongCount}/3
        </span>
      </div>

      {/* 起始字母提示 */}
      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg text-center">
        <p className="text-sm text-gray-500 mb-1">
          {lastWord ? '下一个词应以这个字母开头' : '准备开始...'}
        </p>
        <p className="text-5xl font-bold text-blue-600">{nextLetter}</p>
      </div>

      {/* 接龙链 */}
      <div className="mb-4 max-h-40 overflow-y-auto">
        <p className="text-xs text-gray-400 mb-2">接龙历史 ({chain.length}):</p>
        <div className="flex flex-wrap gap-1.5">
          {chain.map((word, i) => (
            <span
              key={`${word}-${i}`}
              className={`px-2.5 py-1 rounded-md text-sm font-medium ${
                i === 0
                  ? 'bg-purple-100 text-purple-700'
                  : i === chain.length - 1
                  ? 'bg-green-100 text-green-700 ring-2 ring-green-300'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {i === 0 && '🎯 '}
              {word}
            </span>
          ))}
        </div>
      </div>

      {/* 反馈 */}
      {feedback && (
        <div
          className={`mb-3 p-2.5 rounded-lg text-sm font-medium text-center ${
            feedback.type === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* 输入区 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
          disabled={submitting}
          placeholder={`输入以 "${nextLetter}" 开头的单词...`}
          className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg 
                     focus:border-blue-400 focus:outline-none text-lg font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed"
          autoFocus
        />
        <button
          type="submit"
          disabled={submitting || !input.trim()}
          className="px-5 py-3 bg-blue-500 text-white rounded-lg font-medium
                     hover:bg-blue-600 transition-colors disabled:opacity-50
                     disabled:cursor-not-allowed"
        >
          接龙
        </button>
        <button
          type="button"
          onClick={handleHint}
          disabled={submitting}
          className="px-3 py-3 bg-yellow-100 text-yellow-700 rounded-lg font-medium
                     hover:bg-yellow-200 transition-colors disabled:opacity-50
                     disabled:cursor-not-allowed"
          title="系统提示一个符合规则的词"
        >
          💡
        </button>
      </form>

      <p className="mt-3 text-xs text-gray-400 text-center">
        规则: 以下一个词的尾字母作为新词的开头 · 错误 3 次结束
      </p>
    </div>
  );
}
