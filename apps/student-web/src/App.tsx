import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// 现有游戏页面
import GameHall from './pages/GameHall';
import WordGame from './pages/WordGame';
import MathGame from './pages/MathGame';
import CrossSubjectGame from './pages/CrossSubjectGame';
import GameResult from './pages/GameResult';

// 新增功能页面
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VocabLearning from './pages/VocabLearning';
import MathLearning from './pages/MathLearning';
import QuestionPractice from './pages/QuestionPractice';
import PastExam from './pages/PastExam';
import AITutor from './pages/AITutor';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';

function App() {
  return (
    <Routes>
      {/* 登录页不需要 Layout / ProtectedRoute */}
      <Route path="/login" element={<Login />} />

      {/* 受保护路由 — 共享 Layout 布局 */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/vocab"
        element={
          <ProtectedRoute>
            <Layout>
              <VocabLearning />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/math"
        element={
          <ProtectedRoute>
            <Layout>
              <MathLearning />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/practice"
        element={
          <ProtectedRoute>
            <Layout>
              <QuestionPractice />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam"
        element={
          <ProtectedRoute>
            <Layout>
              <PastExam />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-tutor"
        element={
          <ProtectedRoute>
            <Layout>
              <AITutor />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* 游戏路由 — 受保护，但保留原有无 Layout 的全屏体验 */}
      <Route
        path="/games"
        element={
          <ProtectedRoute>
            <Layout>
              <GameHall />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/game/:gameId"
        element={
          <ProtectedRoute>
            <Layout>
              <WordGame />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/math-game/:gameId"
        element={
          <ProtectedRoute>
            <Layout>
              <MathGame />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cross-game/:gameId"
        element={
          <ProtectedRoute>
            <Layout>
              <CrossSubjectGame />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/result/:sessionId"
        element={
          <ProtectedRoute>
            <Layout>
              <GameResult />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Leaderboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* 根路径重定向到 Dashboard */}
      <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <p className="text-6xl mb-4">🔍</p>
            <p className="text-2xl text-gray-600 mb-4">页面不存在</p>
            <a href="/dashboard" className="text-blue-500 hover:underline">
              返回首页
            </a>
          </div>
        }
      />
    </Routes>
  );
}

export default App;
