import React from 'react';
import { Upload, ShoppingBag, Play, BookOpen, Target } from 'lucide-react';

interface MenuProps {
  onStart: () => void;
  onShop: () => void;
  onImport: () => void;
  highScore: number;
  stats: { total: number; mastered: number; learning: number };
}

const Menu: React.FC<MenuProps> = ({ onStart, onShop, onImport, highScore, stats }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0A0A] z-20 px-6">
      <div className="text-center space-y-8 max-w-md w-full">
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-3">
            <Target className="w-10 h-10 text-[#00FF9C]" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-wider" style={{ fontFamily: 'monospace' }}>
            LEXI-STRIKE
          </h1>
          <p className="text-xs tracking-[0.4em] text-[#00FF9C]/60" style={{ fontFamily: 'monospace' }}>
            GLOBAL
          </p>
          <p className="text-sm text-gray-400 mt-2">赛博军事风 · FPS射击 + 擂台格斗 · 英语词汇训练</p>
        </div>

        {highScore > 0 && (
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
            <span>最高分: <span className="text-[#00FF9C]">{highScore}</span></span>
            <span>已掌握: <span className="text-[#00FF9C]">{stats.mastered}</span></span>
            <span>学习中: <span className="text-yellow-400">{stats.learning}</span></span>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={onStart}
            className="w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 bg-gradient-to-r from-[#00FF9C]/20 to-[#00FF9C]/10 border-2 border-[#00FF9C]/40 text-white hover:bg-[#00FF9C]/20 hover:border-[#00FF9C]"
          >
            <Play size={20} /> 开始游戏
          </button>

          <div className="flex gap-3">
            <button
              onClick={onShop}
              className="flex-1 py-3 rounded-xl font-bold text-sm border border-gray-600 text-gray-300 hover:border-[#00FF9C]/50 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <BookOpen size={16} /> 词库商店
            </button>
            <button
              onClick={onImport}
              className="flex-1 py-3 rounded-xl font-bold text-sm border border-gray-600 text-gray-300 hover:border-[#00FF9C]/50 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <Upload size={16} /> 导入词库
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Menu;