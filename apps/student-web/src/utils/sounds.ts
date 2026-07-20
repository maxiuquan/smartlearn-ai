/**
 * P2-A 改进 (2026-07-20): 游戏音效工具
 * 使用 Web Audio API 合成音效,无需音频文件
 * - correct: 答对音效(升调)
 * - wrong: 答错音效(降调)
 * - combo: 连击音效(连续升调)
 * - click: 按钮点击音效
 * - finish: 游戏结束音效
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctx) return null;
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  // Chrome 自动暂停的 AudioContext 需要恢复
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

interface PlayOptions {
  /** 频率 (Hz) */
  freq: number;
  /** 时长 (秒) */
  duration?: number;
  /** 音量 0-1 */
  volume?: number;
  /** 音色类型 */
  type?: OscillatorType;
  /** 延迟开始 (秒) */
  delay?: number;
}

function play({ freq, duration = 0.15, volume = 0.3, type = 'sine', delay = 0 }: PlayOptions) {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  // 简单 ADSR: 快速上升 + 指数衰减
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export const sounds = {
  /** 答对: 上升音调 (C5 -> E5 -> G5) */
  correct() {
    play({ freq: 523.25, duration: 0.08, type: 'sine' });
    play({ freq: 659.25, duration: 0.08, type: 'sine', delay: 0.08 });
    play({ freq: 783.99, duration: 0.15, type: 'sine', delay: 0.16 });
  },
  /** 答错: 下降音调 (E4 -> C4) */
  wrong() {
    play({ freq: 329.63, duration: 0.15, type: 'square', volume: 0.15 });
    play({ freq: 261.63, duration: 0.25, type: 'square', volume: 0.15, delay: 0.12 });
  },
  /** 连击: 越连击音越高 */
  combo(combo: number) {
    // combo 1-10 对应 C5 -> C6
    const base = 523.25;
    const freq = base * Math.pow(1.0594, Math.min(combo, 12));
    play({ freq, duration: 0.12, type: 'triangle', volume: 0.25 });
  },
  /** 点击: 短促 click */
  click() {
    play({ freq: 800, duration: 0.03, type: 'square', volume: 0.1 });
  },
  /** 游戏结束: 胜利曲调 */
  finish() {
    play({ freq: 523.25, duration: 0.15, type: 'sine' });
    play({ freq: 659.25, duration: 0.15, type: 'sine', delay: 0.15 });
    play({ freq: 783.99, duration: 0.15, type: 'sine', delay: 0.3 });
    play({ freq: 1046.5, duration: 0.3, type: 'sine', delay: 0.45 });
  },
};

/** 静默开关 (本地存储) */
const SOUND_KEY = 'smartlearn_sound_enabled';
export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
  } catch {}
}
