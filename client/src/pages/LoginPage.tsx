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
      className="min-h-screen h-screen w-full relative flex flex-col justify-center items-center py-4 px-4 bg-cover bg-center bg-no-repeat selection:bg-blue-100 selection:text-blue-900 overflow-hidden"
      style={{ backgroundImage: "url('/branding/login-bg.jpg')" }}
    >
      {/* Subtle translucent overlay for perfect contrast while keeping the landscape vivid */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/15 to-white/40 pointer-events-none" />

      {/* Main Centered Column */}
      <div className="w-full max-w-[360px] sm:max-w-[380px] my-auto relative z-10 flex flex-col items-center">
        {/* ================= Institutional Branding Header (Logo & Single-Line Title) ================= */}
        <div className="text-center mb-6 flex flex-col items-center">
          {/* 1. Dedicated System Logo Emblem */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 mb-3 drop-shadow-[0_4px_16px_rgba(18,49,91,0.3)] transition-transform hover:scale-105 duration-300">
            <img
              src="/branding/dfcs-logo.png"
              alt="Digital Fuel Coupon System Emblem"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/branding/irfa-logo.png';
              }}
            />
          </div>

          {/* 2. Digital Fuel Coupon System Title - Single Line */}
          <h1 className="text-2xl sm:text-[26px] font-black text-[#12315B] tracking-tight leading-none text-center drop-shadow-xs whitespace-nowrap">
            Digital Fuel Coupon System
          </h1>
        </div>

        {/* ================= Transparent Login Form Container ================= */}
        <div className="w-full px-2">
          {/* Error Alert */}
          {error && (
            <div
              role="alert"
              className="mb-3.5 p-2.5 bg-red-50/95 backdrop-blur-xs border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2 shadow-sm"
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
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
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
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white/90 hover:bg-white focus:bg-white backdrop-blur-sm border border-white/80 focus:border-[#1686D9] rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1686D9]/20 transition-all shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
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
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
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
                  className="w-full pl-10 pr-10 py-2.5 bg-white/90 hover:bg-white focus:bg-white backdrop-blur-sm border border-white/80 focus:border-[#1686D9] rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1686D9]/20 transition-all shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-800 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-[#1686D9] hover:bg-[#1173bd] active:bg-[#0d5ca8] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-[0_4px_16px_rgba(22,134,217,0.35)] hover:shadow-[0_6px_20px_rgba(22,134,217,0.45)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
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
        </div>
      </div>

      {/* ================= Bottom End Credits (Left & Right Ends) ================= */}
      <footer className="absolute bottom-0 inset-x-0 w-full px-5 sm:px-8 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] font-medium text-gray-800 bg-white/40 backdrop-blur-xs select-text border-t border-white/30 z-20">
        <div className="drop-shadow-2xs">
          Powered by Bahir Dar City Administration Office of Agriculture
        </div>
        <div className="drop-shadow-2xs font-semibold text-gray-900">
          Developed by Enqopa Technologies PLC
        </div>
      </footer>
    </div>
  );
};
