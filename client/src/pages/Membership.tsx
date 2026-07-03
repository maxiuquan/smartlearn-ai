import { useMembershipStore, MembershipTier } from '../store/membership';
import { Star, Zap, Check, X, Sparkles, MessageSquare, FileText, BookOpen, BarChart3 } from 'lucide-react';
import { toast } from '../store/toast';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

const TIERS: {
  key: MembershipTier;
  name: string;
  price: string;
  icon: any;
  color: string;
  gradient: string;
  bgGradient: string;
  recommended?: boolean;
  features: { text: string; included: boolean }[];
}[] = [
  {
    key: 'free',
    name: '免费体验',
    price: '免费',
    icon: Zap,
    color: 'gray',
    gradient: 'from-gray-400 to-gray-500',
    bgGradient: 'from-gray-50 to-gray-100',
    features: [
      { text: '每天5次游戏', included: true },
      { text: '基础单词库', included: true },
      { text: '基础统计', included: true },
      { text: 'AI智能辅导', included: false },
      { text: '个性化学习路径', included: false },
      { text: '学习报告导出', included: false },
      { text: '考前预测', included: false },
      { text: '优先客服', included: false },
    ],
  },
  {
    key: 'vip',
    name: 'VIP会员',
    price: '¥29',
    icon: Star,
    color: 'yellow',
    gradient: 'from-yellow-400 to-amber-500',
    bgGradient: 'from-yellow-50 to-amber-50',
    recommended: true,
    features: [
      { text: '无限游戏', included: true },
      { text: '全部词库', included: true },
      { text: '高级统计', included: true },
      { text: 'AI智能辅导', included: false },
      { text: '个性化学习路径', included: false },
      { text: '学习报告导出', included: true },
      { text: '考前预测', included: false },
      { text: '优先客服', included: false },
    ],
  },
  {
    key: 'premium',
    name: '高级会员',
    price: '¥49',
    icon: Star,
    color: 'purple',
    gradient: 'from-purple-500 to-violet-600',
    bgGradient: 'from-purple-50 to-violet-50',
    features: [
      { text: '无限游戏', included: true },
      { text: '全部词库', included: true },
      { text: '高级统计', included: true },
      { text: 'AI智能辅导', included: true },
      { text: '个性化学习路径', included: true },
      { text: '学习报告导出', included: true },
      { text: '考前预测', included: true },
      { text: '优先客服', included: true },
    ],
  },
];

const FEATURE_COMPARISON = [
  { label: '每日游戏次数', free: '5次', vip: '无限', premium: '无限' },
  { label: '单词库', free: '基础', vip: '全部', premium: '全部' },
  { label: '学习统计', free: '基础', vip: '高级', premium: '高级' },
  { label: 'AI智能辅导', free: '✕', vip: '✕', premium: '✓' },
  { label: '个性化学习路径', free: '✕', vip: '✕', premium: '✓' },
  { label: '学习报告导出', free: '✕', vip: '✓', premium: '✓' },
  { label: '考前预测', free: '✕', vip: '✕', premium: '✓' },
  { label: '优先客服', free: '✕', vip: '✕', premium: '✓' },
  { label: '价格', free: '免费', vip: '¥29/月', premium: '¥49/月' },
];

