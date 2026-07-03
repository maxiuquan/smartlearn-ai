import { useState } from 'react';
import { Plus, Edit, Trash2, BookOpen, Brain } from 'lucide-react';

export default function AdminContent() {
  const [activeTab, setActiveTab] = useState<'math' | 'english'>('math');
  const [mathQuestions, setMathQuestions] = useState([
    { id: '1', type: '选择题', category: '数一', difficulty: '中等', question: '极限 lim(x→0) sin(x)/x = ?', answer: '1', count: 0 },
    { id: '2', type: '填空题', category: '数二', difficulty: '简单', question: '求导: d/dx (x²)', answer: '2x', count: 0 },
    { id: '3', type: '解答题', category: '数三', difficulty: '困难', question: '证明: 若 f 在 [a,b] 上连续，则...', answer: '略', count: 0 },
  ]);
  const [englishWords, setEnglishWords] = useState([
    { id: '1', level: '考研', word: 'abandon', meaning: '放弃', example: 'He abandoned his plan.', count: 0 },
    { id: '2', level: 'CET6', word: 'benevolent', meaning: '仁慈的', example: 'a benevolent smile', count: 0 },
    { id: '3', level: 'CET4', word: 'capital', meaning: '首都；资本', example: 'Beijing is the capital.', count: 0 },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">内容管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理题库和词库</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00FF9C] text-black font-bold text-sm hover:bg-[#00CC7A] transition-colors">
          <Plus className="w-4 h-4" /> 添加内容
        </button>
      </div>

      <div className="flex gap-2 bg-[#12141A] rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('math')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'math' ? 'bg-[#00FF9C]/10 text-[#00FF9C]' : 'text-gray-500 hover:text-white'
          }`}
        >
          <Brain className="w-4 h-4" /> 数学题库
        </button>
        <button
          onClick={() => setActiveTab('english')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'english' ? 'bg-[#00FF9C]/10 text-[#00FF9C]' : 'text-gray-500 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" /> 英语词库
        </button>
      </div>

      {activeTab === 'math' ? (
        <div className="bg-[#12141A] border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-gray-500 text-xs font-medium">题型</th>
                <th className="text-left p-4 text-gray-500 text-xs font-medium">分类</th>
                <th className="text-left p-4 text-gray-500 text-xs font-medium">难度</th>
                <th className="text-left p-4 text-gray-500 text-xs font-medium">题目</th>
                <th className="text-left p-4 text-gray-500 text-xs font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {mathQuestions.map((q) => (
                <tr key={q.id} className="border-b border-gray-800/50 hover:bg-white/5">
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      q.type === '选择题' ? 'bg-blue-500/20 text-blue-400' :
                      q.type === '填空题' ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'
                    }`}>{q.type}</span>
                  </td>
                  <td className="p-4 text-white text-sm">{q.category}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      q.difficulty === '简单' ? 'bg-green-500/20 text-green-400' :
                      q.difficulty === '中等' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                    }`}>{q.difficulty}</span>
                  </td>
                  <td className="p-4 text-gray-300 text-sm max-w-md truncate">{q.question}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-400"><Edit className="w-4 h-4" /></button>
                      <button className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-[#12141A] border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-gray-500 text-xs font-medium">级别</th>
                <th className="text-left p-4 text-gray-500 text-xs font-medium">单词</th>
                <th className="text-left p-4 text-gray-500 text-xs font-medium">释义</th>
                <th className="text-left p-4 text-gray-500 text-xs font-medium">例句</th>
                <th className="text-left p-4 text-gray-500 text-xs font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {englishWords.map((w) => (
                <tr key={w.id} className="border-b border-gray-800/50 hover:bg-white/5">
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">{w.level}</span>
                  </td>
                  <td className="p-4 text-white font-mono text-sm">{w.word}</td>
                  <td className="p-4 text-gray-300 text-sm">{w.meaning}</td>
                  <td className="p-4 text-gray-500 text-xs max-w-xs truncate">{w.example}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-400"><Edit className="w-4 h-4" /></button>
                      <button className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}