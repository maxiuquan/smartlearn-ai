import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export const gameRoutes = Router();

// 游戏配置数据缓存
const gamesConfigPath = path.join(__dirname, '..', '..', '..', 'data', 'games', 'games-config.json');
const leaderboardConfigPath = path.join(__dirname, '..', '..', '..', 'data', 'games', 'leaderboard-config.json');

function loadGamesConfig() {
  if (fs.existsSync(gamesConfigPath)) {
    return JSON.parse(fs.readFileSync(gamesConfigPath, 'utf-8'));
  }
  return { games: [], categories: {} };
}

function loadLeaderboardConfig() {
  if (fs.existsSync(leaderboardConfigPath)) {
    return JSON.parse(fs.readFileSync(leaderboardConfigPath, 'utf-8'));
  }
  return { leaderboards: [], ranks: [], badges: [] };
}

// GET /api/games - 获取游戏目录
gameRoutes.get('/', (_req, res) => {
  try {
    const config = loadGamesConfig();
    res.json({
      categories: config.categories,
      games: config.games.map((g: any) => ({
        game_id: g.game_id,
        name: g.name,
        name_en: g.name_en,
        category: g.category,
        subjects: g.subjects,
        description: g.description,
        difficulty_levels: g.difficulty_levels,
        stage: g.stage,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: '获取游戏列表失败' });
  }
});

// GET /api/games/:id - 获取单个游戏详情
gameRoutes.get('/:id', (req, res) => {
  try {
    const config = loadGamesConfig();
    const game = config.games.find((g: any) => g.game_id === req.params.id);
    if (!game) {
      return res.status(404).json({ error: '游戏不存在' });
    }
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: '获取游戏详情失败' });
  }
});

// POST /api/games/:id/sessions - 上报游戏对局结果
gameRoutes.post('/:id/sessions', (req, res) => {
  try {
    const { score, xp_gained, coins_gained, accuracy, duration, word_events } = req.body;
    
    // 记录对局
    const session = {
      game_id: req.params.id,
      user_id: req.body.user_id || 'anonymous',
      score: score || 0,
      xp_gained: xp_gained || 0,
      coins_gained: coins_gained || 0,
      accuracy: accuracy || 0,
      duration: duration || 0,
      started_at: req.body.started_at || new Date().toISOString(),
      finished_at: new Date().toISOString(),
      word_events: word_events || [],
    };
    
    res.json({
      success: true,
      session,
      message: '对局记录已保存',
    });
  } catch (error) {
    res.status(500).json({ error: '保存对局记录失败' });
  }
});

// GET /api/leaderboards/:scope - 获取排行榜
gameRoutes.get('/leaderboards/:scope', (req, res) => {
  try {
    const config = loadLeaderboardConfig();
    const scope = req.params.scope;
    const lb = config.leaderboards.find((l: any) => l.scope === scope);
    
    if (!lb) {
      return res.json({ entries: [], message: '排行榜类型不存在' });
    }
    
    res.json({
      scope: lb.scope,
      name: lb.name,
      update_frequency: lb.update_frequency,
      entries: [], // 实际排行榜数据需要从数据库查询
    });
  } catch (error) {
    res.status(500).json({ error: '获取排行榜失败' });
  }
});

// GET /api/leaderboards - 获取排行榜配置
gameRoutes.get('/leaderboards', (_req, res) => {
  try {
    const config = loadLeaderboardConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: '获取排行榜配置失败' });
  }
});