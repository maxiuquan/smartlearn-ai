import { create } from 'zustand';

export type MembershipTier = 'free' | 'vip' | 'premium';

interface MembershipState {
  tier: MembershipTier;
  setTier: (tier: MembershipTier) => void;
  canAccess: (feature: string) => boolean;
  getTierName: () => string;
  getTierColor: () => string;
  getRemainingFreeGames: () => number;
  isPremiumGame: (gameType: string) => boolean;
}

const PREMIUM_GAMES = ['entropy_merge', 'speed_hunt', 'word_tower', 'root_roguelike'];

const TIER_NAMES: Record<MembershipTier, string> = {
  free: '免费体验',
  vip: 'VIP会员',
  premium: '高级会员',
};

const TIER_COLORS: Record<MembershipTier, string> = {
  free: 'text-gray-400',
  vip: 'text-yellow-500',
  premium: 'text-purple-500',
};

function loadMembership(): MembershipTier {
  try {
    const raw = localStorage.getItem('membership_tier');
    if (raw && ['free', 'vip', 'premium'].includes(raw)) return raw as MembershipTier;
  } catch { /* ignore */ }
  return 'free';
}

function saveMembership(tier: MembershipTier) {
  try {
    localStorage.setItem('membership_tier', tier);
  } catch { /* ignore */ }
}

export const useMembershipStore = create<MembershipState>((set, get) => ({
  tier: loadMembership(),

  setTier: (tier: MembershipTier) => {
    saveMembership(tier);
    set({ tier });
  },

  canAccess: (feature: string) => {
    const { tier } = get();
    if (tier === 'premium') return true;
    if (tier === 'vip' && feature !== 'ai_tutor') return true;
    return !PREMIUM_GAMES.includes(feature) && feature !== 'ai_tutor';
  },

  getTierName: () => TIER_NAMES[get().tier],

  getTierColor: () => TIER_COLORS[get().tier],

  getRemainingFreeGames: () => {
    const { tier } = get();
    if (tier !== 'free') return 999;
    try {
      const raw = localStorage.getItem('free_game_count');
      const today = new Date().toISOString().split('T')[0];
      const saved = JSON.parse(raw || '{}');
      if (saved.date !== today) return 5;
      return Math.max(0, 5 - (saved.count || 0));
    } catch {
      return 5;
    }
  },

  isPremiumGame: (gameType: string) => PREMIUM_GAMES.includes(gameType),
}));