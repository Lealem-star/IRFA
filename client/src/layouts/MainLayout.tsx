import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from '../components/common/Sidebar';
import { Topbar } from '../components/common/Topbar';
import { BottomNav } from '../components/common/BottomNav';
import { MobileMenuDrawer } from '../components/common/MobileMenuDrawer';
import { ProfileModal } from '../components/profile/ProfileModal';

export const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
    <div className="min-h-screen flex bg-gov-bg text-gov-ink font-sans relative">
      {/* Desktop Sidebar (hidden on mobile) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
        />
        <main className="p-3 sm:p-5 md:p-[26px_30px] pb-24 md:pb-8 max-w-[1480px] w-full mx-auto min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (hidden on desktop) */}
      <BottomNav
        onOpenMore={() => setIsMobileMenuOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      {/* Slide-out Mobile Menu Drawer */}
      <MobileMenuDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      {/* Shared Account Profile Management Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
};
