import type { Meme } from '../components/MemePopup';

/**
 * P3-D 对标 Quizizz: Meme 表情包数据池
 * - 答对/答错/连击各 5-7 条
 * - 鼓励为主,降低 K12 用户挫败感
 */

export const CORRECT_MEMES: Meme[] = [
  { text: '答对啦！', emoji: '🎉', color: 'border-green-400' },
  { text: '太厉害了！', emoji: '😎', color: 'border-blue-400' },
  { text: '稳！', emoji: '💪', color: 'border-purple-400' },
  { text: '学霸本霸', emoji: '🤓', color: 'border-yellow-400' },
  { text: '满分操作', emoji: '💯', color: 'border-pink-400' },
  { text: '就是这样！', emoji: '✨', color: 'border-indigo-400' },
  { text: '继续保持！', emoji: '🚀', color: 'border-teal-400' },
];

export const WRONG_MEMES: Meme[] = [
  { text: '没关系,再来一次', emoji: '🤗', color: 'border-orange-400' },
  { text: '错题是进步的阶梯', emoji: '📚', color: 'border-blue-400' },
  { text: '别灰心,你可以的', emoji: '💪', color: 'border-green-400' },
  { text: '失败是成功之母', emoji: '🌱', color: 'border-teal-400' },
  { text: '深呼吸,继续', emoji: '🌬️', color: 'border-purple-400' },
];

export const COMBO_MEMES: Meme[] = [
  { text: '连击高手！', emoji: '🔥', color: 'border-orange-400' },
  { text: '势不可挡！', emoji: '⚡', color: 'border-yellow-400' },
  { text: '超神操作！', emoji: '🌟', color: 'border-pink-400' },
  { text: '燃烧吧！', emoji: '💥', color: 'border-red-400' },
];

export function getRandomMeme(pool: Meme[]): Meme {
  return pool[Math.floor(Math.random() * pool.length)];
}
