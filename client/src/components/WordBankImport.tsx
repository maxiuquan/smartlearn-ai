import { useState, useRef } from 'react';
import { Upload, FileText, X, Check, AlertTriangle, Download, BarChart3, Sparkles } from 'lucide-react';
import { toast } from '../store/toast';

interface ImportPreview {
  format: string;
  total: number;
  newCount: number;
  duplicateCount: number;
  sample: { word: string; phonetic?: string; definition: string; difficulty: string }[];
  errors: { line: number; reason: string }[];
}

interface ImportStats {
  total: number;
  byCategory: { category: string; count: number }[];
  byDifficulty: { difficulty: string; count: number }[];
}

const SAMPLE_CSV = `word,phonetic,definition,example,pos,difficulty
ephemeral,ɪˈfemərəl,短暂的;瞬息的,The beauty of cherry blossoms is ephemeral.,adj,hard
ubiquitous,juːˈbɪkwɪtəs,无所不在的,Smartphones have become ubiquitous in modern life.,adj,hard
`;

const SAMPLE_JSON = `[
  {"word": "serendipity", "phonetic": "ˌserənˈdɪpəti", "definition": "意外发现美好事物的能力", "exampleSentence": "Meeting my best friend was pure serendipity.", "partOfSpeech": "n", "difficulty": "hard"},
  {"word": "petrichor", "phonetic": "ˈpetrɪkɔːr", "definition": "雨后泥土的清香", "partOfSpeech": "n", "difficulty": "medium"}
]`;

const SAMPLE_TXT = `aberration\t偏离;异常\nacumen\t敏锐;聪明\nalacrity\t敏捷;欣然`;

