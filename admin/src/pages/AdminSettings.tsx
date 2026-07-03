import { useState } from 'react';
import { Save, Globe, Bell, Shield, Key, Database, RefreshCw, Wallet } from 'lucide-react';

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    siteName: 'LexiStrike Global',
    siteDesc: '智能化三端学习平台',
    corsOrigins: 'http://localhost:5173,https://lexistrike.com',
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPass: '',
    wechatAppId: '',
    alipayAppId: '',
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">系统设置</h1>
        <p className="text-gray-500 text-sm mt-1">全局配置管理</p>
      </div>

      <div className="space-y-4">
        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-[#00FF9C]" />
            <h2 className="text-white font-semibold">站点设置</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-gray-500 text-xs block mb-1">站点名称</label>
              <input
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-gray-700 text-white text-sm focus:border-[#00FF9C] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">站点描述</label>
              <input
                value={settings.siteDesc}
                onChange={(e) => setSettings({ ...settings, siteDesc: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-gray-700 text-white text-sm focus:border-[#00FF9C] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">CORS 允许域名（逗号分隔）</label>
              <input
                value={settings.corsOrigins}
                onChange={(e) => setSettings({ ...settings, corsOrigins: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-gray-700 text-white text-sm focus:border-[#00FF9C] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-[#0066FF]" />
            <h2 className="text-white font-semibold">通知设置</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-500 text-xs block mb-1">SMTP 服务器</label>
              <input
                value={settings.smtpHost}
                onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-gray-700 text-white text-sm focus:border-[#00FF9C] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">SMTP 端口</label>
              <input
                value={settings.smtpPort}
                onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-gray-700 text-white text-sm focus:border-[#00FF9C] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">SMTP 用户</label>
              <input
                value={settings.smtpUser}
                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-gray-700 text-white text-sm focus:border-[#00FF9C] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">SMTP 密码</label>
              <input
                type="password"
                value={settings.smtpPass}
                onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-gray-700 text-white text-sm focus:border-[#00FF9C] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-5 h-5 text-[#FFD700]" />
            <h2 className="text-white font-semibold">支付配置</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-500 text-xs block mb-1">微信 App ID</label>
              <input
                value={settings.wechatAppId}
                onChange={(e) => setSettings({ ...settings, wechatAppId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-gray-700 text-white text-sm focus:border-[#00FF9C] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">支付宝 App ID</label>
              <input
                value={settings.alipayAppId}
                onChange={(e) => setSettings({ ...settings, alipayAppId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-gray-700 text-white text-sm focus:border-[#00FF9C] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-[#12141A] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-purple-400" />
            <h2 className="text-white font-semibold">系统操作</h2>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-gray-700 text-gray-400 text-sm hover:text-white">
              <RefreshCw className="w-4 h-4" /> 清除缓存
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-gray-700 text-gray-400 text-sm hover:text-white">
              <Key className="w-4 h-4" /> 重置密钥
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20">
              <Shield className="w-4 h-4" /> 紧急维护模式
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00FF9C] text-black font-bold hover:bg-[#00CC7A] transition-colors"
      >
        <Save className="w-4 h-4" />
        {saved ? '已保存 ✓' : '保存设置'}
      </button>
    </div>
  );
}