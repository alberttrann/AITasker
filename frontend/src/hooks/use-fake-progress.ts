import { useState, useEffect } from 'react';

export function useFakeProgress(isActive: boolean, intervalMs = 1000, maxProgress = 90, incrementFn?: (prev: number) => number) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      return;
    }
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= maxProgress) return prev;
        const inc = incrementFn ? incrementFn(prev) : Math.random() * 12;
        return Math.min(prev + inc, maxProgress);
      });
    }, intervalMs);
    return () => clearInterval(interval);
  }, [isActive, intervalMs, maxProgress, incrementFn]);

  return progress;
}
