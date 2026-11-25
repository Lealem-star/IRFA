import React, { useState } from 'react';
import { User } from '../../types';
import { getAssetUrl } from '../../services/api';

interface UserAvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showIndicator?: boolean;
}

export const getAvatarUrl = (path?: string | null): string | null => {
  if (!path) return null;
  return getAssetUrl(path);
};

export const getUserInitials = (user: User): string => {
  if (user.fullName && user.fullName.trim().length > 0) {
    const parts = user.fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.fullName.slice(0, 2).toUpperCase();
  }
  if (user.username) {
    return user.username.slice(0, 2).toUpperCase();
  }
  return 'US';
};

export const getRoleTitle = (role: string): { title: string; badge: string; color: string; bg: string; text: string } => {
  switch (role) {
    case 'AGRICULTURE_OFFICE':
      return {
        title: 'Agricultural Bureau Officer',
        badge: 'Agriculture Office',
        color: 'emerald',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        text: 'text-emerald-700',
      };
    case 'TRADE_OFFICE':
      return {
        title: 'Trade & Industry Officer',
        badge: 'Trade Office',
        color: 'blue',
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        text: 'text-blue-700',
      };
    case 'STATION_ADMIN':
      return {
        title: 'Fuel Station Dispatcher',
        badge: 'Station Admin',
        color: 'amber',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        text: 'text-amber-700',
      };
    case 'SYSTEM_ADMIN':
      return {
        title: 'System Administrator',
        badge: 'System Admin',
        color: 'purple',
        bg: 'bg-purple-50 text-purple-700 border-purple-200',
        text: 'text-purple-700',
      };
    default:
      return {
        title: 'Institutional User',
        badge: 'User',
        color: 'slate',
        bg: 'bg-slate-50 text-slate-700 border-slate-200',
        text: 'text-slate-700',
      };
  }
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'md',
  className = '',
  showIndicator = false,
}) => {
  const [imgError, setImgError] = useState(false);

  const dimensions = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-20 h-20 text-xl font-bold',
  }[size];

  const indicatorSizes = {
    sm: 'w-2 h-2 ring-1',
    md: 'w-2.5 h-2.5 ring-1.5',
    lg: 'w-3 h-3 ring-2',
    xl: 'w-4 h-4 ring-2.5',
  }[size];

  const fullAvatarUrl = getAvatarUrl(user.avatarUrl);
  const initials = getUserInitials(user);

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {fullAvatarUrl && !imgError ? (
        <img
          src={fullAvatarUrl}
          alt={user.fullName || user.username}
          onError={() => setImgError(true)}
          className={`${dimensions} rounded-full object-cover ring-1 ring-slate-200/80 shadow-sm bg-slate-100`}
        />
      ) : (
        <div
          className={`${dimensions} rounded-full bg-gradient-to-br from-gov-navy to-[#1f3a5f] text-white flex items-center justify-center font-bold tracking-tight shadow-sm ring-1 ring-white/20 select-none`}
        >
          {initials}
        </div>
      )}

      {showIndicator && (
        <span
          className={`absolute bottom-0 right-0 ${indicatorSizes} rounded-full bg-emerald-500 ring-white`}
          title="Active Session"
        />
      )}
    </div>
  );
};
