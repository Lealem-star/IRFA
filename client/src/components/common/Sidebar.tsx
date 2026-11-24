import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
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
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const roleNavConfig: Record<
    string,
    { group: string; items: { label: string; path: string; icon: React.ReactNode }[] }[]
  > = {
    AGRICULTURE_OFFICE: [
      {
        group: 'OVERVIEW',
        items: [{ label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={17} /> }],
      },
      {
        group: 'FARMER MANAGEMENT',
        items: [
          { label: 'Farmer Registry', path: '/farmers', icon: <Users size={17} /> },
          { label: 'Monthly Allocation', path: '/allocations', icon: <Layers size={17} /> },
        ],
      },
      {
        group: 'FUEL REQUESTS',
        items: [
          { label: 'Requests to Trade', path: '/requests', icon: <Send size={17} /> },
          { label: 'Farmer Cards / QR', path: '/cards', icon: <QrCode size={17} /> },
        ],
      },
      {
        group: 'MONITORING',
        items: [{ label: 'Reports & Audit', path: '/reports', icon: <FileText size={17} /> }],
      },
    ],
    TRADE_OFFICE: [
      {
        group: 'OVERVIEW',
        items: [{ label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={17} /> }],
      },
      {
        group: 'AUTHORIZATION',
        items: [
          { label: 'Incoming Requests', path: '/trade/requests', icon: <Send size={17} /> },
          { label: 'Fuel Authorizations', path: '/trade/authorizations', icon: <CheckCircle size={17} /> },
          { label: 'Station Assignment', path: '/trade/stations', icon: <Building2 size={17} /> },
        ],
      },
      {
        group: 'MONITORING',
        items: [
          { label: 'Distribution Reports', path: '/reports', icon: <FileText size={17} /> },
          { label: 'Transaction History', path: '/transactions', icon: <Receipt size={17} /> },
        ],
      },
    ],
    STATION_ADMIN: [
      {
        group: 'OPERATIONS',
        items: [
          { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={17} /> },
          { label: 'QR Verification', path: '/scanner', icon: <ScanLine size={17} /> },
          { label: 'Fuel Transactions', path: '/transactions', icon: <Receipt size={17} /> },
        ],
      },
    ],
    SYSTEM_ADMIN: [
      {
        group: 'SYSTEM',
        items: [
          { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={17} /> },
          { label: 'Users & Roles', path: '/sysadmin/users', icon: <UserCheck size={17} /> },
          { label: 'System Settings', path: '/sysadmin/settings', icon: <Settings size={17} /> },
          { label: 'Technical Audit Logs', path: '/sysadmin/audit', icon: <Shield size={17} /> },
          { label: 'System Health', path: '/sysadmin/health', icon: <Activity size={17} /> },
        ],
      },
    ],
  };

  const navGroups = roleNavConfig[user.role] || [];

  return (
    <aside className="w-[248px] bg-[#14243b] text-white p-[22px_16px] flex flex-col min-h-screen shrink-0 border-r border-[#31435a]">
      {/* Brand */}
      <div className="flex items-center gap-3 pb-6 border-b border-[#31435a] cursor-pointer" onClick={() => navigate('/dashboard')}>
        <img
          src="/branding/irfa-mark.svg"
          alt="IRFA Logo"
          className="w-10 h-10 object-contain drop-shadow-sm shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/branding/irfa-logo.png';
          }}
        />
        <div className="overflow-hidden">
          <h2 className="text-[14px] font-bold leading-tight m-0 text-white tracking-wide">IRFA</h2>
          <p className="text-[10px] text-[#aebbd0] m-0 mt-0.5 truncate font-medium">የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ</p>
          <p className="text-[9px] text-[#7a8ea8] m-0 leading-tight truncate">Office of Agriculture</p>
        </div>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 mt-4 space-y-5 overflow-y-auto">
        {navGroups.map((group, idx) => (
          <div key={idx}>
            <div className="text-[10px] tracking-[1.4px] text-[#8094af] px-2.5 pb-2 uppercase font-semibold">
              {group.group}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 w-full px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-[#244465] text-white shadow-sm'
                        : 'text-[#c8d4e5] hover:bg-[#223b5a] hover:text-white'
                    }`
                  }
                >
                  <span className="w-5 grid place-items-center">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="pt-4 mt-auto border-t border-[#31435a] space-y-1">
        <div className="px-3 py-2 text-xs text-[#8094af] flex items-center justify-between">
          <span>{user.username}</span>
          <span className="bg-[#244465] text-white text-[10px] px-2 py-0.5 rounded font-mono">
            {user.role === 'AGRICULTURE_OFFICE'
              ? 'AG'
              : user.role === 'TRADE_OFFICE'
              ? 'TR'
              : user.role === 'STATION_ADMIN'
              ? 'FS'
              : 'SA'}
          </span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-[10px] text-[13px] font-medium text-[#fca5a5] hover:bg-[#31202b] transition-colors"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
