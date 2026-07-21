import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number; // ms
}

interface ToastContextValue {
  toasts: Toast[];
  push: (message: string, variant?: ToastVariant, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _counter = 0;
function uid() {
  return `toast-${Date.now()}-${_counter++}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      duration = 5000,
    ) => {
      const id = uid();
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
      // No setTimeout here — each ToastCard manages its own lifetime
      // via requestAnimationFrame so hover-pause defers actual dismissal.
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

/** Hook for consuming the toast system from any component. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/** Convenience helpers returned by useToast */
export function useToastActions() {
  const { push } = useToast();
  return {
    success: (msg: string, duration?: number) => push(msg, "success", duration),
    error:   (msg: string, duration?: number) => push(msg, "error", duration),
    info:    (msg: string, duration?: number) => push(msg, "info", duration),
    warning: (msg: string, duration?: number) => push(msg, "warning", duration),
  };
}
