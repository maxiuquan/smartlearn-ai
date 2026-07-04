import { Routes, Route } from 'react-router-dom';
import GameHall from './pages/GameHall';
import WordGame from './pages/WordGame';
import MathGame from './pages/MathGame';
import CrossSubjectGame from './pages/CrossSubjectGame';
import GameResult from './pages/GameResult';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors">
            SmartLearn AI
          </a>
          <span className="text-sm text-gray-500">学生端 · 趣味学习</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<GameHall />} />
          <Route path="/game/:gameId" element={<WordGame />} />
          <Route path="/math-game/:gameId" element={<MathGame />} />
          <Route path="/cross-game/:gameId" element={<CrossSubjectGame />} />
          <Route path="/result/:sessionId" element={<GameResult />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;