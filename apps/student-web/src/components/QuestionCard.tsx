interface Question {
  question_id: string;
  question_type: string;
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  hint: string | null;
  points: number;
  word?: {
    word: string;
    meaning: string;
    pronunciation?: string;
  };
}

interface QuestionCardProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  onAnswer: (answer: string) => void;
  feedback: { isCorrect: boolean; message: string } | null;
  submitting: boolean;
}

export default function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  onAnswer,
  feedback,
  submitting,
}: QuestionCardProps) {
  const isMultipleChoice = question.question_type === 'multiple_choice';
  const isSpelling = question.question_type === 'spelling';
  const isFillBlank = question.question_type === 'fill_blank';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    if (isMultipleChoice) {
      // 选择题通过点击选项提交
      return;
    }

    const formData = new FormData(e.currentTarget);
    const answer = (formData.get('answer') as string || '').trim();
    if (answer) {
      onAnswer(answer);
      e.currentTarget.reset();
    }
  }

  function handleOptionClick(option: string) {
    if (submitting) return;
    onAnswer(option);
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      {/* 题号 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-500">
          第 {questionIndex + 1} / {totalQuestions} 题
        </span>
        <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium">
          {isMultipleChoice ? '选择题' : isSpelling ? '拼写题' : '填空题'}
        </span>
      </div>

      {/* 题目内容 */}
      <div className="mb-6">
        <p className="text-xl font-medium text-gray-800 mb-2">{question.question_text}</p>

        {question.word?.pronunciation && (
          <p className="text-sm text-gray-400">/{question.word.pronunciation}/</p>
        )}

        {question.hint && (
          <p className="text-sm text-orange-500 mt-2">💡 提示：{question.hint}</p>
        )}
      </div>

      {/* 反馈 */}
      {feedback && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm font-medium ${
            feedback.isCorrect
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* 选择题选项 */}
      {isMultipleChoice && question.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleOptionClick(option)}
              disabled={submitting}
              className="w-full text-left px-4 py-3 rounded-lg border-2 border-gray-200 
                         hover:border-blue-400 hover:bg-blue-50 transition-all 
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-gray-700 font-medium"
            >
              <span className="inline-block w-7 h-7 rounded-full bg-blue-100 text-blue-600 
                               text-center leading-7 mr-3 text-sm font-bold">
                {String.fromCharCode(65 + idx)}
              </span>
              {option}
            </button>
          ))}
        </div>
      )}

      {/* 拼写题 / 填空题 */}
      {(isSpelling || isFillBlank) && (
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            name="answer"
            type="text"
            autoComplete="off"
            disabled={submitting}
            placeholder={isSpelling ? '请输入单词拼写...' : '请输入答案...'}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg 
                       focus:border-blue-400 focus:outline-none text-lg
                       disabled:opacity-50 disabled:cursor-not-allowed"
            autoFocus
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium
                       hover:bg-blue-600 transition-colors disabled:opacity-50
                       disabled:cursor-not-allowed"
          >
            提交
          </button>
        </form>
      )}
    </div>
  );
}