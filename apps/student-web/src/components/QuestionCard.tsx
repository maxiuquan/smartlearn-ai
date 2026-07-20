import { useState, useEffect, Fragment } from 'react';
import type { GameQuestion } from '../hooks/useGameSession';
import MemePopup, { type Meme } from './MemePopup';
import { getRandomMeme, CORRECT_MEMES, WRONG_MEMES, COMBO_MEMES } from '../utils/memes';

interface QuestionCardProps {
  question: GameQuestion;
  questionIndex: number;
  totalQuestions: number;
  onAnswer: (answer?: string, structuredAnswer?: Record<string, unknown>) => void;
  feedback: { isCorrect: boolean; message: string } | null;
  submitting: boolean;
  combo?: number;
}

// 题型标签映射
const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: '选择题',
  spelling: '拼写题',
  fill_blank: '填空题',
  tap_match: '点击配对',
  listen_select: '听音选词',
  drag_sort: '拖拽排序',
  word_bank: '词库填空',
};

function getQuestionTypeLabel(type: string): string {
  return QUESTION_TYPE_LABELS[type] || '题目';
}

// 数组随机打乱（Fisher-Yates）
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 使用浏览器 Web Speech API 朗读文本
function speak(text: string) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }
}

// ============================ 点击配对消除 ============================
interface ShuffledItem {
  text: string;
  pairId: number;
  matched: boolean;
}

interface TapMatchGameProps {
  pairs: Array<{ left: string; right: string }>;
  onAnswer: (answer: string | undefined, structuredAnswer: Record<string, unknown>) => void;
  submitting: boolean;
}

