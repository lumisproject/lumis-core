import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from '@/stores/useUserStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProjectStore } from '@/stores/useProjectStore';
import Layout from '@/components/layout/Layout';
import Dashboard from '@/pages/Dashboard';
import Chat from '@/pages/Chat';
import Settings from '@/pages/Settings';
import Billing from '@/pages/Billing';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Landing from '@/pages/Landing';
import RiskPage from '@/pages/RiskPage';
import JiraCallback from '@/pages/JiraCallback';
import NewProject from '@/pages/NewProject';


const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useUserStore();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

function App() {
  const { checkSession, setupAuthListener } = useUserStore();

  useEffect(() => {
    checkSession();
    const { unsubscribe } = setupAuthListener();
    return () => unsubscribe();
  }, []);

  const { user } = useUserStore();
  const { setupProjectSubscriptions } = useProjectStore();

  useEffect(() => {
    if (user?.id) {
      const unsub = setupProjectSubscriptions(user.id);
      return () => unsub();
    }
  }, [user?.id, setupProjectSubscriptions]);

  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme || 'light');
    }
  }, [theme]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/jira/callback" element={<JiraCallback />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="chat" element={<Chat />} />
          <Route path="risks" element={<RiskPage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="billing" element={<Billing />} />
          <Route path="new-project" element={<NewProject />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
