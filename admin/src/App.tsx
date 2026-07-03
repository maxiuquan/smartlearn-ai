import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useState, useEffect } from 'react';
import AdminLayout from './components/AdminLayout';

const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminContent = lazy(() => import('./pages/AdminContent'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const AdminPayments = lazy(() => import('./pages/AdminPayments'));

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      fetch('/api/admin/verify', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()).then(data => {
        setIsAdmin(data.valid);
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-gray-400">加载中...</div>;

  if (!isAdmin) {
    return (
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-gray-400">加载中...</div>}>
          <Routes>
            <Route path="/admin/login" element={<AdminLogin onLogin={() => setIsAdmin(true)} />} />
            <Route path="*" element={<Navigate to="/admin/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AdminLayout onLogout={() => { localStorage.removeItem('admin_token'); setIsAdmin(false); }}>
        <Suspense fallback={<div className="text-gray-400 p-8">加载中...</div>}>
          <Routes>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/content" element={<AdminContent />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </AdminLayout>
    </BrowserRouter>
  );
}

export default App;