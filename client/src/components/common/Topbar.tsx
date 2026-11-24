import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { UserAvatar, getRoleTitle } from './UserAvatar';
import { ProfileModal } from '../profile/ProfileModal';

export const Topbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  if (!user) return null;

  const roleInfo = getRoleTitle(user.role);

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
    return `Dashboard / ${roleInfo.badge}`;
  };

  return (
    <>
      <header className="h-[72px] bg-white border-b border-gov-line flex items-center justify-between px-[30px] sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="text-[13px] text-gov-muted font-medium flex items-center gap-2">
          <span>{getBreadcrumb(location.pathname)}</span>
        </div>

        <div className="flex items-center gap-3.5">
          {/* Enhanced User Identity Button / Trigger */}
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-3 p-1.5 pr-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-left group cursor-pointer"
            title="Click to view and edit profile"
          >
            <UserAvatar user={user} size="md" showIndicator={true} />
            <div className="text-left hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-gov-ink leading-tight group-hover:text-gov-blue transition-colors">
                  {user.fullName || user.username}
                </span>
                <span className="text-[11px] font-mono text-gov-muted font-medium">
                  @{user.username}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded leading-tight border ${roleInfo.bg}`}>
                  {roleInfo.badge}
                </span>
                <span className="text-[11px] text-gov-muted truncate max-w-[140px]">
                  {user.fuelStation?.name || user.office?.name || 'Office of Agriculture'}
                </span>
              </div>
            </div>
            <ChevronDown
              size={14}
              className="text-slate-400 group-hover:text-slate-600 transition-transform group-hover:translate-y-0.5 shrink-0"
            />
          </button>

          <div className="h-6 w-px bg-slate-200" />

          <button
            onClick={logout}
            className="border border-gov-line bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-gov-ink text-xs font-semibold px-3 py-2 rounded-[8px] transition-colors flex items-center gap-1.5 shadow-sm"
            title="Sign out of system"
          >
            <span>Logout</span>
            <LogOut size={13} className="text-gov-muted" />
          </button>
        </div>
      </header>

      {/* Profile Management Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
};
