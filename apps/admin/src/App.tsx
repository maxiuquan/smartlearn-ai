import React, { useState, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { message } from 'antd';
import { useAuthStore } from '@/stores/authStore';
import { getCurrentUser } from '@/services/authService';
import BasicLayout from '@/layouts/BasicLayout';
import LoginLayout from '@/layouts/LoginLayout';

// 页面组件懒加载
const Dashboard = React.lazy(() => import('@/pages/dashboard'));
const UserList = React.lazy(() => import('@/pages/user/UserList'));
const UserDetail = React.lazy(() => import('@/pages/user/UserDetail'));
const QuestionList = React.lazy(() => import('@/pages/question/QuestionList'));
const QuestionEdit = React.lazy(() => import('@/pages/question/QuestionEdit'));
const QuestionImport = React.lazy(() => import('@/pages/question/QuestionImport'));
const KnowledgeList = React.lazy(() => import('@/pages/knowledge/KnowledgeList'));
const KnowledgeTree = React.lazy(() => import('@/pages/knowledge/KnowledgeTree'));
const SubjectList = React.lazy(() => import('@/pages/subject/SubjectList'));
const WordList = React.lazy(() => import('@/pages/word/WordList'));
const WordBookList = React.lazy(() => import('@/pages/word/WordBookList'));
const PastExamList = React.lazy(() => import('@/pages/pastexam/PastExamList'));
const PastExamDetail = React.lazy(() => import('@/pages/pastexam/PastExamDetail'));
const WorkbookList = React.lazy(() => import('@/pages/workbook/WorkbookList'));
const WorkbookDetail = React.lazy(() => import('@/pages/workbook/WorkbookDetail'));
const Statistics = React.lazy(() => import('@/pages/statistics/Statistics'));
const UserAnalysis = React.lazy(() => import('@/pages/statistics/UserAnalysis'));
const SystemSettings = React.lazy(() => import('@/pages/system/SystemSettings'));

// 加载中组件
const Loading: React.FC = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh' 
  }}>
    加载中...
  </div>
);

// 受保护的路由
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token, user, isAdmin, setCurrentUser, logout } = useAuthStore();
  const [loading, setLoading] = useState<boolean>(!!token && !user);

  useEffect(() => {
    // 已认证但有 token 无 user 时，加载当前用户
    if (isAuthenticated && token && !user) {
      setLoading(true);
      getCurrentUser()
        .then((u) => {
          setCurrentUser(u);
        })
        .catch(() => {
          message.error('获取用户信息失败，请重新登录');
          logout();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, token, user, setCurrentUser, logout]);

  useEffect(() => {
    // 加载完成后非管理员，提示并登出
    if (!loading && isAuthenticated && user && !isAdmin) {
      message.error('需要管理员权限');
      logout();
    }
  }, [loading, isAuthenticated, user, isAdmin, logout]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return <Loading />;
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <React.Suspense fallback={<Loading />}>
        <Routes>
          {/* 登录路由 */}
          <Route path="/login" element={<LoginLayout />}>
            <Route index element={<Login />} />
          </Route>
          
          {/* 主应用路由 */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <BasicLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* 用户管理 */}
            <Route path="user">
              <Route index element={<UserList />} />
              <Route path=":id" element={<UserDetail />} />
            </Route>
            
            {/* 题目管理 */}
            <Route path="question">
              <Route index element={<QuestionList />} />
              <Route path="create" element={<QuestionEdit />} />
              <Route path=":id/edit" element={<QuestionEdit />} />
              <Route path="import" element={<QuestionImport />} />
            </Route>
            
            {/* 知识点管理 */}
            <Route path="knowledge">
              <Route index element={<KnowledgeList />} />
              <Route path="tree" element={<KnowledgeTree />} />
            </Route>
            
            {/* 学科管理 */}
            <Route path="subject">
              <Route index element={<SubjectList />} />
            </Route>
            
            {/* 单词管理 */}
            <Route path="word">
              <Route index element={<WordList />} />
              <Route path="book" element={<WordBookList />} />
            </Route>
            
            {/* 真题管理 */}
            <Route path="pastexam">
              <Route index element={<PastExamList />} />
              <Route path=":id" element={<PastExamDetail />} />
            </Route>
            
            {/* 习题册管理 */}
            <Route path="workbook">
              <Route index element={<WorkbookList />} />
              <Route path=":id" element={<WorkbookDetail />} />
            </Route>
            
            {/* 数据统计 */}
            <Route path="statistics">
              <Route index element={<Statistics />} />
              <Route path="user" element={<UserAnalysis />} />
            </Route>
            
            {/* 系统设置 */}
            <Route path="system">
              <Route index element={<SystemSettings />} />
            </Route>
          </Route>
          
          {/* 404 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
};

// 登录页面组件
const Login: React.FC = () => {
  return null; // 实际实现在 LoginLayout 中
};

export default App;