export default function Membership() {
  const { tier, setTier } = useMembershipStore();
  const navigate = useNavigate();

  const handleUpgrade = (newTier: MembershipTier) => {
    if (newTier === tier) {
      toast.info('你已经是该等级会员');
      return;
    }
    if (newTier === 'free') {
      setTier('free');
      toast.success('已切换到免费体验');
      return;
    }
    setTier(newTier);
    toast.success(`已开通${newTier === 'vip' ? 'VIP会员' : '高级会员'}！`);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <Star className="text-yellow-500" />
          会员中心
        </h1>
        <p className="text-sm text-gray-500 mt-2">解锁全部功能，高效备考</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {TIERS.map((plan) => {
          const isCurrent = tier === plan.key;
          return (
            <div
              key={plan.key}
              className={clsx(
                'card relative overflow-hidden transition-all duration-300',
                isCurrent ? 'ring-2 ring-offset-2 scale-[1.02]' : 'hover:-translate-y-1',
                isCurrent && plan.key === 'free' && 'ring-gray-400',
                isCurrent && plan.key === 'vip' && 'ring-yellow-400',
                isCurrent && plan.key === 'premium' && 'ring-purple-400'
              )}
            >
              {plan.recommended && (
                <div className="absolute top-0 right-0">
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-bold px-4 py-1 rounded-bl-xl shadow-md">
                    推荐
                  </div>
                </div>
              )}

              <div className={clsx(
                'w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-4',
                plan.gradient
              )}>
                <plan.icon size={28} className="text-white" />
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                {plan.price !== '免费' && <span className="text-sm text-gray-400">/月</span>}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feat, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {feat.included ? (
                      <Check size={16} className="text-green-500 shrink-0" />
                    ) : (
                      <X size={16} className="text-gray-300 shrink-0" />
                    )}
                    <span className={feat.included ? 'text-gray-700' : 'text-gray-400'}>
                      {feat.text}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={isCurrent && plan.key !== 'free'}
                className={clsx(
                  'w-full py-2.5 rounded-xl font-semibold text-sm transition-all',
                  isCurrent
                    ? 'bg-gray-100 text-gray-400 cursor-default'
                    : plan.key === 'free'
                      ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      : plan.key === 'vip'
                        ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white hover:from-yellow-500 hover:to-amber-600 shadow-md'
                        : 'bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:from-purple-600 hover:to-violet-700 shadow-md'
                )}
              >
                {isCurrent ? '当前方案' : plan.key === 'free' ? '切换到免费' : '立即开通'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <h2 className="text-lg font-bold text-gray-900 mb-4">功能对比</h2>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">功能</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">
                  <Zap size={14} className="inline mr-1" />
                  免费体验
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-yellow-600">
                  <Star size={14} className="inline mr-1" />
                  VIP会员
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-purple-600">
                  <Star size={14} className="inline mr-1" />
                  高级会员
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_COMPARISON.map((row, i) => (
                <tr key={i} className={clsx(
                  'border-b border-gray-50',
                  i % 2 === 0 && 'bg-gray-50/50'
                )}>
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">{row.label}</td>
                  <td className={clsx(
                    'py-3 px-4 text-sm text-center',
                    row.free === '✓' ? 'text-green-600 font-bold' : row.free === '✕' ? 'text-gray-300' : 'text-gray-600'
                  )}>{row.free}</td>
                  <td className={clsx(
                    'py-3 px-4 text-sm text-center',
                    row.vip === '✓' ? 'text-green-600 font-bold' : row.vip === '✕' ? 'text-gray-300' : 'text-yellow-600 font-medium'
                  )}>{row.vip}</td>
                  <td className={clsx(
                    'py-3 px-4 text-sm text-center',
                    row.premium === '✓' ? 'text-green-600 font-bold' : row.premium === '✕' ? 'text-gray-300' : 'text-purple-600 font-medium'
                  )}>{row.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card bg-gradient-to-r from-purple-50 to-violet-50 border-purple-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shrink-0">
            <MessageSquare size={24} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-1">AI智能辅导</h3>
            <p className="text-sm text-gray-600 mb-3">
              高级会员独享AI智能辅导功能，根据你的学习数据生成个性化学习路径，考前智能预测重点考点，助你高效备考。
            </p>
            {tier !== 'premium' && (
              <button
                onClick={() => handleUpgrade('premium')}
                className="flex items-center gap-1.5 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-violet-600 px-4 py-2 rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all shadow-md"
              >
                <Sparkles size={16} />
                升级高级会员
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}