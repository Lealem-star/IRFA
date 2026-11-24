import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const Topbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const roleMeta: Record<
    string,
    { label: string; initial: string; sub: string }
  > = {
    AGRICULTURE_OFFICE: {
      label: 'Agriculture Office',
      initial: 'AG',
      sub: 'Farmer registry & allocation',
    },
    TRADE_OFFICE: {
      label: 'Trade Office',
      initial: 'TR',
      sub: 'Authorization & station assignment',
    },
    STATION_ADMIN: {
      label: user.fuelStation?.name || 'Fuel Station Admin',
      initial: 'FS',
      sub: 'QR verification & fuel dispensing',
    },
    SYSTEM_ADMIN: {
      label: 'System Administrator',
      initial: 'SA',
      sub: 'Technical configuration only',
    },
  };

  const meta = roleMeta[user.role] || {
    label: user.fullName,
    initial: 'US',
    sub: user.role,
  };

  // Breadcrumb generation based on route
  const getBreadcrumb = (path: string) => {
    if (path.includes('/farmers')) return 'Farmer Management / Farmer Registry';
    if (path.includes('/allocations')) return 'Farmer Management / Monthly Allocation';
    if (path.includes('/requests')) return 'Fuel Requests / Submitted to Trade';
    if (path.includes('/cards')) return 'Fuel Requests / Farmer Cards & QR';
    if (path.includes('/trade/requests')) return 'Trade Authorization / Incoming Requests';
    if (path.includes('/trade/authorizations')) return 'Trade Authorization / Active Authorizations';
    if (path.includes('/trade/stations')) return 'Trade Authorization / Station Assignment';
    if (path.includes('/scanner')) return 'Operations / QR Legality Scanner';
    if (path.includes('/transactions')) return 'Operations / Fuel Transactions';
    if (path.includes('/sysadmin/users')) return 'System Administration / Users & Roles';
    if (path.includes('/sysadmin/settings')) return 'System Administration / System Settings';
    if (path.includes('/sysadmin/audit')) return 'System Administration / Technical Audit Logs';
    if (path.includes('/sysadmin/health')) return 'System Administration / System Health';
    if (path.includes('/reports')) return 'Monitoring & Reports / Department Analytics';
    return `Dashboard / ${meta.label}`;
  };

  return (
    <header className="h-[72px] bg-white border-b border-gov-line flex items-center justify-between px-[30px] sticky top-0 z-30">
      <div className="text-[13px] text-gov-muted font-medium">
        {getBreadcrumb(location.pathname)}
      </div>

      <div className="flex items-center gap-[18px]">
        {/* User Identity info matching prototype */}
        <div className="flex items-center gap-3">
          <div className="h-[36px] w-[36px] rounded-full bg-gov-softBlue text-gov-blue grid place-items-center font-bold text-xs shadow-inner">
            {meta.initial}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-[13px] font-bold text-gov-ink leading-tight">
              {meta.label}
            </div>
            <div className="text-[11px] text-gov-muted leading-tight mt-0.5">
              {meta.sub}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3 py-2 rounded-[8px] transition-colors flex items-center gap-1.5 shadow-sm"
          title="Sign out of system"
        >
          <span>Logout</span>
          <LogOut size={13} className="text-gov-muted" />
        </button>
      </div>
    </header>
  );
};