function TapMatchGame({ pairs, onAnswer, submitting }: TapMatchGameProps) {
  // 打乱左右两列
  const [leftItems, setLeftItems] = useState<ShuffledItem[]>(() =>
    shuffle(pairs.map((p, i) => ({ text: p.left, pairId: i, matched: false })))
  );
  const [rightItems, setRightItems] = useState<ShuffledItem[]>(() =>
    shuffle(pairs.map((p, i) => ({ text: p.right, pairId: i, matched: false })))
  );
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [wrongPair, setWrongPair] = useState<{ left: number; right: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const allMatched =
    pairs.length > 0 &&
    leftItems.every((it) => it.matched) &&
    rightItems.every((it) => it.matched);

  // 全部配对完成后自动提交结构化配对映射
  useEffect(() => {
    if (allMatched && !submitting) {
      // 按 leftItems 当前顺序提取 [left, right] 对
      const matchedPairs: Array<[string, string]> = leftItems.map((it) => {
        const right = rightItems.find((r) => r.pairId === it.pairId);
        return [it.text, right ? right.text : ''];
      });
      const timer = setTimeout(
        () => onAnswer(undefined, { pairs: matchedPairs }),
        600
      );
      return () => clearTimeout(timer);
    }
  }, [allMatched, submitting, onAnswer, leftItems, rightItems]);

  function handleLeftClick(idx: number) {
    if (submitting || wrongPair) return;
    if (leftItems[idx].matched) return;
    setSelectedLeft(idx);
  }

  function handleRightClick(idx: number) {
    if (submitting || wrongPair) return;
    if (selectedLeft === null || rightItems[idx].matched) return;

    const leftItem = leftItems[selectedLeft];
    const rightItem = rightItems[idx];

    if (leftItem.pairId === rightItem.pairId) {
      // 配对正确
      setLeftItems((prev) => prev.map((it, i) => (i === selectedLeft ? { ...it, matched: true } : it)));
      setRightItems((prev) => prev.map((it, i) => (i === idx ? { ...it, matched: true } : it)));
      setSelectedLeft(null);
      setStatusMsg({ type: 'ok', text: '✓ 正确' });
      setTimeout(() => setStatusMsg(null), 1000);
    } else {
      // 配对错误，闪烁红光
      setWrongPair({ left: selectedLeft, right: idx });
      setStatusMsg({ type: 'err', text: '✗ 再试试' });
      setTimeout(() => {
        setWrongPair(null);
        setSelectedLeft(null);
        setStatusMsg(null);
      }, 800);
    }
  }

  function cardClass(item: ShuffledItem, idx: number, side: 'left' | 'right') {
    const isSelected = side === 'left' && selectedLeft === idx;
    const isWrong =
      wrongPair !== null &&
      ((side === 'left' && wrongPair.left === idx) || (side === 'right' && wrongPair.right === idx));
    if (item.matched) {
      return 'border-green-300 bg-green-50 text-gray-400 cursor-default';
    }
    if (isWrong) {
      return 'border-red-500 bg-red-50 text-red-700 animate-pulse';
    }
    if (isSelected) {
      return 'border-blue-500 bg-blue-50 text-blue-700';
    }
    return 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700';
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          {leftItems.map((item, idx) => (
            <button
              key={`l-${item.pairId}`}
              type="button"
              onClick={() => handleLeftClick(idx)}
              disabled={item.matched || submitting}
              className={`w-full px-4 py-3 rounded-lg border-2 text-center font-medium transition-all ${cardClass(
                item,
                idx,
                'left'
              )}`}
            >
              {item.text}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {rightItems.map((item, idx) => (
            <button
              key={`r-${item.pairId}`}
              type="button"
              onClick={() => handleRightClick(idx)}
              disabled={item.matched || submitting}
              className={`w-full px-4 py-3 rounded-lg border-2 text-center font-medium transition-all ${cardClass(
                item,
                idx,
                'right'
              )}`}
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>

      {/* 状态提示 */}
      {statusMsg && (
        <div
          className={`mt-4 text-center text-sm font-medium ${
            statusMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {statusMsg.text}
        </div>
      )}
    </div>
  );
}

// ============================ 听音选词 ============================
interface ListenSelectGameProps {
  word: string;
  options: string[] | undefined;
  onAnswer: (answer: string) => void;
  submitting: boolean;
}

function ListenSelectGame({ word, options, onAnswer, submitting }: ListenSelectGameProps) {
  // 页面加载时自动播放一次发音
  useEffect(() => {
    speak(word);
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [word]);

  function handleOptionClick(option: string) {
    if (submitting) return;
    onAnswer(option);
  }

  if (!options) {
    return <p className="text-sm text-gray-400">暂无选项</p>;
  }

  return (
    <div>
      {/* 大播放按钮 */}
      <div className="flex justify-center mb-4">
        <button
          type="button"
          onClick={() => speak(word)}
          disabled={submitting}
          className="w-24 h-24 rounded-full bg-blue-500 text-white text-4xl flex items-center justify-center shadow-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="听发音"
        >
          🔊
        </button>
      </div>
      <p className="text-center text-sm text-gray-500 mb-4">点击按钮听发音，然后选择正确的单词</p>

      {/* 选项（与选择题布局一致） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((option, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleOptionClick(option)}
            disabled={submitting}
            className="w-full text-left px-4 py-3 rounded-lg border-2 border-gray-200 
                       hover:border-blue-400 hover:bg-blue-50 transition-all 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       text-gray-700 font-medium"
          >
            <span className="inline-block w-7 h-7 rounded-full bg-blue-100 text-blue-600 
                             text-center leading-7 mr-3 text-sm font-bold">
              {String.fromCharCode(65 + idx)}
            </span>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================ 拖拽排序 ============================
interface SortCard {
  id: number;
  text: string;
}

interface DragSortGameProps {
  sortItems: string[];
  onAnswer: (answer: string | undefined, structuredAnswer: Record<string, unknown>) => void;
  submitting: boolean;
}

function DragSortGame({ sortItems, onAnswer, submitting }: DragSortGameProps) {
  // 打乱顺序的卡片（id 用于稳定 key）
  const [items, setItems] = useState<SortCard[]>(() =>
    shuffle(sortItems.map((text, i) => ({ id: i, text })))
  );
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, idx: number) {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox 需要调用 setData 才能触发拖拽
    e.dataTransfer.setData('text/plain', idx.toString());
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      return;
    }
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(null);
  }

  // 移动端 fallback：上下移动按钮
  function moveUp(idx: number) {
    if (idx === 0 || submitting) return;
    setItems((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(idx: number) {
    if (idx === items.length - 1 || submitting) return;
    setItems((prev) => {
      const next = [...prev];
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
      return next;
    });
  }

  function handleSubmit() {
    if (submitting) return;
    // 提交结构化答案：当前顺序的文本数组
    onAnswer(undefined, { ordered_item_ids: items.map((it) => it.text) });
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">拖拽卡片调整顺序，或使用上下按钮移动：</p>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable={!submitting}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(idx)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 bg-white transition-all ${
              dragIdx === idx
                ? 'border-blue-500 bg-blue-50 opacity-50'
                : 'border-gray-200 hover:border-blue-300'
            } ${submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-move'}`}
          >
            <span className="inline-block w-7 h-7 rounded-full bg-blue-100 text-blue-600 
                             text-center leading-7 text-sm font-bold flex-shrink-0">
              {idx + 1}
            </span>
            <span className="flex-1 text-gray-700 font-medium">{item.text}</span>
            <div className="flex gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => moveUp(idx)}
                disabled={idx === 0 || submitting}
                className="w-8 h-8 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="上移"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveDown(idx)}
                disabled={idx === items.length - 1 || submitting}
                className="w-8 h-8 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="下移"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-4 w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-medium
                   hover:bg-blue-600 transition-colors disabled:opacity-50
                   disabled:cursor-not-allowed"
      >
        提交排序
      </button>
    </div>
  );
}

// ============================ 词库填空 ============================
interface WordBankGameProps {
  promptWithBlanks: string;
  wordBank: string[];
  blankIds: string[];
  onAnswer: (answer: string | undefined, structuredAnswer: Record<string, unknown>) => void;
  submitting: boolean;
}

function WordBankGame({ promptWithBlanks, wordBank, blankIds, onAnswer, submitting }: WordBankGameProps) {
  // 按 ______ 分割句子，中间即为空格位置
  const segments = promptWithBlanks.split('______');
  const blankCount = Math.max(segments.length - 1, 0);
  // 使用后端提供的 blank_id（如 b1, b2）；若不足则回退到 b1, b2...
  const effectiveBlankIds = blankIds.length >= blankCount
    ? blankIds.slice(0, blankCount)
    : Array.from({ length: blankCount }, (_, i) => `b${i + 1}`);

  // blankToBank[i] = 第 i 个空格填入的词在 wordBank 中的索引，null 表示未填
  const [blankToBank, setBlankToBank] = useState<(number | null)[]>(() =>
    Array.from({ length: blankCount }, () => null)
  );
  // 已被使用的词库索引
  const [usedBankIdx, setUsedBankIdx] = useState<Set<number>>(new Set());

  // 每个空格当前填入的词
  const filledWords: (string | null)[] = blankToBank.map((b) => (b === null ? null : wordBank[b]));
  const allFilled = blankCount > 0 && blankToBank.every((b) => b !== null);

  function handleBankClick(bankIdx: number) {
    if (submitting) return;
    if (usedBankIdx.has(bankIdx)) return;
    const firstEmpty = blankToBank.findIndex((b) => b === null);
    if (firstEmpty === -1) return;
    setBlankToBank((prev) => prev.map((b, i) => (i === firstEmpty ? bankIdx : b)));
    setUsedBankIdx((prev) => {
      const next = new Set(prev);
      next.add(bankIdx);
      return next;
    });
  }

  function handleBlankClick(blankIdx: number) {
    if (submitting) return;
    const bankIdx = blankToBank[blankIdx];
    if (bankIdx === null) return;
    // 移除已填入的词，归还词库
    setBlankToBank((prev) => prev.map((b, i) => (i === blankIdx ? null : b)));
    setUsedBankIdx((prev) => {
      const next = new Set(prev);
      next.delete(bankIdx);
      return next;
    });
  }

  function handleSubmit() {
    if (submitting) return;
    if (!allFilled) return;
    // 使用后端 blank_id 作为 key，与后端 correct_answer 格式一致
    const blanks: Record<string, string> = {};
    blankToBank.forEach((b, i) => {
      if (b !== null) {
        const blankId = effectiveBlankIds[i] || `b${i + 1}`;
        blanks[blankId] = wordBank[b];
      }
    });
    onAnswer(undefined, { blanks });
  }

  return (
    <div>
      {/* 填空句子 */}
      <div className="mb-6 text-lg text-gray-800 leading-loose">
        {segments.map((seg, i) => {
          const filled = filledWords[i];
          return (
            <Fragment key={i}>
              {seg}
              {i < segments.length - 1 && (
                <button
                  type="button"
                  onClick={() => handleBlankClick(i)}
                  disabled={submitting}
                  className={`inline-block min-w-[80px] mx-1 px-3 py-1 rounded border-2 border-dashed align-middle transition-all ${
                    filled !== null
                      ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-300 text-gray-400'
                  } disabled:cursor-not-allowed`}
                >
                  {filled !== null ? filled : '______'}
                </button>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* 词库 */}
      <p className="text-sm text-gray-500 mb-2">从词库中选择单词填入空格：</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {wordBank.map((word, idx) => {
          const used = usedBankIdx.has(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleBankClick(idx)}
              disabled={used || submitting}
              className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                used
                  ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400 hover:bg-blue-100'
              }`}
            >
              {word}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!allFilled || submitting}
        className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-medium
                   hover:bg-blue-600 transition-colors disabled:opacity-50
                   disabled:cursor-not-allowed"
      >
        提交
      </button>
    </div>
  );
}

// ============================ 主组件 ============================
export default function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  onAnswer,
  feedback,
  submitting,
  combo,
}: QuestionCardProps) {
  // P3-D: Meme 表情包反馈层
  const [meme, setMeme] = useState<Meme | null>(null);
  useEffect(() => {
    if (!feedback) {
      setMeme(null);
      return;
    }
    if (feedback.isCorrect && combo && combo >= 3) {
      setMeme(getRandomMeme(COMBO_MEMES));
    } else {
      setMeme(getRandomMeme(feedback.isCorrect ? CORRECT_MEMES : WRONG_MEMES));
    }
  }, [feedback?.isCorrect, combo]);

  const isMultipleChoice = question.type === 'multiple_choice';
  const isSpelling = question.type === 'spelling';
  const isFillBlank = question.type === 'fill_blank';
  const isTapMatch = question.type === 'tap_match';
  const isListenSelect = question.type === 'listen_select';
  const isDragSort = question.type === 'drag_sort';
  const isWordBank = question.type === 'word_bank';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    if (isMultipleChoice) {
      // 选择题通过点击选项提交
      return;
    }

    const formData = new FormData(e.currentTarget);
    const answer = (formData.get('answer') as string || '').trim();
    if (answer) {
      onAnswer(answer);
      e.currentTarget.reset();
    }
  }

  function handleOptionClick(option: string) {
    if (submitting) return;
    onAnswer(option);
  }

  // word_bank 的题干含空格，由子组件渲染；其余题型在主卡片中显示题干
  const showInstructionInMain =
    isMultipleChoice || isSpelling || isFillBlank || isTapMatch || isListenSelect || isDragSort;
  // listen_select 不显示音标，避免泄露答案
  const showPronunciation = !isListenSelect;

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      {/* 题号 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-500">
          第 {questionIndex + 1} / {totalQuestions} 题
        </span>
        <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium">
          {getQuestionTypeLabel(question.type)}
        </span>
      </div>

      {/* 题目内容（除 word_bank 外的题干） */}
      {showInstructionInMain && (
        <div className="mb-6">
          <p className="text-xl font-medium text-gray-800 mb-2">{question.prompt}</p>

          {showPronunciation && question.phonetic && (
            <p className="text-sm text-gray-400">/{question.phonetic}/</p>
          )}

          {question.meaning && (
            <p className="text-sm text-gray-500 mt-1">释义：{question.meaning}</p>
          )}
        </div>
      )}

      {/* word_bank 题型显示释义提示 */}
      {isWordBank && question.meaning && (
        <p className="text-sm text-gray-500 mb-4">💡 释义：{question.meaning}</p>
      )}

      {/* 反馈 */}
      {feedback && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm font-medium ${
            feedback.isCorrect
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* 选择题选项 */}
      {isMultipleChoice && question.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleOptionClick(option)}
              disabled={submitting}
              className="w-full text-left px-4 py-3 rounded-lg border-2 border-gray-200 
                         hover:border-blue-400 hover:bg-blue-50 transition-all 
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-gray-700 font-medium"
            >
              <span className="inline-block w-7 h-7 rounded-full bg-blue-100 text-blue-600 
                               text-center leading-7 mr-3 text-sm font-bold">
                {String.fromCharCode(65 + idx)}
              </span>
              {option}
            </button>
          ))}
        </div>
      )}

      {/* 拼写题 / 填空题 */}
      {(isSpelling || isFillBlank) && (
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            name="answer"
            type="text"
            autoComplete="off"
            disabled={submitting}
            placeholder={isSpelling ? '请输入单词拼写...' : '请输入答案...'}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg 
                       focus:border-blue-400 focus:outline-none text-lg
                       disabled:opacity-50 disabled:cursor-not-allowed"
            autoFocus
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium
                       hover:bg-blue-600 transition-colors disabled:opacity-50
                       disabled:cursor-not-allowed"
          >
            提交
          </button>
        </form>
      )}

      {/* 点击配对消除 */}
      {isTapMatch && question.pairs && question.pairs.length > 0 && (
        <TapMatchGame
          key={question.question_id}
          pairs={question.pairs}
          onAnswer={onAnswer}
          submitting={submitting}
        />
      )}

      {/* 听音选词 */}
      {isListenSelect && (
        <ListenSelectGame
          key={question.question_id}
          word={question.prompt}
          options={question.options}
          onAnswer={onAnswer}
          submitting={submitting}
        />
      )}

      {/* 拖拽排序 */}
      {isDragSort && question.sort_items && question.sort_items.length > 0 && (
        <DragSortGame
          key={question.question_id}
          sortItems={question.sort_items}
          onAnswer={onAnswer}
          submitting={submitting}
        />
      )}

      {/* 词库填空 */}
      {isWordBank && question.word_bank && question.word_bank.length > 0 && (
        <WordBankGame
          key={question.question_id}
          promptWithBlanks={question.prompt_with_blanks || question.prompt}
          wordBank={question.word_bank}
          blankIds={(question.blanks || []).map((b) => b.id)}
          onAnswer={onAnswer}
          submitting={submitting}
        />
      )}

      {/* P3-D: Meme 表情包反馈 */}
      <MemePopup meme={meme} onDismiss={() => setMeme(null)} />
    </div>
  );
}
