import { useAuth } from '@/hooks/use-auth';
import { useState, useEffect } from 'react';
import { LiveClock } from '@/components/ui/LiveClock';

export default function DashboardGreeting() {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);
  
  if (!user) return null;
  
  const firstName = user.fullName.split(' ')[0];

  const hour = time.getHours();
  let greetingText = 'Good evening';
  if (hour >= 5 && hour < 12) {
    greetingText = 'Good morning';
  } else if (hour >= 12 && hour < 18) {
    greetingText = 'Good afternoon';
  }

  return (
    <div className="w-full py-6 mb-8 flex flex-col items-start justify-center relative">
      {/* Subtle background glow */}
      <div className="absolute top-0 -left-20 -translate-y-1/4 w-[600px] h-[250px] bg-gradient-to-r from-emerald-500/60 via-emerald-500/20 to-transparent blur-[60px] z-0 pointer-events-none rounded-full"></div>
      
      <LiveClock className="mb-2 text-slate-400 relative z-10" />
      <h1 className="text-3xl font-headline font-bold text-primary tracking-tight relative z-10">
        {greetingText}, <span className="text-tertiary">{firstName}</span>.
      </h1>
    </div>
  );
}
