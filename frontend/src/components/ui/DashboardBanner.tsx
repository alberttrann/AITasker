import React from 'react';

interface DashboardBannerProps {
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  buttonText: string;
  onButtonClick: () => void;
  theme?: 'emerald' | 'blue' | 'outline' | 'outline-purple';
  topLabel?: string;
  className?: string;
}

export function DashboardBanner({
  title,
  description,
  icon,
  buttonText,
  onButtonClick,
  theme = 'emerald',
  topLabel,
  className = ""
}: DashboardBannerProps) {
  const isEmerald = theme === 'emerald';
  const isOutline = theme === 'outline' || theme === 'outline-purple';

  if (isOutline) {
    return (
      <div className={`relative overflow-hidden rounded-xl bg-white p-5 border border-slate-200 shadow-sm flex flex-col justify-center transition-all hover:border-slate-300 hover:shadow-md ${className}`}>
        {topLabel && (
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">
            {topLabel}
          </span>
        )}
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-800 border border-slate-200/60">
            {icon}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 leading-tight mb-1">
              {title}
            </h3>
            <div className="text-sm text-slate-600 leading-snug">
              {description}
            </div>
          </div>
          
          <div className="flex-shrink-0 mt-3 sm:mt-0">
            <button
              onClick={onButtonClick}
              className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-slate-800 bg-white border border-slate-300 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 active:scale-95"
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Legacy Emerald / Blue Subscription Banner style
  const orbsClass = isEmerald
    ? "bg-emerald-500/20"
    : "bg-blue-500/20";
  const orb2Class = isEmerald
    ? "bg-teal-400/10"
    : "bg-indigo-400/10";
  const orb3Class = isEmerald
    ? "bg-emerald-600/20"
    : "bg-blue-600/20";

  const iconBgClass = isEmerald
    ? "bg-emerald-500/20 border-emerald-500/30"
    : "bg-blue-500/20 border-blue-500/30";

  const buttonClass = isEmerald
    ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20 hover:bg-emerald-400 hover:shadow-emerald-500/30 focus:ring-emerald-500/30"
    : "bg-blue-500 text-white shadow-blue-500/20 hover:bg-blue-400 hover:shadow-blue-500/30 focus:ring-blue-500/30";

  const containerClass = `relative overflow-hidden rounded-2xl bg-slate-900 p-8 shadow-xl border border-slate-800 flex flex-col justify-center ${className}`;

  return (
    <div className={containerClass}>
      <div className="absolute inset-0 pointer-events-none">
        {/* Glowing orbs */}
        <div className={`absolute -right-20 -top-32 h-96 w-96 rounded-full blur-[80px] ${orbsClass}`} />
        <div className={`absolute top-1/2 left-1/4 h-64 w-64 -translate-y-1/2 rounded-full blur-[60px] ${orb2Class}`} />
        <div className={`absolute -bottom-24 -left-20 h-80 w-80 rounded-full blur-[80px] ${orb3Class}`} />

        {/* Dot grid pattern */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={`banner-grid-${theme}`} width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="currentColor" className="text-white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#banner-grid-${theme})`} />
        </svg>
      </div>

      <div className="relative z-10 w-full flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0 text-white sm:pr-8">
          <div className="flex items-center gap-3 mb-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm ${iconBgClass}`}>
              {icon}
            </div>
            <h3 className="font-headline text-2xl font-bold tracking-tight text-white">
              {title}
            </h3>
          </div>
          <div className="text-[15px] font-medium leading-relaxed text-slate-300">
            {description}
          </div>
        </div>
        <div>
          <button
            onClick={onButtonClick}
            className={`shrink-0 whitespace-nowrap rounded-xl px-7 py-3 font-bold shadow-lg transition-all focus:outline-none focus:ring-4 active:scale-95 ${buttonClass}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
