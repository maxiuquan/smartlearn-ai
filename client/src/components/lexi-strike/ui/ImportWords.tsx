import React, { useState, useRef } from 'react';
import { Upload, Check, X } from 'lucide-react';

interface ImportWordsProps {
  onImport: (jsonString: string) => boolean;
  onClose: () => void;
}

const ImportWords: React.FC<ImportWordsProps> = ({ onImport, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ en: string; zh: string }[]>([]);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('格式错误');
        const filtered = parsed.filter((item: any) => item.en && item.zh);
        setPreview(filtered.slice(0, 20));
      } catch {
        setPreview([]);
        setStatus('error');
        setMessage('文件解析失败，请检查JSON格式');
      }
    };
    reader.readAsText(f);
  };

  const handleImport = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const success = onImport(text);
      if (success) {
        setStatus('success');
        setMessage('词库导入成功!');
        setTimeout(onClose, 1500);
      } else {
        setStatus('error');
        setMessage('导入失败，请检查格式: [{"en":"word","zh":"释义"}]');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0A0A] z-20 px-6">
      <div className="max-w-md w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">导入自定义词库</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-400">
          支持 JSON 格式。文件必须包含 <code className="text-[#00FF9C]">en</code> 和 <code className="text-[#00FF9C]">zh</code> 字段。
        </p>

        <label className="block w-full p-8 border-2 border-dashed border-gray-600 rounded-xl text-center cursor-pointer hover:border-[#00FF9C]/50 transition-colors">
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFile} className="hidden" />
          <Upload size={32} className="mx-auto text-gray-500 mb-2" />
          <p className="text-gray-400 text-sm">点击上传 JSON 文件</p>
          {file && <p className="text-[#00FF9C] text-xs mt-1">{file.name}</p>}
        </label>

        {status === 'success' && (
          <div className="flex items-center gap-2 text-[#00FF9C]">
            <Check size={16} /> {message}
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 text-[#FF4757]">
            <X size={16} /> {message}
          </div>
        )}

        {preview.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">预览（前{Math.min(20, preview.length)}条）：</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {preview.map((p, i) => (
                <div key={i} className="flex justify-between text-xs p-2 rounded bg-[#1A1D24]">
                  <span className="text-white">{p.en}</span>
                  <span className="text-gray-400">{p.zh}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleImport}
              className="w-full py-2 rounded-lg bg-[#00FF9C]/20 text-[#00FF9C] font-bold hover:bg-[#00FF9C]/30 transition-colors"
            >
              确认导入 ({preview.length} 个单词)
            </button>
          </div>
        )}

        <div className="text-xs text-gray-600">
          <p className="font-bold mb-1">JSON 格式示例：</p>
          <pre className="bg-[#0D0F14] p-2 rounded overflow-x-auto">
{`[{"en": "abandon", "zh": "放弃"},
 {"en": "benefit", "zh": "利益"}]`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ImportWords;