import { useState, useEffect } from 'react';
import { Clock, Timer, Play, Pause, Check, Target } from 'lucide-react';
import { toast } from '../store/toast';

interface LearningTimeSettingsProps {
  onClose: () => void;
}

const PRESETS = [10, 20, 30, 45];

export default function LearningTimeSettings({ onClose }: LearningTimeSettingsProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(() => {
    return Number(localStorage.getItem('daily_learning_minutes') || 30);
  });
  const [customInput, setCustomInput] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [studiedSeconds, setStudiedSeconds] = useState(() => {
    return Number(localStorage.getItem('today_time_spent') || 0);
  });
  const [isStudying, setIsStudying] = useState(() => {
    return localStorage.getItem('learning_active') === 'true';
  });
  const [elapsed, setElapsed] = useState(0);

  const studiedMinutes = Math.floor(studiedSeconds / 60);
  const progressPercent = selectedMinutes > 0
    ? Math.min(100, Math.round((studiedSeconds / 60 / selectedMinutes) * 100))
    : 0;
  const remainingMinutes = Math.max(0, selectedMinutes - studiedMinutes);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isStudying) {
      timer = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1;
          const total = studiedSeconds + next;
          localStorage.setItem('today_time_spent', String(total));
          return next;
        });
      }, 1000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [isStudying, studiedSeconds]);

  useEffect(() => {
    localStorage.setItem('learning_active', String(isStudying));
  }, [isStudying]);

  const handlePresetClick = (mins: number) => {
    setSelectedMinutes(mins);
    setIsCustom(false);
    setCustomInput('');
  };

  const handleCustomSave = () => {
    const val = parseInt(customInput, 10);
    if (isNaN(val) || val <= 0 || val > 600) {
      toast.error('请输入1-600之间的数字');
      return;
    }
    setSelectedMinutes(val);
    setIsCustom(false);
    setCustomInput('');
  };

  const handleSave = () => {
    localStorage.setItem('daily_learning_minutes', String(selectedMinutes));
    toast.success(`每日学习目标已设为 ${selectedMinutes} 分钟`);
  };

  const handleToggleStudy = () => {
    if (isStudying) {
      setIsStudying(false);
    } else {
      setIsStudying(true);
    }
  };

  const activeStudied = studiedMinutes + Math.floor(elapsed / 60);
  const activeProgress = selectedMinutes > 0
    ? Math.min(100, Math.round((activeStudied / selectedMinutes) * 100))
    : 0;

  return (
    <div className="card border-blue-100 bg-blue-50/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Clock size={18} className="text-blue-600" />
          每日学习时间
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">
          收起
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {PRESETS.map((mins) => (
          <button
            key={mins}
            onClick={() => handlePresetClick(mins)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              selectedMinutes === mins && !isCustom
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {mins}分钟{mins === 45 ? '+' : ''}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => { setIsCustom(true); setCustomInput(''); }}
          className={`py-2 px-4 rounded-xl text-sm font-medium transition-all ${
            isCustom ? 'bg-primary-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
          }`}
        >
          自定义
        </button>
        {isCustom && (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="number"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="输入分钟数"
              className="input-field flex-1 text-sm"
              min={1}
              max={600}
            />
            <button onClick={handleCustomSave} className="btn-primary text-sm py-2 px-3">
              <Check size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Target size={14} className="text-gray-400" />
            <span className="text-sm text-gray-600">今日预计 {selectedMinutes} 分钟</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Timer size={14} className="text-gray-400" />
            <span className="text-sm text-gray-600">剩余约 {remainingMinutes} 分钟</span>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
          <div
            className="bg-primary-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${activeProgress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            今日已学 {activeStudied} 分钟
          </span>
          <span className="text-xs text-gray-400">{progressPercent}%</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleToggleStudy}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isStudying
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
          }`}
        >
          {isStudying ? (
            <>
              <Pause size={16} />
              暂停计时
            </>
          ) : (
            <>
              <Play size={16} />
              开始学习
            </>
          )}
        </button>
        <button
          onClick={handleSave}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Check size={14} />
          保存设置
        </button>
      </div>
    </div>
  );
}