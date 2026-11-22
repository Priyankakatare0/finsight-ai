import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "./store/authStore";
import { authApi } from "./services/authApi";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import DocumentsPage from "./pages/DocumentsPage";
import ChatPage from "./pages/ChatPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const AppContent: React.FC = () => {
  const { setAuth, setInitializing, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Attempt silent token refresh via httpOnly cookie on first load
        const data = await authApi.refresh();
        setAuth(data.user, data.accessToken);
      } catch {
        // Not logged in or expired cookie
        setInitializing(false);
      }
    };

    initializeAuth();
  }, [setAuth, setInitializing]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/documents" replace /> : <LoginPage />}
          />
          <Route
            path="/register"
            element={isAuthenticated ? <Navigate to="/documents" replace /> : <RegisterPage />}
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <DocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:conversationId"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          {/* Legacy route alias */}
          <Route path="/dashboard" element={<Navigate to="/profile" replace />} />
          <Route path="/" element={<Navigate to="/documents" replace />} />
          <Route path="*" element={<Navigate to="/documents" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
