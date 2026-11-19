import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import AuthPage from "./pages/AuthPage";
import ChatDashboard from "./pages/ChatDashboard";

function MainApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading ChatPulse Session...</span>
        </div>
      </div>
    );
  }

  return user ? <ChatDashboard /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <MainApp />
      </SocketProvider>
    </AuthProvider>
  );
}
