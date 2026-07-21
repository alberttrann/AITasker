import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Pen } from 'lucide-react';

export interface WidgetMetric {
  id: string;
  label: string;
  value: string | number;
  subValue?: string; // e.g. "+12% from last month" or similar textual trend if needed
  trend?: {
    value: number; // e.g. 12
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  href: string;
}

interface WidgetProps {
  metrics: WidgetMetric[];
  className?: string;
  variant?: 'slate' | 'blue' | 'purple' | 'emerald' | 'orange';
}

export default function Widget({ metrics, className = '', variant = 'slate' }: WidgetProps) {
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeMetric = metrics[selectedIndex];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!metrics || metrics.length === 0) return null;

  const handleWidgetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(activeMetric.href);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSelectMetric = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIndex(index);
    setIsMenuOpen(false);
  };

  const variantStyles = {
    slate: 'bg-gradient-to-br from-slate-800 to-slate-950 border-slate-700/50',
    blue: 'bg-gradient-to-br from-blue-900 to-blue-950 border-blue-800/50',
    purple: 'bg-gradient-to-br from-sky-800 to-blue-950 border-sky-700/50',
    emerald: 'bg-gradient-to-br from-emerald-900 to-teal-950 border-emerald-800/50',
    orange: 'bg-gradient-to-br from-orange-900 to-red-950 border-orange-800/50',
  };

  return (
    <div 
      className={`relative ${variantStyles[variant]} backdrop-blur-xl rounded-2xl border p-6 shadow-sm flex flex-col justify-between group ${className}`}
    >
      {/* Decorative background gradients */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-400/10 to-teal-400/5 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/3 transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-[30px] translate-y-1/2 -translate-x-1/4 transition-transform duration-500 group-hover:scale-110" />
      </div>
      
      <div className="relative z-30 flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          {activeMetric.icon && (
            <div className="w-10 h-10 rounded-lg bg-white/10 text-white flex items-center justify-center">
              {activeMetric.icon}
            </div>
          )}
          <h3 className="font-headline text-sm font-semibold text-white/70 uppercase tracking-wider">
            {activeMetric.label}
          </h3>
        </div>

        {/* Dropdown Menu Container */}
        {metrics.length > 1 && (
          <div className="relative" ref={menuRef}>
            <button 
              onClick={handleMenuClick}
              className={`p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-all focus:outline-none ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              aria-label="Select metric"
            >
              <Pen size={16} />
            </button>

            {isMenuOpen && (
              <div 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-100 z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100"
              >
                {metrics.map((metric, idx) => (
                  <button
                    key={metric.id}
                    onClick={(e) => handleSelectMetric(e, idx)}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50 flex items-center justify-between ${
                      idx === selectedIndex ? 'text-primary bg-primary/5' : 'text-slate-600'
                    }`}
                  >
                    {metric.label}
                    {idx === selectedIndex && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10">
        <div className="text-3xl font-extrabold text-white font-headline mb-2">
          {activeMetric.value}
        </div>
        
        {(activeMetric.trend || activeMetric.subValue) && (
          <div className="flex items-center gap-2 text-sm">
            {activeMetric.trend && (
              <span className={`inline-flex items-center gap-1 font-bold ${activeMetric.trend.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {activeMetric.trend.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {activeMetric.trend.value}%
              </span>
            )}
            {activeMetric.subValue && (
              <span className="text-white/50 font-medium">{activeMetric.subValue}</span>
            )}
          </div>
        )}
      </div>

      {/* Decorative interactive arrow on hover */}
      <button 
        onClick={handleWidgetClick}
        title={`Go to ${activeMetric.label}`}
        className="absolute bottom-6 right-6 z-20 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-white p-2 hover:bg-white/10 hover:scale-110 active:scale-95 rounded-full cursor-pointer focus:outline-none"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14"></path>
          <path d="m12 5 7 7-7 7"></path>
        </svg>
      </button>
    </div>
  );
}
