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
import { StationRepresentativesPage } from '../pages/trade/StationRepresentativesPage';
import { StationAllocationPage } from '../pages/trade/StationAllocationPage';
import { ShortagesPage } from '../pages/trade/ShortagesPage';
import { ScannerPage } from '../pages/station/ScannerPage';
import { TransactionsPage } from '../pages/station/TransactionsPage';
import { UsersPage } from '../pages/sysadmin/UsersPage';
import { SettingsPage } from '../pages/sysadmin/SettingsPage';
import { AuditLogsPage } from '../pages/sysadmin/AuditLogsPage';
import { SystemHealthPage } from '../pages/sysadmin/SystemHealthPage';
import { ReportsPage } from '../pages/ReportsPage';
import { useAuth } from '../context/AuthContext';

interface RoleRouteProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles, children }) => {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

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
        <Route
          path="/farmers"
          element={
            <RoleRoute allowedRoles={['AGRICULTURE_OFFICE', 'TRADE_OFFICE']}>
              <FarmersPage />
            </RoleRoute>
          }
        />
        <Route
          path="/farmers/:id"
          element={
            <RoleRoute allowedRoles={['AGRICULTURE_OFFICE', 'TRADE_OFFICE']}>
              <FarmerDetailPage />
            </RoleRoute>
          }
        />
        <Route
          path="/allocations"
          element={
            <RoleRoute allowedRoles={['AGRICULTURE_OFFICE']}>
              <AllocationPage />
            </RoleRoute>
          }
        />
        <Route
          path="/requests"
          element={
            <RoleRoute allowedRoles={['AGRICULTURE_OFFICE']}>
              <RequestsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/cards"
          element={
            <RoleRoute allowedRoles={['AGRICULTURE_OFFICE']}>
              <FarmerCardsPage />
            </RoleRoute>
          }
        />

        {/* Trade Routes */}
        <Route
          path="/trade/requests"
          element={
            <RoleRoute allowedRoles={['TRADE_OFFICE']}>
              <IncomingRequestsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/trade/authorizations"
          element={
            <RoleRoute allowedRoles={['TRADE_OFFICE']}>
              <AuthorizationsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/trade/stations"
          element={
            <RoleRoute allowedRoles={['TRADE_OFFICE']}>
              <StationAssignmentPage />
            </RoleRoute>
          }
        />
        <Route
          path="/trade/representatives"
          element={
            <RoleRoute allowedRoles={['TRADE_OFFICE']}>
              <StationRepresentativesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/trade/allocations"
          element={
            <RoleRoute allowedRoles={['TRADE_OFFICE']}>
              <StationAllocationPage />
            </RoleRoute>
          }
        />
        <Route
          path="/trade/shortages"
          element={
            <RoleRoute allowedRoles={['TRADE_OFFICE']}>
              <ShortagesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/shortages"
          element={
            <RoleRoute allowedRoles={['TRADE_OFFICE', 'STATION_ADMIN']}>
              <ShortagesPage />
            </RoleRoute>
          }
        />

        {/* Fuel Station Routes */}
        <Route
          path="/scanner"
          element={
            <RoleRoute allowedRoles={['STATION_ADMIN']}>
              <ScannerPage />
            </RoleRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <RoleRoute allowedRoles={['STATION_ADMIN', 'TRADE_OFFICE', 'AGRICULTURE_OFFICE']}>
              <TransactionsPage />
            </RoleRoute>
          }
        />

        {/* System Admin Routes */}
        <Route
          path="/sysadmin/users"
          element={
            <RoleRoute allowedRoles={['SYSTEM_ADMIN']}>
              <UsersPage />
            </RoleRoute>
          }
        />
        <Route
          path="/sysadmin/settings"
          element={
            <RoleRoute allowedRoles={['SYSTEM_ADMIN']}>
              <SettingsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/sysadmin/audit"
          element={
            <RoleRoute allowedRoles={['SYSTEM_ADMIN']}>
              <AuditLogsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/sysadmin/health"
          element={
            <RoleRoute allowedRoles={['SYSTEM_ADMIN']}>
              <SystemHealthPage />
            </RoleRoute>
          }
        />

        {/* Reports */}
        <Route
          path="/reports"
          element={
            <RoleRoute allowedRoles={['AGRICULTURE_OFFICE', 'TRADE_OFFICE']}>
              <ReportsPage />
            </RoleRoute>
          }
        />
      </Route>

      {/* 404 Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
