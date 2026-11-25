import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  ScanLine,
  Receipt,
  Users,
  Layers,
  Send,
  QrCode,
  CheckCircle,
  Building2,
  UserCheck,
  Shield,
  Activity,
  Menu,
  User as UserIcon,
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';

interface BottomNavProps {
  onOpenMore: () => void;
  onOpenProfile: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenMore, onOpenProfile }) => {
  const { user } = useAuth();

  if (!user) return null;

  // Station Admin - Mobile First Experience
  if (user.role === 'STATION_ADMIN') {
    return (
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 bg-[#122338]/95 backdrop-blur-md border-t border-[#233854] shadow-[0_-4px_24px_rgba(0,0,0,0.25)] md:hidden px-3 py-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-around max-w-md mx-auto relative">
          {/* 1. Dashboard Tab */}
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1.5 px-3 min-w-[64px] rounded-xl transition-all ${
                isActive
                  ? 'text-white font-bold'
                  : 'text-[#8da2bf] hover:text-[#c4d6ec]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-1 rounded-lg transition-colors ${
                    isActive ? 'bg-[#223d60] text-blue-400' : ''
                  }`}
                >
                  <LayoutDashboard size={20} />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">Overview</span>
              </>
            )}
          </NavLink>

          {/* 2. QR SCANNER - Hero Floating Action Tab in Center */}
          <NavLink
            to="/scanner"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center -mt-5 group`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 active:scale-95 border-3 border-[#122338] ${
                    isActive
                      ? 'bg-gradient-to-tr from-[#1686D9] to-[#2563EB] text-white shadow-blue-500/40 ring-2 ring-blue-400'
                      : 'bg-gradient-to-tr from-[#1E40AF] to-[#1686D9] text-white shadow-blue-600/30'
                  }`}
                >
                  <ScanLine size={24} className="stroke-[2.5]" />
                </div>
                <span
                  className={`text-[10px] mt-1 font-bold ${
                    isActive ? 'text-blue-400' : 'text-gray-300'
                  }`}
                >
                  Scan QR
                </span>
              </>
            )}
          </NavLink>

          {/* 3. Transactions Tab */}
          <NavLink
            to="/transactions"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1.5 px-3 min-w-[64px] rounded-xl transition-all ${
                isActive
                  ? 'text-white font-bold'
                  : 'text-[#8da2bf] hover:text-[#c4d6ec]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-1 rounded-lg transition-colors ${
                    isActive ? 'bg-[#223d60] text-blue-400' : ''
                  }`}
                >
                  <Receipt size={20} />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">History</span>
              </>
            )}
          </NavLink>

          {/* 4. Profile Button */}
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex flex-col items-center justify-center py-1.5 px-3 min-w-[64px] rounded-xl text-[#8da2bf] hover:text-[#c4d6ec] active:scale-95 transition-all"
            title="Open Account Profile"
          >
            <div className="p-0.5">
              <UserAvatar user={user} size="sm" showIndicator={true} />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">Profile</span>
          </button>
        </div>
      </nav>
    );
  }

  // Role: AGRICULTURE_OFFICE
  if (user.role === 'AGRICULTURE_OFFICE') {
    return (
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 bg-[#122338]/95 backdrop-blur-md border-t border-[#233854] shadow-[0_-4px_24px_rgba(0,0,0,0.25)] md:hidden px-2 py-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg transition-colors ${
                isActive ? 'text-blue-400 font-bold' : 'text-[#8da2bf]'
              }`
            }
          >
            <LayoutDashboard size={19} />
            <span className="text-[9.5px] mt-0.5">Home</span>
          </NavLink>

          <NavLink
            to="/farmers"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg transition-colors ${
                isActive ? 'text-blue-400 font-bold' : 'text-[#8da2bf]'
              }`
            }
          >
            <Users size={19} />
            <span className="text-[9.5px] mt-0.5">Farmers</span>
          </NavLink>

          <NavLink
            to="/allocations"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg transition-colors ${
                isActive ? 'text-blue-400 font-bold' : 'text-[#8da2bf]'
              }`
            }
          >
            <Layers size={19} />
            <span className="text-[9.5px] mt-0.5">Quota</span>
          </NavLink>

          <NavLink
            to="/cards"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg transition-colors ${
                isActive ? 'text-blue-400 font-bold' : 'text-[#8da2bf]'
              }`
            }
          >
            <QrCode size={19} />
            <span className="text-[9.5px] mt-0.5">Cards</span>
          </NavLink>

          <button
            type="button"
            onClick={onOpenMore}
            className="flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg text-[#8da2bf] active:text-white"
          >
            <Menu size={19} />
            <span className="text-[9.5px] mt-0.5">More</span>
          </button>
        </div>
      </nav>
    );
  }

  // Role: TRADE_OFFICE
  if (user.role === 'TRADE_OFFICE') {
    return (
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 bg-[#122338]/95 backdrop-blur-md border-t border-[#233854] shadow-[0_-4px_24px_rgba(0,0,0,0.25)] md:hidden px-2 py-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg transition-colors ${
                isActive ? 'text-blue-400 font-bold' : 'text-[#8da2bf]'
              }`
            }
          >
            <LayoutDashboard size={19} />
            <span className="text-[9.5px] mt-0.5">Home</span>
          </NavLink>

          <NavLink
            to="/trade/requests"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg transition-colors ${
                isActive ? 'text-blue-400 font-bold' : 'text-[#8da2bf]'
              }`
            }
          >
            <Send size={19} />
            <span className="text-[9.5px] mt-0.5">Requests</span>
          </NavLink>

          <NavLink
            to="/trade/authorizations"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg transition-colors ${
                isActive ? 'text-blue-400 font-bold' : 'text-[#8da2bf]'
              }`
            }
          >
            <CheckCircle size={19} />
            <span className="text-[9.5px] mt-0.5">Approved</span>
          </NavLink>

          <NavLink
            to="/trade/stations"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg transition-colors ${
                isActive ? 'text-blue-400 font-bold' : 'text-[#8da2bf]'
              }`
            }
          >
            <Building2 size={19} />
            <span className="text-[9.5px] mt-0.5">Stations</span>
          </NavLink>

          <button
            type="button"
            onClick={onOpenMore}
            className="flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg text-[#8da2bf] active:text-white"
          >
            <Menu size={19} />
            <span className="text-[9.5px] mt-0.5">More</span>
          </button>
        </div>
      </nav>
    );
  }

  // Role: SYSTEM_ADMIN (and fallback)
  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-[#122338]/95 backdrop-blur-md border-t border-[#233854] shadow-[0_-4px_24px_rgba(0,0,0,0.25)] md:hidden px-2 py-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg transition-colors ${
              isActive ? 'text-blue-400 font-bold' : 'text-[#8da2bf]'
            }`
          }
        >
          <LayoutDashboard size={19} />
          <span className="text-[9.5px] mt-0.5">Home</span>
        </NavLink>

        <NavLink
          to="/sysadmin/users"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg transition-colors ${
              isActive ? 'text-blue-400 font-bold' : 'text-[#8da2bf]'
            }`
          }
        >
          <UserCheck size={19} />
          <span className="text-[9.5px] mt-0.5">Users</span>
        </NavLink>

        <NavLink
          to="/sysadmin/audit"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg transition-colors ${
              isActive ? 'text-blue-400 font-bold' : 'text-[#8da2bf]'
            }`
          }
        >
          <Shield size={19} />
          <span className="text-[9.5px] mt-0.5">Audit</span>
        </NavLink>

        <NavLink
          to="/sysadmin/health"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg transition-colors ${
              isActive ? 'text-blue-400 font-bold' : 'text-[#8da2bf]'
            }`
          }
        >
          <Activity size={19} />
          <span className="text-[9.5px] mt-0.5">Health</span>
        </NavLink>

        <button
          type="button"
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center py-1 px-2 flex-1 rounded-lg text-[#8da2bf] active:text-white"
        >
          <Menu size={19} />
          <span className="text-[9.5px] mt-0.5">More</span>
        </button>
      </div>
    </nav>
  );
};
