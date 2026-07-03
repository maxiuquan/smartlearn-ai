import { useState } from 'react';
import { Lightbulb, X, ChevronRight } from 'lucide-react';

export interface GameInstruction {
  title: string;
  steps: string[];
  tips: string[];
}

interface Props {
  instructions: GameInstruction;
  gameName: string;
  accentColor?: string;
}

export function GameInstructions({ instructions, gameName, accentColor = '#00FF9C' }: Props) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(`game_seen_${gameName}`) === '1'; } catch { return false; }
  });

  const dismiss = () => {
    setOpen(false);
    setSeen(true);
    try { localStorage.setItem(`game_seen_${gameName}`, '1'); } catch { /* ignore */ }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className='inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-[#00FF9C] hover:border-[#00FF9C]/40 transition-colors'
        title='玩法说明'
      >
        <Lightbulb size={12} />
        <span>玩法</span>
        {!seen && <span className='w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse' />}
      </button>

      {open && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in' onClick={dismiss}>
          <div
            className='bg-[#0D0F14] border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-4 relative shadow-2xl'
            onClick={(e) => e.stopPropagation()}
            style={{ borderColor: accentColor + '40' }}
          >
            <button
              onClick={dismiss}
              className='absolute top-3 right-3 text-gray-500 hover:text-white'
            >
              <X size={18} />
            </button>

            <div className='flex items-center gap-2'>
              <div
                className='w-10 h-10 rounded-xl flex items-center justify-center'
                style={{ backgroundColor: accentColor + '20', color: accentColor }}
              >
                <Lightbulb size={20} />
              </div>
              <div>
                <h3 className='font-bold text-white text-lg'>{instructions.title}</h3>
                <p className='text-xs text-gray-500'>{gameName} · 玩法说明</p>
              </div>
            </div>

            <div className='space-y-2'>
              <p className='text-xs text-gray-500 uppercase tracking-wider font-medium'>📋 玩法步骤</p>
              <ol className='space-y-1.5'>
                {instructions.steps.map((s, i) => (
                  <li key={i} className='flex items-start gap-2 text-sm text-gray-300'>
                    <span
                      className='flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold'
                      style={{ backgroundColor: accentColor + '30', color: accentColor }}
                    >
                      {i + 1}
                    </span>
                    <span className='leading-relaxed'>{s}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className='bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1.5'>
              <p className='text-xs text-amber-400 uppercase tracking-wider font-medium'>💡 高分技巧</p>
              {instructions.tips.map((t, i) => (
                <p key={i} className='text-xs text-amber-200/80 leading-relaxed flex items-start gap-1.5'>
                  <ChevronRight size={12} className='flex-shrink-0 mt-0.5' style={{ color: accentColor }} />
                  {t}
                </p>
              ))}
            </div>

            <button
              onClick={dismiss}
              className='w-full py-2.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98]'
              style={{ backgroundColor: accentColor + '20', color: accentColor, border: '1px solid ' + accentColor + '50' }}
            >
              开始挑战 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export const SPEED_CHALLENGE_INSTRUCTIONS: GameInstruction = {
  title: '速拼挑战',
  steps: [
    '30秒内尽可能多地拼写屏幕显示的中文释义对应的英文单词。',
    '输入框中键入单词，按回车或点击「确认」提交。',
    '拼错会显示正确答案并消耗时间，每5连击获得额外5分。',
    '可点击「跳过」按钮放弃当前题进入下一题（不扣分）。',
  ],
  tips: [
    '熟记高频词根能极大提升反应速度',
    '5连击 / 10连击 / 15连击均有特殊提示',
    '最后8秒倒计时变红，注意节奏',
  ],
};

export const WORD_PUZZLE_INSTRUCTIONS: GameInstruction = {
  title: '单词拼图',
  steps: [
    '根据中文释义与首字母提示拼写完整单词。',
    '每题有3次机会，答错不立即扣分，会显示原词作为提示。',
    '可使用「提示」按钮查看例句（会消耗1次尝试机会）。',
    '完成全部10题后，根据得分给出 S/A/B/C 评级。',
  ],
  tips: [
    '看到首字母先联想可能的词根/词缀',
    '「提示」功能适合用于长难词',
    'S评级需要满分（130+分）',
  ],
};

export const MEMORY_FLIP_INSTRUCTIONS: GameInstruction = {
  title: '翻牌记忆',
  steps: [
    '8对共16张卡牌背面朝上，每次翻开2张。',
    '若翻到的英文与中文释义配对成功，牌会保持翻开状态。',
    '配对失败需将卡牌重新盖回，并扣1分。',
    '用时越短、错误越少，得分越高。',
  ],
  tips: [
    '用「分区记忆法」按位置分组',
    '配对成功后立即在脑中复述一遍',
    '先观察再翻牌，避免乱点',
  ],
};

export const WORD_SEARCH_INSTRUCTIONS: GameInstruction = {
  title: '单词搜索',
  steps: [
    '在10×10字母矩阵中找到所有目标英文单词。',
    '点击起点格子，再点击终点格子（自动连成直线或对角线）。',
    '正反方向均可，自动大小写不敏感。',
    '使用「提示」按钮高亮一个未找到的单词（会扣10分）。',
  ],
  tips: [
    '从短词开始找容易建立信心',
    '注意首字母出现频率较高的位置',
    '可以沿8个方向扫描',
  ],
};

export const HANGMAN_INSTRUCTIONS: GameInstruction = {
  title: '猜词大挑战',
  steps: [
    '根据中文释义猜出完整英文单词。',
    '每轮6次生命，猜错一个字母消耗1点。',
    '猜对一个单词得5分+完成奖励20分。',
    '完成10轮即结束。',
  ],
 tips: [
   '先猜元音（E A I O U）命中率最高',
   '注意词长，过短的词可能是常用小词',
   '剩余3次生命时优先猜常见辅音',
 ],
};

export const LEXICON_DEFENSE_INSTRUCTIONS: GameInstruction = {
  title: '防线突围',
  steps: [
    '15波怪兽沿路径向右入侵，点击屏幕下方的英文单词作为「炮塔」攻击。',
    '怪兽HP与防御等级不同，需选择正确释义才能击破。',
    '漏掉的怪兽会扣1点生命，3点生命耗尽即失败。',
    '击杀数越多，奖励积分越高。',
  ],
  tips: [
    '保持至少2个炮塔同时在线',
    'Boss（红色）需要3次正确释义',
    '优先打血量低的怪兽',
  ],
};

export const WORD_MATCH_INSTRUCTIONS: GameInstruction = {
  title: '单词消消乐',
  steps: [
    '左侧为英文单词，右侧为中文释义，点击配对正确的对子。',
    '答对立即高亮并消失，答错会闪烁提示。',
    '配对全部6对即通关，错误会扣分。',
    '连续配对成功可触发Combo加分。',
  ],
  tips: [
    '先扫一眼右侧确定大致释义位置',
    '不确定的可以靠词根联想',
    'Combo≥5触发特殊提示',
  ],
};
