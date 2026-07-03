import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { GeneratedArticle } from '../types';
import { ArrowLeft, FileText, CheckCircle2, XCircle } from 'lucide-react';

export default function EnglishArticle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<GeneratedArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getArticle(Number(id)).then((data) => {
      setArticle(data as GeneratedArticle);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleAnswerSelect = (questionId: number, answer: string) => {
    if (showAnswers) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">文章不存在</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/english')}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={18} />
        返回英语学习
      </button>

      <div className="card">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
          <FileText className="text-purple-600" />
          {article.title}
        </h1>

        <div className="flex flex-wrap gap-1 mb-4">
          {article.words.map((w, i) => (
            <span key={i} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full font-medium">
              {w.word}
            </span>
          ))}
        </div>

        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
          {article.content}
        </div>

        {article.words.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <h3 className="text-sm font-medium text-gray-700 mb-3">本文包含的单词：</h3>
            <div className="space-y-2">
              {article.words.map((w, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="font-medium text-purple-700">{w.word}</span>
                  <span className="text-sm text-gray-500">{w.definition}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {article.questions && article.questions.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">阅读理解</h2>
            {!showAnswers && Object.keys(userAnswers).length > 0 && (
              <button onClick={() => setShowAnswers(true)} className="btn-secondary text-sm">
                提交并查看答案
              </button>
            )}
            {showAnswers && (
              <button onClick={() => setShowAnswers(false)} className="btn-secondary text-sm">
                重新作答
              </button>
            )}
          </div>

          <div className="space-y-6">
            {article.questions.map((q, idx) => (
              <div key={q.id} className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm font-medium text-gray-900 mb-3">
                  {idx + 1}. {q.question}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = userAnswers[q.id] === opt;
                    const isCorrectAnswer = opt === q.answer;
                    return (
                      <button
                        key={optIdx}
                        onClick={() => handleAnswerSelect(q.id, opt)}
                        className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all ${
                          showAnswers
                            ? isCorrectAnswer
                              ? 'bg-green-100 border-2 border-green-400 text-green-800'
                              : isSelected && !isCorrectAnswer
                                ? 'bg-red-100 border-2 border-red-400 text-red-800'
                                : 'bg-white border border-gray-200 text-gray-600'
                            : isSelected
                              ? 'bg-purple-100 border-2 border-purple-400 text-purple-800'
                              : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="font-medium mr-2">{String.fromCharCode(65 + optIdx)}.</span>
                        {opt}
                        {showAnswers && isCorrectAnswer && (
                          <CheckCircle2 className="inline ml-2 text-green-600" size={16} />
                        )}
                        {showAnswers && isSelected && !isCorrectAnswer && (
                          <XCircle className="inline ml-2 text-red-600" size={16} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}