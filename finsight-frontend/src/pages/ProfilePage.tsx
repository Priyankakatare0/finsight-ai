import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User as UserIcon,
  Shield,
  Key,
  Copy,
  Check,
  RefreshCw,
  Server,
  FileText,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { authApi } from "../services/authApi";

export const ProfilePage: React.FC = () => {
  const { user, accessToken, setUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleRefreshProfile = async () => {
    try {
      setIsRefreshing(true);
      setStatusMessage(null);
      const updatedUser = await authApi.getMe();
      setUser(updatedUser);
      setStatusMessage({
        type: "success",
        text: "Profile data successfully verified and updated from /users/me!",
      });
    } catch {
      setStatusMessage({
        type: "error",
        text: "Failed to refresh profile from backend. Please verify your connection.",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyToken = () => {
    if (!accessToken) return;
    navigator.clipboard.writeText(accessToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyUserId = () => {
    if (!user?._id) return;
    navigator.clipboard.writeText(user._id);
    setCopiedUserId(true);
    setTimeout(() => setCopiedUserId(false), 2000);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await authApi.logout();
    } catch {
      // Continue client-side logout
    } finally {
      logout();
      setIsLoggingOut(false);
      navigate("/login");
    }
  };

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in-50 duration-200">
      {/* Top Banner / Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900/60 border border-blue-800/40 p-6 md:p-8 backdrop-blur-xl shadow-xl shadow-blue-950/20">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white text-3xl shadow-lg shadow-blue-500/25 ring-2 ring-blue-400/30">
                {initial}
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 ring-2 ring-slate-950" />
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-blue-900/60 text-blue-300 border border-blue-700/50">
                  {user?.role || "USER"}
                </span>
                <span className="inline-flex items-center text-xs text-emerald-400 font-medium">
                  • Active Session
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {user?.name || "User Profile"}
              </h1>
              <p className="text-sm text-slate-300">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshProfile}
              isLoading={isRefreshing}
              className="border-blue-700/50 hover:bg-blue-950/50 text-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Verify /users/me
            </Button>
          </div>
        </div>
      </div>

      {/* Status message */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start space-x-3 transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border border-emerald-800/60 text-emerald-200"
              : "bg-red-950/40 border border-red-800/60 text-red-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Shield className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Grid of Profile and Auth Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Profile Details */}
        <Card className="space-y-5 border-slate-800/90 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <UserIcon className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold text-white">Profile Details</h2>
            </div>
            <span className="text-xs text-slate-400">Account Info</span>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider mb-1">
                Full Name
              </span>
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 font-medium text-slate-100">
                {user?.name || "N/A"}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider mb-1">
                Email Address
              </span>
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 font-medium text-slate-100">
                {user?.email || "N/A"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider mb-1">
                  Assigned Role
                </span>
                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-blue-900/40 text-blue-300 border border-blue-800/50">
                    {user?.role || "USER"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider mb-1">
                  Account Status
                </span>
                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Active & Verified</span>
                </div>
              </div>
            </div>

            {user?._id && (
              <div>
                <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider mb-1">
                  User ID
                </span>
                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between">
                  <code className="text-xs text-slate-300 font-mono truncate mr-2">
                    {user._id}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyUserId}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Copy User ID"
                  >
                    {copiedUserId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Authentication State Details */}
        <Card className="space-y-5 border-slate-800/90 bg-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Key className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Authentication State</h2>
            </div>
            <span className="text-xs text-slate-400">Security & Token</span>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Access Token (Bearer)
                </span>
                {accessToken && (
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="inline-flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {copiedToken ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy token</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 break-all select-all max-h-24 overflow-y-auto">
                {accessToken || "None"}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider mb-1">
                Refresh Token
              </span>
              <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 text-xs text-slate-400 space-y-1">
                <p>
                  Managed securely via{" "}
                  <code className="text-blue-400 font-mono">httpOnly</code> cookies with automatic rotation.
                </p>
                <p className="text-[11px] text-slate-500">
                  Protected from cross-site scripting (XSS) client-side access.
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-1.5 mb-1">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  Backend API URL
                </span>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                <span className="font-mono text-xs text-slate-300">
                  {import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions Footer */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold text-slate-200">FinSight AI Navigation</p>
          <p className="text-xs text-slate-400">Quickly jump back into your financial documents or chat</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/documents">
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Documents
            </Button>
          </Link>
          <Link to="/chat">
            <Button variant="outline" size="sm" className="gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Chat Assistant
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={handleLogout}
            isLoading={isLoggingOut}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
