import React from "react";
import { useAuthStore } from "../store/authStore";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { authApi } from "../services/authApi";

export const DashboardPage: React.FC = () => {
  const { user, accessToken, setUser } = useAuthStore();
  const [isRefreshingProfile, setIsRefreshingProfile] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const handleRefreshProfile = async () => {
    try {
      setIsRefreshingProfile(true);
      setStatusMessage(null);
      const updatedUser = await authApi.getMe();
      setUser(updatedUser);
      setStatusMessage("Profile successfully refreshed from backend!");
    } catch {
      setStatusMessage("Failed to refresh profile from backend.");
    } finally {
      setIsRefreshingProfile(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Welcome Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-slate-900/40 border border-blue-800/40 backdrop-blur-xl">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-blue-400">
            Authenticated Session Active
          </span>
          <h1 className="text-3xl font-extrabold text-white mt-1">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Your FinSight AI workspace is connected and operational.
          </p>
        </div>
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshProfile}
            isLoading={isRefreshingProfile}
          >
            Verify /users/me
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800/60 text-blue-200 text-sm">
          {statusMessage}
        </div>
      )}

      {/* Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
            User Profile
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-slate-400 block text-xs font-semibold uppercase">
                Name
              </span>
              <span className="text-slate-100 font-medium">{user?.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs font-semibold uppercase">
                Email
              </span>
              <span className="text-slate-100 font-medium">{user?.email}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs font-semibold uppercase">
                Role
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-blue-900/40 text-blue-300 border border-blue-800/50">
                {user?.role}
              </span>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">
            Authentication State
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-slate-400 block text-xs font-semibold uppercase">
                Access Token
              </span>
              <p className="font-mono text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 truncate">
                {accessToken || "None"}
              </p>
            </div>
            <div>
              <span className="text-slate-400 block text-xs font-semibold uppercase">
                Refresh Token
              </span>
              <p className="text-xs text-slate-400">
                Managed securely via <code className="text-blue-400">httpOnly</code> cookies with automatic rotation.
              </p>
            </div>
            <div>
              <span className="text-slate-400 block text-xs font-semibold uppercase">
                Backend API URL
              </span>
              <span className="font-mono text-xs text-slate-300">
                {import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;

