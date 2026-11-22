import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  User as UserIcon,
  LogOut,
  ChevronDown,
  FileText,
  MessageSquare,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../services/authApi";
import { Button } from "./ui/button";

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside & keyboard escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await authApi.logout();
    } catch {
      // Continue client-side logout even if network fails
    } finally {
      logout();
      setIsLoggingOut(false);
      setIsProfileMenuOpen(false);
      navigate("/login");
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Main Navigation */}
        <div className="flex items-center space-x-8">
          <Link
            to={isAuthenticated ? "/documents" : "/login"}
            className="flex items-center space-x-3 group"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 font-bold text-white text-lg group-hover:scale-105 transition-transform">
              F
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              FinSight AI
            </span>
          </Link>

          {isAuthenticated && (
            <nav className="hidden md:flex items-center space-x-1">
              <Link
                to="/chat"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/chat") || location.pathname.startsWith("/chat/")
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                Chat
              </Link>
              <Link
                to="/documents"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/documents")
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                Documents
              </Link>
            </nav>
          )}
        </div>

        {/* Right Section: Profile Menu or Auth Buttons */}
        <div className="flex items-center space-x-4">
          {isAuthenticated && user ? (
            <div className="relative" ref={menuRef}>
              {/* Profile Trigger Button */}
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className={`flex items-center space-x-3 p-1.5 sm:px-3 sm:py-2 rounded-xl transition-all border ${
                  isProfileMenuOpen
                    ? "bg-slate-800/90 border-slate-700 shadow-lg text-white"
                    : "bg-slate-900/50 hover:bg-slate-800/60 border-slate-800/80 text-slate-200"
                }`}
                aria-haspopup="true"
                aria-expanded={isProfileMenuOpen}
              >
                {/* User Avatar */}
                <div className="relative">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white text-sm shadow-sm">
                    {initial}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-slate-950" />
                </div>

                {/* Name (Hidden on mobile) */}
                <span className="text-sm font-medium text-slate-200 hidden sm:inline-block max-w-[150px] truncate">
                  {user.name}
                </span>

                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    isProfileMenuOpen ? "rotate-180 text-white" : ""
                  }`}
                />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
                  {/* User Summary Header */}
                  <div className="px-3 py-2.5 border-b border-slate-800/80">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white text-base shadow-sm shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">
                          {user.name}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {user.email}
                        </p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-blue-900/50 text-blue-300 border border-blue-700/50 mt-1">
                          {user.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Menu Options */}
                  <div className="py-1.5 space-y-0.5">
                    <Link
                      to="/profile"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive("/profile")
                          ? "bg-blue-600/20 text-blue-300 border border-blue-600/30"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                      }`}
                    >
                      <UserIcon className="w-4 h-4 text-blue-400 shrink-0" />
                      <div className="flex-1">
                        <p className="leading-none">Profile</p>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          View details & credentials
                        </span>
                      </div>
                    </Link>

                    {/* Quick navigation for mobile views */}
                    <div className="md:hidden pt-1 border-t border-slate-800/60 mt-1">
                      <Link
                        to="/chat"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive("/chat")
                            ? "bg-slate-800 text-white"
                            : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                        }`}
                      >
                        <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>Chat</span>
                      </Link>
                      <Link
                        to="/documents"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive("/documents")
                            ? "bg-slate-800 text-white"
                            : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                        }`}
                      >
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>Documents</span>
                      </Link>
                    </div>
                  </div>

                  {/* Divider & Logout */}
                  <div className="pt-1 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors disabled:opacity-50"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>{isLoggingOut ? "Signing out..." : "Log out"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="default" size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