export function WordBankImport({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('words.csv');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; failed: number } | null>(null);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/word-import/stats');
      const data = await res.json();
      setStats(data);
    } catch {
      toast.error('加载统计失败');
    }
  };

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setContent(text);
      setFilename(file.name);
      setPreview(null);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!content.trim()) {
      toast.error('请先输入或上传词库内容');
      return;
    }
    try {
      const res = await fetch('/api/word-import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPreview(data);
      setResult(null);
    } catch (err) {
      toast.error('预览失败: ' + (err as Error).message);
    }
  };

  const handleImport = async () => {
    if (!content.trim()) {
      toast.error('请先输入或上传词库内容');
      return;
    }
    setImporting(true);
    try {
      const res = await fetch('/api/word-import/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename, skipExisting: true }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult({ imported: data.imported, skipped: data.skipped, failed: data.failed });
      toast.success(`成功导入 ${data.imported} 个新词${data.skipped > 0 ? `，跳过 ${data.skipped} 个已存在` : ''}`);
      await loadStats();
      onSuccess?.();
    } catch (err) {
      toast.error('导入失败: ' + (err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const loadSample = (type: 'csv' | 'json' | 'txt') => {
    if (type === 'csv') {
      setContent(SAMPLE_CSV);
      setFilename('words.csv');
    } else if (type === 'json') {
      setContent(SAMPLE_JSON);
      setFilename('words.json');
    } else {
      setContent(SAMPLE_TXT);
      setFilename('words.txt');
    }
    setPreview(null);
    setResult(null);
  };

  return (
    <div className='fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in' onClick={onClose}>
      <div
        className='bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='sticky top-0 bg-white border-b border-gray-200 p-5 flex items-center justify-between z-10'>
          <div className='flex items-center gap-2'>
            <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center'>
              <Upload className='w-5 h-5 text-white' />
            </div>
            <div>
              <h2 className='text-xl font-bold text-gray-900'>词库批量导入</h2>
              <p className='text-xs text-gray-500'>支持 CSV / JSON / Anki TXT 格式</p>
            </div>
          </div>
          <button onClick={onClose} className='text-gray-500 hover:text-gray-700'>
            <X size={20} />
          </button>
        </div>

        <div className='p-5 space-y-5'>
          {stats && (
            <div className='bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100'>
              <div className='flex items-center gap-2 mb-2'>
                <BarChart3 size={16} className='text-blue-600' />
                <h3 className='text-sm font-semibold text-blue-900'>当前词库统计</h3>
              </div>
              <div className='grid grid-cols-3 gap-3 text-center'>
                <div>
                  <p className='text-2xl font-bold text-blue-600'>{stats.total}</p>
                  <p className='text-xs text-gray-500'>总单词数</p>
                </div>
                <div>
                  <p className='text-2xl font-bold text-blue-600'>{stats.byCategory.length}</p>
                  <p className='text-xs text-gray-500'>分类数</p>
                </div>
                <div>
                  <p className='text-2xl font-bold text-blue-600'>{stats.byDifficulty.length}</p>
                  <p className='text-xs text-gray-500'>难度等级</p>
                </div>
              </div>
              {stats.byCategory.length > 0 && (
                <div className='mt-3 flex flex-wrap gap-2'>
                  {stats.byCategory.map(c => (
                    <span key={c.category} className='text-xs bg-white px-2 py-1 rounded-full border border-blue-200'>
                      {c.category}: {c.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className='text-sm font-medium text-gray-700 block mb-2'>选择文件 / 粘贴内容</label>
            <div className='flex flex-wrap gap-2 mb-2'>
              <button
                onClick={() => fileInputRef.current?.click()}
                className='px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-1.5'
              >
                <FileText size={14} />
                选择文件
              </button>
              <button onClick={() => loadSample('csv')} className='px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200'>
                示例 CSV
              </button>
              <button onClick={() => loadSample('json')} className='px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200'>
                示例 JSON
              </button>
              <button onClick={() => loadSample('txt')} className='px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200'>
                示例 Anki
              </button>
              <button onClick={loadStats} className='ml-auto px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1.5'>
                <BarChart3 size={14} />
                刷新统计
              </button>
            </div>
            <input
              ref={fileInputRef}
              type='file'
              accept='.csv,.json,.txt,.tsv,.anki'
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className='hidden'
            />
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setPreview(null); setResult(null); }}
              placeholder='将 CSV / JSON / Anki TXT 内容粘贴到此处，或点击上方按钮加载示例...'
              className='w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-400'
            />
            <p className='text-xs text-gray-500 mt-1'>
              文件: <span className='font-mono'>{filename}</span> · {content.length} 字符
            </p>
          </div>

          {preview && (
            <div className='bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-3'>
              <div className='flex items-center gap-2'>
                <Sparkles size={16} className='text-blue-600' />
                <h3 className='text-sm font-semibold text-blue-900'>预览结果</h3>
              </div>
              <div className='grid grid-cols-3 gap-2 text-center'>
                <div className='bg-white rounded-lg p-2 border border-blue-100'>
                  <p className='text-xs text-gray-500'>总解析</p>
                  <p className='text-lg font-bold text-blue-600'>{preview.total}</p>
                </div>
                <div className='bg-white rounded-lg p-2 border border-green-100'>
                  <p className='text-xs text-gray-500'>待导入</p>
                  <p className='text-lg font-bold text-green-600'>{preview.newCount}</p>
                </div>
                <div className='bg-white rounded-lg p-2 border border-yellow-100'>
                  <p className='text-xs text-gray-500'>已存在</p>
                  <p className='text-lg font-bold text-yellow-600'>{preview.duplicateCount}</p>
                </div>
              </div>
              <p className='text-xs text-gray-500'>检测格式: <span className='font-mono font-bold text-blue-700'>{preview.format}</span></p>
              {preview.sample.length > 0 && (
                <div>
                  <p className='text-xs text-gray-500 mb-1'>前 5 条样本:</p>
                  <div className='space-y-1 max-h-32 overflow-y-auto'>
                    {preview.sample.map((s, i) => (
                      <div key={i} className='bg-white rounded p-1.5 text-xs flex items-center gap-2 border border-gray-100'>
                        <span className='font-bold text-gray-900'>{s.word}</span>
                        {s.phonetic && <span className='text-gray-400 font-mono'>{s.phonetic}</span>}
                        <span className='text-gray-600 truncate flex-1'>{s.definition}</span>
                        <span className='text-[10px] text-gray-400'>{s.difficulty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {preview.errors.length > 0 && (
                <div className='bg-yellow-50 rounded p-2 border border-yellow-200'>
                  <div className='flex items-center gap-1 text-xs text-yellow-700'>
                    <AlertTriangle size={12} />
                    <span>{preview.errors.length} 条解析警告（前5条）</span>
                  </div>
                  <ul className='text-xs text-yellow-600 mt-1 space-y-0.5'>
                    {preview.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>· 第 {e.line} 行: {e.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className='bg-green-50 rounded-xl p-4 border border-green-200 space-y-2'>
              <div className='flex items-center gap-2'>
                <Check size={16} className='text-green-600' />
                <h3 className='text-sm font-semibold text-green-900'>导入完成</h3>
              </div>
              <div className='grid grid-cols-3 gap-2 text-center'>
                <div>
                  <p className='text-2xl font-bold text-green-600'>{result.imported}</p>
                  <p className='text-xs text-gray-500'>新增</p>
                </div>
                <div>
                  <p className='text-2xl font-bold text-yellow-600'>{result.skipped}</p>
                  <p className='text-xs text-gray-500'>跳过</p>
                </div>
                <div>
                  <p className='text-2xl font-bold text-red-600'>{result.failed}</p>
                  <p className='text-xs text-gray-500'>失败</p>
                </div>
              </div>
            </div>
          )}

          <div className='flex gap-2 sticky bottom-0 bg-white pt-3 border-t border-gray-100'>
            <button
              onClick={handlePreview}
              disabled={!content.trim()}
              className='flex-1 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-medium hover:bg-blue-100 disabled:opacity-50'
            >
              预览
            </button>
            <button
              onClick={handleImport}
              disabled={!content.trim() || importing}
              className='flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2'
            >
              {importing ? (
                <div className='animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent' />
              ) : (
                <Upload size={16} />
              )}
              开始导入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
