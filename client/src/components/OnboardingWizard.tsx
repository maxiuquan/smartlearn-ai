import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { api } from '../api/client';
import { toast } from '../store/toast';
import { Rocket, Target, Calendar, BookOpen, ArrowRight, ArrowLeft, Check, Clock } from 'lucide-react';

interface OnboardingWizardProps {
  onDismiss: () => void;
  onSelectMode: (mode: string) => void;
}

const subjects = [
  { id: 'math', title: '数学', icon: Target, gradient: 'from-blue-50 to-blue-100', iconColor: 'text-blue-600' },
  { id: 'english', title: '英语', icon: BookOpen, gradient: 'from-green-50 to-green-100', iconColor: 'text-green-600' },
  { id: 'both', title: '两者都要', icon: Rocket, gradient: 'from-purple-50 to-pink-100', iconColor: 'text-purple-600' },
];

const examTypes = [
  { id: '考研', title: '考研', description: '全国硕士研究生统一招生考试', icon: Target },
  { id: '四六级', title: '四六级', description: '大学英语四六级考试', icon: BookOpen },
  { id: 'custom', title: '自定义', description: '设置自己的目标日期', icon: Calendar },
];

const timePresets = [
  { minutes: 10, label: '10分钟', sub: '轻度学习' },
  { minutes: 20, label: '20分钟', sub: '日常巩固' },
  { minutes: 30, label: '30分钟', sub: '标准学习' },
  { minutes: 45, label: '45分钟+', sub: '高强度' },
];

const dotLabels = ['选择科目', '设定目标', '学习时长', '智能诊断'];

