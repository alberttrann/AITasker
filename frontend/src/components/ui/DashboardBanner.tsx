import React from 'react';

interface DashboardBannerProps {
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  buttonText: string;
  onButtonClick: () => void;
  theme?: 'emerald' | 'blue';
  className?: string;
}

export function DashboardBanner({
  title,
  description,
  icon,
  buttonText,
  onButtonClick,
  theme = 'emerald',
  className = ""
}: DashboardBannerProps) {
  const isEmerald = theme === 'emerald';

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

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-900 p-8 shadow-xl border border-slate-800 flex flex-col justify-center ${className}`}>
      {/* Subtle graphic background elements */}
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
          <div className="flex items-center gap-3 mb-2">
            <div className={`shrink-0 p-1.5 rounded-lg border ${iconBgClass}`}>
              {icon}
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl tracking-tight text-white truncate">
              {title}
            </h2>
          </div>
          <div className="text-slate-300 text-sm sm:text-base leading-relaxed mt-1 break-words">
            {description}
          </div>
        </div>
        <button
          onClick={onButtonClick}
          className={`shrink-0 whitespace-nowrap rounded-xl px-8 py-3.5 font-bold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 focus:outline-none focus:ring-4 active:scale-95 ${buttonClass}`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
