// P0-3 (2026-07-21): 游戏配置工具
// 直接读取 games-config.json,按 gameId 查找游戏配置(含 props/rewards/session)
import gamesConfig from '@data/games/games-config.json';

export interface GameConfig {
  game_id: string;
  name: string;
  category: string;
  description: string;
  difficulty_levels: string[];
  session: {
    time_limit_sec: number;
    lives?: number;
    combo_enabled?: boolean;
  };
  rewards?: {
    base_xp: number;
    base_coin: number;
    combo_multiplier: number;
  };
  props?: string[];
  stage?: number;
  learning_goal?: string;
  core_mechanisms?: string[];
}

const _games: GameConfig[] = (gamesConfig as any).games || [];

/**
 * 按 gameId 查找游戏配置。找不到返回 null。
 */
export function getGameConfig(gameId: string): GameConfig | null {
  return _games.find((g) => g.game_id === gameId) || null;
}

/**
 * 获取该游戏可用的道具列表。默认 ['hint', 'skip']。
 */
export function getGameProps(gameId: string): string[] {
  const cfg = getGameConfig(gameId);
  if (!cfg || !cfg.props || cfg.props.length === 0) return ['hint', 'skip'];
  return cfg.props;
}
