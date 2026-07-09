import { useState, useEffect } from 'react';

interface LiveClockProps {
  className?: string;
}

export function LiveClock({ className = "" }: LiveClockProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    // Initial call just to make sure we're perfectly synced to the minute (optional but good)
    const timer = setInterval(() => {
      setTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const dateStr = time.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const timeStr = time.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  return (
    <span className={`eyebrow flex items-center gap-2 ${className}`}>
      {dateStr}
      <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>
      {timeStr}
    </span>
  );
}
