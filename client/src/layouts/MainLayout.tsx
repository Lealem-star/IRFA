import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from '../components/common/Sidebar';
import { Topbar } from '../components/common/Topbar';

export const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gov-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-gov-blue border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-gov-muted">Connecting to Digital Fuel Coupon System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex bg-gov-bg text-gov-ink font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar />
        <main className="p-[26px_30px] max-w-[1480px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
