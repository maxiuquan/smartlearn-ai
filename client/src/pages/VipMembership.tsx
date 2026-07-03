import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, BookOpen, Brain, Star, Shield, Gift } from 'lucide-react';

function IconCrown() {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>;
}
function IconInfinity() {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4z"/></svg>;
}

const PLANS = [
  {
    id: 'monthly',
    name: '月度会员',
    price: 29.9,
    originalPrice: 49.9,
    period: '月',
    color: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    icon: Zap,
    popular: false,
    features: ['全部题库无限刷', '智能错题本', '学习进度追踪', '每日挑战', '基础数据统计'],
  },
  {
    id: 'quarterly',
    name: '季度会员',
    price: 79.9,
    originalPrice: 149.7,
    period: '季',
    color: 'border-[#00FF9C]/30',
    bg: 'bg-[#00FF9C]/10',
    icon: Star,
    popular: true,
    features: ['月度会员全部权益', '真题模拟卷', 'AI弱项分析', '考前冲刺预测', 'VIP学习报告', '优先客服支持'],
  },
  {
    id: 'yearly',
    name: '年度会员',
    price: 299,
    originalPrice: 599,
    period: '年',
    color: 'border-yellow-500/30',
    bg: 'bg-yellow-500/10',
    icon: IconCrown,
    popular: false,
    features: ['季度会员全部权益', '一对一导师辅导', '无限次模考', '全部真题解析', '专属学习路径', '考前押题密卷', '8折购买实体书'],
  },
  {
    id: 'lifetime',
    name: '永久会员',
    price: 699,
    originalPrice: 1999,
    period: '永久',
    color: 'border-purple-500/30',
    bg: 'bg-purple-500/10',
    icon: IconInfinity,
    popular: false,
    features: ['全部功能终身免费', '永久更新', '专属VIP标识', '优先体验新功能', '专属社群', '推广佣金', '定制学习计划'],
  },
];

const BENEFITS = [
  { icon: BookOpen, title: '海量题库', desc: '考研数学2500+真题与模拟题，英语8000+核心词汇' },
  { icon: Brain, title: '智能分析', desc: 'AI精准定位薄弱知识点，针对性强化训练' },
  { icon: Shield, title: '正版保障', desc: '全部内容经专业团队审核，持续更新' },
  { icon: Gift, title: '专属福利', desc: 'VIP专享考前密卷、导师一对一辅导等权益' },
];

export default function VipMembership() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string>('yearly');

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white">← 返回</button>
        </div>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <IconCrown />
          </div>
          <h1 className="text-3xl font-bold">升级VIP会员</h1>
          <p className="text-gray-500 mt-2">解锁全部学习功能，助你高效备考</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div key={benefit.title} className="bg-[#12141A] border border-gray-800 rounded-xl p-4 text-center">
                <Icon className="w-8 h-8 text-[#00FF9C] mx-auto mb-2" />
                <h3 className="text-white font-semibold text-sm">{benefit.title}</h3>
                <p className="text-gray-500 text-xs mt-1">{benefit.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isSelected = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative rounded-xl border-2 p-5 cursor-pointer transition-all ${
                  isSelected ? plan.color + ' scale-[1.02]' : 'border-gray-800 hover:border-gray-600'
                } ${plan.bg}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#00FF9C] text-black text-xs font-bold">
                    最受欢迎
                  </div>
                )}
                <Icon className="w-8 h-8 mb-3" style={{ color: isSelected ? '#00FF9C' : '#666' }} />
                <div className="text-lg font-bold text-white">{plan.name}</div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold text-white">¥{plan.price}</span>
                  <span className="text-gray-600 text-sm">/{plan.period}</span>
                </div>
                {plan.originalPrice > plan.price && (
                  <div className="text-xs text-gray-600 line-through mt-1">
                    ¥{plan.originalPrice}
                  </div>
                )}
                <div className="mt-4 space-y-2">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                      <Check className="w-3 h-3 text-[#00FF9C]" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate(`/payment?plan=${selectedPlan}`)}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold text-lg hover:from-yellow-400 hover:to-yellow-500 transition-all shadow-lg shadow-yellow-500/20"
          >
            立即开通 VIP
          </button>
          <p className="text-gray-600 text-xs mt-2">支持微信支付 / 支付宝 / 银行卡</p>
        </div>

        <div className="mt-12 text-center">
          <h3 className="text-gray-500 text-sm mb-4">已有超过 10,000+ 学员选择 LexiStrike</h3>
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#00FF9C]">10,000+</div>
              <div className="text-xs text-gray-600">付费用户</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#00FF9C]">95%</div>
              <div className="text-xs text-gray-600">续费率</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#00FF9C]">4.9</div>
              <div className="text-xs text-gray-600">用户评分</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}