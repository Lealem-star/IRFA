import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, ChevronDown, Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserAvatar, getRoleTitle } from './UserAvatar';
import { ProfileModal } from '../profile/ProfileModal';

interface TopbarProps {
  onOpenMobileMenu?: () => void;
  onOpenProfile?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobileMenu, onOpenProfile }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isLocalProfileOpen, setIsLocalProfileOpen] = useState(false);

  if (!user) return null;

  const roleInfo = getRoleTitle(user.role);

  const handleOpenProfile = () => {
    if (onOpenProfile) {
      onOpenProfile();
    } else {
      setIsLocalProfileOpen(true);
    }
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
    return `Dashboard / ${roleInfo.badge}`;
  };

  return (
    <>
      <header className="h-14 sm:h-16 md:h-[72px] bg-white border-b border-gov-line flex items-center justify-between px-3 sm:px-6 md:px-[30px] sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        {/* Mobile Brand / Header on Left */}
        <div
          className="flex md:hidden items-center gap-2 cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          <img
            src="/branding/dfcs-logo.png"
            alt="DFCS Logo"
            className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-xs shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/branding/irfa-logo.png';
            }}
          />
          <div className="overflow-hidden">
            <div className="text-xs font-black text-gov-ink tracking-tight truncate leading-tight">
              Digital Fuel Coupon
            </div>
            <div className="text-[9.5px] font-semibold text-gov-blue truncate leading-none">
              {roleInfo.badge}
            </div>
          </div>
        </div>

        {/* Desktop Breadcrumbs */}
        <div className="hidden md:flex text-[13px] text-gov-muted font-medium items-center gap-2">
          <span>{getBreadcrumb(location.pathname)}</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* User Identity Button / Trigger */}
          <button
            type="button"
            onClick={handleOpenProfile}
            className="flex items-center gap-2 sm:gap-3 p-1 sm:p-1.5 sm:pr-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-left group cursor-pointer"
            title="Click to view and edit profile"
          >
            <UserAvatar user={user} size="sm" showIndicator={true} />
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
              className="hidden sm:block text-slate-400 group-hover:text-slate-600 transition-transform group-hover:translate-y-0.5 shrink-0"
            />
          </button>

          {/* Desktop Separator & Logout Button */}
          <div className="hidden md:block h-6 w-px bg-slate-200" />

          <button
            onClick={logout}
            className="hidden md:flex border border-gov-line bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-gov-ink text-xs font-semibold px-3 py-2 rounded-[8px] transition-colors items-center gap-1.5 shadow-sm"
            title="Sign out of system"
          >
            <span>Logout</span>
            <LogOut size={13} className="text-gov-muted" />
          </button>

          {/* Mobile Menu Toggle Button */}
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg md:hidden transition-colors"
              title="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Fallback Profile Modal */}
      {!onOpenProfile && (
        <ProfileModal isOpen={isLocalProfileOpen} onClose={() => setIsLocalProfileOpen(false)} />
      )}
    </>
  );
};
