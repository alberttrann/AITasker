import React from 'react';
import { X } from 'lucide-react';

interface SuggestBoxProps {
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  buttonText: string;
  onButtonClick: () => void;
  theme?: 'emerald' | 'blue' | 'outline' | 'outline-blue';
  topLabel?: string;
  className?: string;
  onDismiss?: () => void;
}

export function SuggestBox({
  title,
  description,
  icon,
  buttonText,
  onButtonClick,
  theme = 'emerald',
  topLabel,
  className = "",
  onDismiss
}: SuggestBoxProps) {
  const isEmerald = theme === 'emerald';
  const isOutline = theme === 'outline' || theme === 'outline-blue';

  if (isOutline) {
    return (
      <div className={`relative overflow-hidden rounded-xl bg-white p-5 border border-slate-200 shadow-sm flex flex-col justify-center transition-all hover:border-slate-300 hover:shadow-md group ${className}`}>
        {onDismiss && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Dismiss suggestion"
          >
            <X size={16} />
          </button>
        )}
        
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

  // Enhanced Premium Theme
  const orbsClass = isEmerald ? "bg-emerald-500/20" : "bg-blue-500/20";
  const orb2Class = isEmerald ? "bg-teal-400/10" : "bg-sky-400/10";
  const orb3Class = isEmerald ? "bg-emerald-600/20" : "bg-blue-600/20";
  
  const iconBgClass = isEmerald ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30";
  const buttonClass = isEmerald
    ? "bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-emerald-400 focus:ring-emerald-500/30"
    : "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:bg-blue-400 focus:ring-blue-500/30";

  return (
    <div className={`relative overflow-hidden rounded-[16px] bg-primary-dark p-6 sm:p-8 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] group ${className}`}>
      {onDismiss && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="absolute top-4 right-4 p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors z-20 opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Dismiss suggestion"
        >
          <X size={18} />
        </button>
      )}

      {/* Background Orbs & Grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute -right-20 -top-32 h-96 w-96 rounded-full blur-[80px] ${orbsClass}`} />
        <div className={`absolute top-1/2 left-1/4 h-64 w-64 -translate-y-1/2 rounded-full blur-[60px] ${orb2Class}`} />
        <div className={`absolute -bottom-24 -left-20 h-80 w-80 rounded-full blur-[80px] ${orb3Class}`} />
        <div 
          className="absolute inset-0 z-0 opacity-20" 
          style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
        ></div>
      </div>

      <div className="relative z-10 flex-1 min-w-0 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] border backdrop-blur-md shadow-lg ${iconBgClass}`}>
          {icon}
        </div>
        <div>
          {topLabel && (
            <span className="eyebrow mb-1.5 block text-slate-300 opacity-80">{topLabel}</span>
          )}
          <h3 className="font-headline text-[20px] font-bold text-white mb-1.5 tracking-tight">
            {title}
          </h3>
          <div className="text-[14px] text-slate-300 leading-relaxed font-medium">
            {description}
          </div>
        </div>
      </div>
      <div className="relative z-10 shrink-0 mt-4 sm:mt-0">
        <button
          onClick={onButtonClick}
          className={`whitespace-nowrap rounded-[8px] px-6 py-2.5 text-sm font-bold transition-all focus:outline-none focus:ring-2 active:scale-95 ${buttonClass}`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
