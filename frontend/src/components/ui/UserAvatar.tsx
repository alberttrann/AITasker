import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Briefcase, Award, Code, Shield, User } from 'lucide-react';

export interface UserAvatarProps {
  name?: string | null;
  id?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
  style?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  className?: string;
  showStatus?: boolean;
  showRoleBadge?: boolean;
}

const GRADIENT_PALETTES = [
  'from-blue-600 via-indigo-600 to-purple-600 text-white',
  'from-emerald-500 via-teal-600 to-cyan-600 text-white',
  'from-purple-600 via-pink-600 to-rose-500 text-white',
  'from-amber-500 via-orange-600 to-rose-600 text-white',
  'from-indigo-600 via-blue-600 to-cyan-500 text-white',
  'from-fuchsia-600 via-purple-600 to-indigo-600 text-white',
  'from-rose-500 via-red-600 to-amber-600 text-white',
  'from-cyan-600 via-teal-600 to-emerald-600 text-white',
];

const SIZE_MAP: Record<string, { box: string; font: string; icon: string; status: string; badge: string }> = {
  xs: { box: 'w-6 h-6', font: 'text-[10px]', icon: 'w-3 h-3', status: 'w-1.5 h-1.5', badge: 'w-2.5 h-2.5 p-0.5' },
  sm: { box: 'w-8 h-8', font: 'text-xs', icon: 'w-4 h-4', status: 'w-2 h-2', badge: 'w-3 h-3 p-0.5' },
  md: { box: 'w-10 h-10', font: 'text-sm font-bold', icon: 'w-5 h-5', status: 'w-2.5 h-2.5', badge: 'w-3.5 h-3.5 p-0.5' },
  lg: { box: 'w-12 h-12', font: 'text-base font-bold', icon: 'w-6 h-6', status: 'w-3 h-3', badge: 'w-4 h-4 p-0.5' },
  xl: { box: 'w-16 h-16', font: 'text-xl font-extrabold', icon: 'w-8 h-8', status: 'w-3.5 h-3.5', badge: 'w-5 h-5 p-1' },
  '2xl': { box: 'w-24 h-24', font: 'text-3xl font-extrabold', icon: 'w-12 h-12', status: 'w-4 h-4', badge: 'w-6 h-6 p-1' },
};

export function UserAvatar({
  name,
  id,
  role,
  avatarUrl,
  style = 'notionists',
  size = 'md',
  className,
  showStatus = false,
  showRoleBadge = false,
}: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);

  const seed = useMemo(() => {
    return id || name || 'aitasker-user';
  }, [id, name]);

  const initials = useMemo(() => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  const gradientClass = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % GRADIENT_PALETTES.length;
    return GRADIENT_PALETTES[index];
  }, [seed]);

  const avatarSrcUrl = useMemo(() => {
    if (avatarUrl) return avatarUrl;
    const encodedSeed = encodeURIComponent(seed);
    const chosenStyle = style || 'notionists';

    // DiceBear Notionists Minimalist Vector Avatar API (v9 latest)
    return `https://api.dicebear.com/9.x/${chosenStyle}/svg?seed=${encodedSeed}&scale=110&radius=50`;
  }, [avatarUrl, seed, style]);

  useEffect(() => {
    setHasError(false);
  }, [avatarSrcUrl]);

  const sizeConfig = typeof size === 'string' ? SIZE_MAP[size] || SIZE_MAP.md : null;
  const customDimensions = typeof size === 'number' ? { width: size, height: size } : {};

  const RoleIconComponent = useMemo(() => {
    if (!role) return null;
    const upperRole = role.toUpperCase();
    if (upperRole.includes('CEO') || upperRole.includes('CLIENT')) return Briefcase;
    if (upperRole.includes('EXPERT')) return Award;
    if (upperRole.includes('TECH_TEAM')) return Code;
    if (upperRole.includes('ADMIN')) return Shield;
    return User;
  }, [role]);

  return (
    <div className={cn('relative inline-flex items-center justify-center shrink-0 select-none', className)}>
      <div
        style={customDimensions}
        className={cn(
          'rounded-full overflow-hidden flex items-center justify-center shadow-xs border border-slate-200/90 transition-transform hover:scale-[1.03] bg-[#F1F5F9]',
          sizeConfig?.box,
          hasError && `bg-gradient-to-br ${gradientClass}`
        )}
      >
        {!hasError ? (
          <img
            src={avatarSrcUrl}
            alt={name || 'User avatar'}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover rounded-full"
            loading="lazy"
          />
        ) : (
          <span className={cn('font-headline tracking-wider uppercase drop-shadow-xs text-white font-bold', sizeConfig?.font)}>
            {initials}
          </span>
        )}
      </div>

      {/* Online status indicator */}
      {showStatus && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-2 ring-white shadow-xs',
            sizeConfig?.status || 'w-2.5 h-2.5'
          )}
          title="Active online"
        />
      )}

      {/* Role badge indicator */}
      {showRoleBadge && RoleIconComponent && (
        <span
          className={cn(
            'absolute -bottom-1 -right-1 rounded-full bg-slate-900 text-white ring-2 ring-white shadow-sm flex items-center justify-center',
            sizeConfig?.badge || 'w-4 h-4'
          )}
          title={`Role: ${role}`}
        >
          <RoleIconComponent className="w-full h-full" />
        </span>
      )}
    </div>
  );
}
