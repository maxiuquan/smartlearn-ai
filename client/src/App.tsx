import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Layout from './components/Layout';
import ToastContainer from './components/ToastContainer';
import ErrorBoundary from './components/ErrorBoundary';
import { PageSkeleton } from './components/Skeleton';
import { useAuthStore } from './store/auth';

const SubjectSelect = lazy(() => import('./pages/SubjectSelect'));
const MathHome = lazy(() => import('./pages/MathHome'));
const EnglishHome = lazy(() => import('./pages/EnglishHome'));
const ChapterSelect = lazy(() => import('./pages/ChapterSelect'));
const MathPractice = lazy(() => import('./pages/MathPractice'));
const KnowledgeGraph = lazy(() => import('./pages/KnowledgeGraph'));
const ErrorAnalysis = lazy(() => import('./pages/ErrorAnalysis'));
const EnglishStudy = lazy(() => import('./pages/EnglishStudy'));
const EnglishArticle = lazy(() => import('./pages/EnglishArticle'));
const EnglishGames = lazy(() => import('./pages/EnglishGames'));
const LexiStrikeGame = lazy(() => import('./pages/LexiStrikeGame'));
const MathExam = lazy(() => import('./pages/MathExam'));
const VipMembership = lazy(() => import('./pages/VipMembership'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const EnglishPath = lazy(() => import('./pages/EnglishPath'));
const MockExam = lazy(() => import('./pages/MockExam'));
const SmartDiagnostic = lazy(() => import('./pages/SmartDiagnostic'));
const StudyReport = lazy(() => import('./pages/StudyReport'));
const ComprehensiveReview = lazy(() => import('./pages/ComprehensiveReview'));
const StudyPlan = lazy(() => import('./pages/StudyPlan'));
const StudyCenter = lazy(() => import('./pages/StudyCenter'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const Membership = lazy(() => import('./pages/Membership'));

function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
        <ToastContainer />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Layout>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<SubjectSelect />} />
            <Route path="/math-home" element={<MathHome />} />
            <Route path="/english-home" element={<EnglishHome />} />
            <Route path="/chapters" element={<ChapterSelect />} />
            <Route path="/math" element={<MathPractice />} />
            <Route path="/knowledge" element={<KnowledgeGraph />} />
            <Route path="/errors" element={<ErrorAnalysis />} />
            <Route path="/english" element={<EnglishStudy />} />
            <Route path="/english/article/:id" element={<EnglishArticle />} />
            <Route path="/english-games" element={<EnglishGames />} />
            <Route path="/lexi-strike" element={<LexiStrikeGame />} />
            <Route path="/math-exam" element={<MathExam />} />
            <Route path="/vip-membership" element={<VipMembership />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/english-path" element={<EnglishPath />} />
            <Route path="/mock-exam" element={<MockExam />} />
            <Route path="/diagnostic" element={<SmartDiagnostic />} />
            <Route path="/report" element={<StudyReport />} />
            <Route path="/review" element={<ComprehensiveReview />} />
            <Route path="/study-plan" element={<StudyPlan />} />
        <Route path="/study-center" element={<StudyCenter />} />
        <Route path="/profile" element={<Profile />} />
            <Route path="/membership" element={<Membership />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
      <ToastContainer />
    </ErrorBoundary>
  );
}

export default App;