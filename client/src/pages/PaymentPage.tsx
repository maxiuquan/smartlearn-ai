import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Shield, ArrowLeft } from 'lucide-react';

function IconWechat({ className }: { className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10.9c0-.9.8-1.7 1.7-1.7h4.6c.9 0 1.7.8 1.7 1.7v.2c0 2.3-1.8 3.4-4 3.4-.3 0-.6 0-.9-.1L9 16v-1.8c-1.2-.6-2-1.7-2-2.9 0-.2 0-.3 0-.4h1z"/><circle cx="12" cy="10" r="10"/></svg>;
}
function IconAlipay({ className }: { className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
}
function IconCard({ className }: { className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
}

const PLANS: Record<string, { name: string; price: number; period: string }> = {
  monthly: { name: '月度会员', price: 29.9, period: '月' },
  quarterly: { name: '季度会员', price: 79.9, period: '季' },
  yearly: { name: '年度会员', price: 299, period: '年' },
  lifetime: { name: '永久会员', price: 699, period: '永久' },
};

const PAYMENT_METHODS = [
  { id: 'wechat', name: '微信支付', Icon: IconWechat },
  { id: 'alipay', name: '支付宝', Icon: IconAlipay },
  { id: 'card', name: '银行卡', Icon: IconCard },
];

export default function PaymentPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const planId = params.get('plan') || 'yearly';
  const plan = PLANS[planId] || PLANS.yearly;
  const [method, setMethod] = useState('wechat');
  const [paid, setPaid] = useState(false);

  const handlePay = () => {
    setPaid(true);
    setTimeout(() => {
      navigate('/vip-membership');
    }, 3000);
  };

  if (paid) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="w-20 h-20 text-[#00FF9C] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">支付成功！</h1>
          <p className="text-gray-500">您已成功开通 {plan.name}</p>
          <p className="text-gray-600 text-sm mt-1">即将跳转...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> 返回
        </button>

        <h1 className="text-2xl font-bold mb-6">确认支付</h1>

        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-5 mb-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400">商品</span>
            <span className="text-white font-bold">{plan.name}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400">时长</span>
            <span className="text-white">1{plan.period}</span>
          </div>
          <div className="border-t border-gray-800 pt-4 flex justify-between items-center">
            <span className="text-gray-400">实付金额</span>
            <span className="text-2xl font-bold text-[#FFD700]">¥{plan.price}</span>
          </div>
        </div>

        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-5 mb-6">
          <h3 className="text-white font-semibold mb-4">支付方式</h3>
          <div className="space-y-2">
            {PAYMENT_METHODS.map((m) => {
              const Icon = m.Icon;
              const isSelected = method === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                    isSelected ? 'border-[#00FF9C] bg-[#00FF9C]/5' : 'border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-[#00FF9C]' : 'text-gray-500'}`} />
                  <span className="text-white">{m.name}</span>
                  {isSelected && <CheckCircle className="w-4 h-4 text-[#00FF9C] ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handlePay}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold text-lg hover:from-yellow-400 hover:to-yellow-500 transition-all shadow-lg"
        >
          ¥{plan.price} 立即支付
        </button>

        <div className="flex items-center justify-center gap-2 mt-4 text-gray-600 text-xs">
          <Shield className="w-3 h-3" />
          支付安全由SSL加密保护
        </div>
      </div>
    </div>
  );
}