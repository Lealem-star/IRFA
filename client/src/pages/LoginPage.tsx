import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, LogIn, ShieldCheck, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await login(username.trim(), password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Invalid username or password. Please verify your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen h-screen w-full relative flex flex-col justify-center items-center py-3 px-4 bg-cover bg-center bg-no-repeat selection:bg-blue-100 selection:text-blue-900 overflow-hidden"
      style={{ backgroundImage: "url('/branding/login-bg.jpg')" }}
    >
      {/* Subtle translucent overlay for perfect contrast while keeping the landscape vivid */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/20 to-white/45 pointer-events-none" />

      {/* Main Centered Column */}
      <div className="w-full max-w-[400px] my-auto relative z-10 flex flex-col items-center">
        {/* ================= Institutional Branding Header (Logo & Single-Line Title) ================= */}
        <div className="text-center mb-2.5 flex flex-col items-center">
          {/* 1. Real SVG Logo Emblem - Compact */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 mb-1.5 drop-shadow-[0_4px_12px_rgba(18,49,91,0.2)] transition-transform hover:scale-105 duration-300">
            <img
              src="/branding/irfa-mark.svg"
              alt="Digital Fuel Coupon System Emblem"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/branding/irfa-logo.png';
              }}
            />
          </div>

          {/* 2. Digital Fuel Coupon System Title - Guaranteed Single Line */}
          <h1 className="text-xl sm:text-2xl font-black text-[#12315B] tracking-tight leading-tight text-center drop-shadow-xs whitespace-nowrap">
            Digital Fuel Coupon System
          </h1>
        </div>

        {/* ================= Single Compact White Login Card ================= */}
        <div className="w-full bg-white/95 backdrop-blur-md border border-white/90 rounded-2xl shadow-[0_12px_36px_rgba(16,40,75,0.16)] p-5 sm:p-6">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#1686D9]/10 text-[#1686D9] mb-1 shadow-xs">
              <User size={16} className="fill-[#1686D9]" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">Sign In</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">Access your account to continue</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              className="mb-3.5 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2 shadow-xs"
            >
              <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
              <span className="leading-tight font-medium">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            {/* Username Field */}
            <div>
              <label
                htmlFor="username-input"
                className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1 sr-only"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User size={16} />
                </div>
                <input
                  id="username-input"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  disabled={loading}
                  className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1686D9] focus:bg-white focus:ring-2 focus:ring-[#1686D9]/15 transition-all shadow-xs"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password-input"
                className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1 sr-only"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={16} />
                </div>
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  disabled={loading}
                  className="w-full pl-9 pr-9 py-2 bg-[#f8fafc] border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1686D9] focus:bg-white focus:ring-2 focus:ring-[#1686D9]/15 transition-all shadow-xs"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 py-2.5 px-4 bg-[#1686D9] hover:bg-[#1173bd] active:bg-[#0d5ca8] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-[0_4px_14px_rgba(22,134,217,0.3)] hover:shadow-[0_6px_18px_rgba(22,134,217,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <LogIn size={15} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Secure Access Indicator */}
          <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex flex-col items-center justify-center gap-0.5">
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">
              Secure Access
            </span>
            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 grid place-items-center shadow-xs">
              <ShieldCheck size={12} />
            </div>
          </div>
        </div>

        {/* ================= Compact Footer Credits ================= */}
        <footer className="w-full text-center mt-3 select-text">
          <div className="inline-flex items-center justify-center gap-1.5 text-[10px] text-gray-700 bg-white/75 backdrop-blur-xs px-3 py-1 rounded-lg shadow-xs border border-white/50">
            <span className="font-medium">Powered by Bahir Dar City Administration Office of Agriculture</span>
            <span className="text-gray-400">·</span>
            <span className="font-semibold text-gray-800">Developed by Enqopa Technologies PLC</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
