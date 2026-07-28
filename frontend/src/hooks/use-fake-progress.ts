import { useState, useEffect } from 'react';

/**
 * Simulates smooth incremental progress percentage (0-90%) for long-running AI operations
 * (such as elicitation stage synthesis and portfolio evaluations) to provide immediate visual feedback.
 */
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
