import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import "./App.css";
import { AchievementToast } from "./components/AchievementToast";
import { Layout } from "./components/Layout";
import { useAchievements } from "./hooks/useAchievements";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import { LocaleProvider } from "./hooks/useLocale.jsx";
import { ProfileProvider } from "./hooks/useProfile.jsx";
import { AuthPage } from "./pages/AuthPage";
import { LandingPage } from "./pages/LandingPage";
import { LearnPage } from "./pages/LearnPage";
import { MentorPage } from "./pages/MentorPage";
import { PlaygroundPage } from "./pages/PlaygroundPage";
import { ProfilePage } from "./pages/ProfilePage";


function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-loading">Loading your workspace...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
}


function AppRoutes() {
  const achievementUi = useAchievements();

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/learn"
          element={
            <ProtectedRoute>
              <Layout>
                <LearnPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/learn/:taskId"
          element={
            <ProtectedRoute>
              <Layout>
                <PlaygroundPage achievementUi={achievementUi} />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/playground"
          element={
            <ProtectedRoute>
              <Layout>
                <PlaygroundPage achievementUi={achievementUi} />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <ProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor"
          element={
            <ProtectedRoute>
              <Layout>
                <MentorPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/learn" replace />} />
      </Routes>

      <div className="toast-stack">
        {achievementUi.toasts.map((toast) => (
          <AchievementToast
            key={toast.toastId}
            toast={toast}
            onDone={() => achievementUi.removeToast(toast.toastId)}
          />
        ))}
      </div>
    </>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <LocaleProvider>
        <ProfileProvider>
          <AppRoutes />
        </ProfileProvider>
      </LocaleProvider>
    </AuthProvider>
  );
}
