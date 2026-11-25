import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  LayoutDashboard,
  Users,
  Layers,
  Send,
  QrCode,
  FileText,
  CheckCircle,
  Building2,
  ScanLine,
  Receipt,
  Settings,
  Shield,
  Activity,
  LogOut,
  UserCheck,
  User as UserIcon,
  ExternalLink,
} from 'lucide-react';
import { UserAvatar, getRoleTitle } from './UserAvatar';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
}

export const MobileMenuDrawer: React.FC<MobileMenuDrawerProps> = ({
  isOpen,
  onClose,
  onOpenProfile,
}) => {
  const { user, logout } = useAuth();

  if (!isOpen || !user) return null;

  const roleNavConfig: Record<
    string,
    { group: string; items: { label: string; path: string; icon: React.ReactNode }[] }[]
  > = {
    AGRICULTURE_OFFICE: [
      {
        group: 'OVERVIEW',
        items: [{ label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> }],
      },
      {
        group: 'FARMER MANAGEMENT',
        items: [
          { label: 'Farmer Registry', path: '/farmers', icon: <Users size={18} /> },
          { label: 'Monthly Allocation', path: '/allocations', icon: <Layers size={18} /> },
        ],
      },
      {
        group: 'FUEL REQUESTS',
        items: [
          { label: 'Requests to Trade', path: '/requests', icon: <Send size={18} /> },
          { label: 'Farmer Cards / QR', path: '/cards', icon: <QrCode size={18} /> },
        ],
      },
      {
        group: 'MONITORING',
        items: [{ label: 'Reports & Audit', path: '/reports', icon: <FileText size={18} /> }],
      },
    ],
    TRADE_OFFICE: [
      {
        group: 'OVERVIEW',
        items: [{ label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> }],
      },
      {
        group: 'AUTHORIZATION',
        items: [
          { label: 'Incoming Requests', path: '/trade/requests', icon: <Send size={18} /> },
          { label: 'Fuel Authorizations', path: '/trade/authorizations', icon: <CheckCircle size={18} /> },
          { label: 'Station Assignment', path: '/trade/stations', icon: <Building2 size={18} /> },
        ],
      },
      {
        group: 'MONITORING',
        items: [
          { label: 'Distribution Reports', path: '/reports', icon: <FileText size={18} /> },
          { label: 'Transaction History', path: '/transactions', icon: <Receipt size={18} /> },
        ],
      },
    ],
    STATION_ADMIN: [
      {
        group: 'OPERATIONS',
        items: [
          { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
          { label: 'QR Verification', path: '/scanner', icon: <ScanLine size={18} /> },
          { label: 'Fuel Transactions', path: '/transactions', icon: <Receipt size={18} /> },
        ],
      },
      {
        group: 'MONITORING',
        items: [{ label: 'Station Reports', path: '/reports', icon: <FileText size={18} /> }],
      },
    ],
    SYSTEM_ADMIN: [
      {
        group: 'SYSTEM',
        items: [
          { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
          { label: 'Users & Roles', path: '/sysadmin/users', icon: <UserCheck size={18} /> },
          { label: 'System Settings', path: '/sysadmin/settings', icon: <Settings size={18} /> },
          { label: 'Technical Audit Logs', path: '/sysadmin/audit', icon: <Shield size={18} /> },
          { label: 'System Health', path: '/sysadmin/health', icon: <Activity size={18} /> },
        ],
      },
      {
        group: 'REPORTS',
        items: [{ label: 'System Analytics', path: '/reports', icon: <FileText size={18} /> }],
      },
    ],
  };

  const navGroups = roleNavConfig[user.role] || [];
  const roleInfo = getRoleTitle(user.role);

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Sheet */}
      <div className="relative ml-auto w-full max-w-xs bg-[#14243b] text-white h-full flex flex-col p-5 shadow-2xl z-10 overflow-y-auto">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2d415b]">
          <div className="flex items-center gap-2.5">
            <img
              src="/branding/dfcs-logo.png"
              alt="DFCS"
              className="w-8 h-8 object-contain drop-shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/branding/irfa-logo.png';
              }}
            />
            <div>
              <div className="text-xs font-bold text-white leading-tight">Digital Fuel Coupon</div>
              <div className="text-[10px] text-blue-300 font-medium">{roleInfo.title}</div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#203754] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Card Trigger */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenProfile();
          }}
          className="mt-4 p-3 rounded-xl bg-[#1d324d] hover:bg-[#254063] border border-[#2e4c73] flex items-center gap-3 text-left transition-colors"
        >
          <UserAvatar user={user} size="sm" showIndicator={true} />
          <div className="overflow-hidden flex-1">
            <div className="text-xs font-bold text-white truncate">{user.fullName || user.username}</div>
            <div className="text-[10px] text-blue-300 font-mono">@{user.username}</div>
          </div>
          <span className="text-[10px] font-semibold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
            Edit
          </span>
        </button>

        {/* Nav Links */}
        <div className="flex-1 mt-5 space-y-4">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              <div className="text-[10px] font-bold tracking-wider text-[#8199b9] uppercase px-2 mb-1.5">
                {group.group}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#254b73] text-white shadow-xs font-semibold'
                        : 'text-[#c6d7ec] hover:bg-[#1d3552] hover:text-white'
                    }`
                  }
                >
                  <span className="text-[#8da5c3]">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* Sign Out Button */}
        <div className="pt-4 border-t border-[#2d415b] mt-4">
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 rounded-xl text-xs font-semibold transition-colors"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
