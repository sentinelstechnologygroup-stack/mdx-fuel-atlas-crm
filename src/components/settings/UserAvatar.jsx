import React from 'react';
import { getInitials } from '@/lib/roles';
import { useSettings } from '@/components/context/SettingsContext';

export default function UserAvatar({ user, size = 'md' }) {
  const { theme } = useSettings();
  const sizeClass =
    size === 'lg' ? 'w-14 h-14 text-base' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';

  if (user?.profile_photo_url) {
    return (
      <img
        src={user.profile_photo_url}
        alt={user?.full_name || 'avatar'}
        className={`${sizeClass} rounded-full object-cover border ${theme === 'dark' ? 'border-slate-600' : 'border-slate-200'}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
        theme === 'dark' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {getInitials(user)}
    </div>
  );
}