export default function OnboardingWizard({ onDismiss, onSelectMode }: OnboardingWizardProps) {
  const userId = useAuthStore((s) => s.userId);
  const [step, setStep] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [selectedTime, setSelectedTime] = useState<number>(30);
  const [saving, setSaving] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');

  const handleSelectSubject = async (subjectId: string) => {
    setSelectedSubject(subjectId);
    if (userId) {
      try {
        await api.selectSubject(userId, subjectId === 'both' ? 'math' : subjectId);
      } catch {}
    }
  };

  const handleNextToStep2 = () => {
    if (!selectedSubject) return;
    setSlideDir('left');
    setStep(1);
  };

  const handleSelectExam = async (examId: string) => {
    setSelectedExam(examId);
    if (examId === 'custom') {
      return;
    }
    if (userId) {
      try {
        await api.setTargetExam(userId, examId);
        if (examId === '四六级') {
          await api.setEnglishLevel(userId, 'intermediate');
        }
      } catch {}
    }
  };

  const handleNextToStep3 = () => {
    if (!selectedExam) return;
    if (selectedExam === 'custom' && !customDate) return;
    setSlideDir('left');
    setStep(2);
  };

  const handleNextToStep4 = () => {
    localStorage.setItem('daily_learning_minutes', String(selectedTime));
    setSlideDir('left');
    setStep(3);
  };

  const handleStartDiagnostic = () => {
    localStorage.setItem('daily_learning_minutes', String(selectedTime));
    localStorage.setItem('onboarding_done', 'true');
    onSelectMode('targeted');
  };

  const handleBack = () => {
    setSlideDir('right');
    setStep((prev) => prev - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-scale-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">欢迎来到 LexiStrike</h2>
          </div>

          <div className="flex items-center justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      i === step
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                        : i < step
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {i < step ? <Check size={16} /> : i + 1}
                  </div>
                  <span className={`text-xs ${i <= step ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                    {dotLabels[i]}
                  </span>
                </div>
                {i < 3 && (
                  <div className={`w-8 h-0.5 rounded-full mt-[-16px] transition-all ${i < step ? 'bg-primary-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          <div className="transition-all duration-300" style={{ minHeight: '240px' }}>
            {step === 0 && (
              <div className="space-y-4">
                <p className="text-gray-600 text-center text-sm">你想学习哪个科目？</p>
                <div className="grid grid-cols-3 gap-3">
                  {subjects.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => handleSelectSubject(sub.id)}
                      className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${
                        selectedSubject === sub.id
                          ? 'border-primary-400 bg-primary-50 shadow-md'
                          : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-14 h-14 bg-gradient-to-br ${sub.gradient} rounded-2xl flex items-center justify-center`}>
                        <sub.icon size={28} className={sub.iconColor} />
                      </div>
                      <span className={`font-semibold text-sm ${selectedSubject === sub.id ? 'text-primary-700' : 'text-gray-700'}`}>
                        {sub.title}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleNextToStep2}
                    disabled={!selectedSubject}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    下一步 <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <p className="text-gray-600 text-center text-sm">你的目标考试是什么？</p>
                <div className="space-y-3">
                  {examTypes.map((exam) => (
                    <button
                      key={exam.id}
                      onClick={() => handleSelectExam(exam.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                        selectedExam === exam.id
                          ? 'border-primary-400 bg-primary-50 shadow-md'
                          : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        selectedExam === exam.id ? 'bg-primary-100' : 'bg-white'
                      }`}>
                        <exam.icon size={22} className={selectedExam === exam.id ? 'text-primary-600' : 'text-gray-400'} />
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold ${selectedExam === exam.id ? 'text-primary-700' : 'text-gray-900'}`}>
                          {exam.title}
                        </p>
                        <p className="text-sm text-gray-500">{exam.description}</p>
                      </div>
                      {selectedExam === exam.id && (
                        <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                          <Check size={14} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {selectedExam === 'custom' && (
                  <div className="animate-slide-up">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">选择目标日期</label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="input-field"
                      min={new Date().toISOString().split('T')[0]}
                    />
                    {customDate && (
                      <p className="text-xs text-gray-400 mt-2">
                        距离目标还有 {Math.ceil((new Date(customDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} 天
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button onClick={handleBack} className="btn-ghost flex items-center gap-1 text-sm">
                    <ArrowLeft size={16} /> 上一步
                  </button>
                  <button
                    onClick={handleNextToStep3}
                    disabled={!selectedExam || (selectedExam === 'custom' && !customDate)}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    下一步 <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl flex items-center justify-center mb-3">
                    <Clock className="text-blue-600" size={30} />
                  </div>
                  <p className="text-gray-600 text-sm">设置每日学习时长</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {timePresets.map((preset) => (
                    <button
                      key={preset.minutes}
                      onClick={() => setSelectedTime(preset.minutes)}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all ${
                        selectedTime === preset.minutes
                          ? 'border-blue-400 bg-blue-50 shadow-md'
                          : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span className={`font-bold text-lg ${selectedTime === preset.minutes ? 'text-blue-700' : 'text-gray-800'}`}>
                        {preset.label}
                      </span>
                      <span className={`text-xs ${selectedTime === preset.minutes ? 'text-blue-500' : 'text-gray-400'}`}>
                        {preset.sub}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button onClick={handleBack} className="btn-ghost flex items-center gap-1 text-sm">
                    <ArrowLeft size={16} /> 上一步
                  </button>
                  <button
                    onClick={handleNextToStep4}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    下一步 <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 text-center">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary-100 to-blue-100 rounded-3xl flex items-center justify-center">
                  <Target className="text-primary-600" size={36} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">准备开始智能诊断</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                    系统将为你生成 {selectedSubject === 'both' ? '5-8' : '5-8'} 道诊断题目，
                    通过答题结果智能分析你的知识掌握程度，找出薄弱环节。
                  </p>
                </div>
                <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-primary-400 rounded-full" />
                    <span>知识点定位</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-blue-400 rounded-full" />
                    <span>能力评估</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-purple-400 rounded-full" />
                    <span>学习建议</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button onClick={handleBack} className="btn-ghost flex items-center gap-1 text-sm">
                    <ArrowLeft size={16} /> 上一步
                  </button>
                  <button
                    onClick={handleStartDiagnostic}
                    disabled={saving}
                    className="btn-primary text-lg px-8 py-3 flex items-center gap-2"
                  >
                    <Rocket size={20} />
                    开始诊断
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}