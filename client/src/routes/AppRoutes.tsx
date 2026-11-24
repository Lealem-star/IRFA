import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { FarmersPage } from '../pages/agriculture/FarmersPage';
import { FarmerDetailPage } from '../pages/agriculture/FarmerDetailPage';
import { AllocationPage } from '../pages/agriculture/AllocationPage';
import { RequestsPage } from '../pages/agriculture/RequestsPage';
import { FarmerCardsPage } from '../pages/agriculture/FarmerCardsPage';
import { IncomingRequestsPage } from '../pages/trade/IncomingRequestsPage';
import { AuthorizationsPage } from '../pages/trade/AuthorizationsPage';
import { StationAssignmentPage } from '../pages/trade/StationAssignmentPage';
import { ScannerPage } from '../pages/station/ScannerPage';
import { TransactionsPage } from '../pages/station/TransactionsPage';
import { UsersPage } from '../pages/sysadmin/UsersPage';
import { SettingsPage } from '../pages/sysadmin/SettingsPage';
import { AuditLogsPage } from '../pages/sysadmin/AuditLogsPage';
import { SystemHealthPage } from '../pages/sysadmin/SystemHealthPage';
import { ReportsPage } from '../pages/ReportsPage';
import { useAuth } from '../context/AuthContext';

export const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      {/* Authenticated Application Shell */}
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Agriculture Routes */}
        <Route path="/farmers" element={<FarmersPage />} />
        <Route path="/farmers/:id" element={<FarmerDetailPage />} />
        <Route path="/allocations" element={<AllocationPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/cards" element={<FarmerCardsPage />} />

        {/* Trade Routes */}
        <Route path="/trade/requests" element={<IncomingRequestsPage />} />
        <Route path="/trade/authorizations" element={<AuthorizationsPage />} />
        <Route path="/trade/stations" element={<StationAssignmentPage />} />

        {/* Fuel Station Routes */}
        <Route path="/scanner" element={<ScannerPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />

        {/* System Admin Routes */}
        <Route path="/sysadmin/users" element={<UsersPage />} />
        <Route path="/sysadmin/settings" element={<SettingsPage />} />
        <Route path="/sysadmin/audit" element={<AuditLogsPage />} />
        <Route path="/sysadmin/health" element={<SystemHealthPage />} />

        {/* Reports */}
        <Route path="/reports" element={<ReportsPage />} />
      </Route>

      {/* 404 Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
