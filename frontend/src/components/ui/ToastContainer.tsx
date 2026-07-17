import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, X, XCircle, AlertTriangle, Info } from "lucide-react";
import { useToast, type Toast, type ToastVariant } from "@lib/toast-context";

/* ─── per-variant visual config ─── */
const CONFIG: Record<
  ToastVariant,
  {
    icon: React.ReactNode;
    barColor: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
  }
> = {
  success: {
    icon: <CheckCircle2 size={18} strokeWidth={2.2} />,
    barColor: "#22C55E",
    bgColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    textColor: "#15803D",
  },
  error: {
    icon: <XCircle size={18} strokeWidth={2.2} />,
    barColor: "#EF4444",
    bgColor: "#FFF1F2",
    borderColor: "#FECDD3",
    textColor: "#B91C1C",
  },
  warning: {
    icon: <AlertTriangle size={18} strokeWidth={2.2} />,
    barColor: "#EAB308",
    bgColor: "#FEFCE8",
    borderColor: "#FEF08A",
    textColor: "#854D0E",
  },
  info: {
    icon: <Info size={18} strokeWidth={2.2} />,
    barColor: "#0EA5E9",
    bgColor: "#F0F9FF",
    borderColor: "#BAE6FD",
    textColor: "#0369A1",
  },
};

/* ─── Individual Toast Card ─── */
function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const cfg = CONFIG[toast.variant];
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  /* mount → animate in */
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /* dismiss with exit animation */
  function dismiss() {
    setLeaving(true);
    setTimeout(onDismiss, 300);
  }

  /* progress bar (countdown from 100 → 0) */
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const runProgress = useCallback(() => {
    const elapsed = elapsedRef.current + (Date.now() - startRef.current);
    const pct = Math.max(0, 100 - (elapsed / toast.duration) * 100);
    setProgress(pct);
    if (pct > 0) {
      rafRef.current = requestAnimationFrame(runProgress);
    } else {
      // Time is up — trigger the exit animation then remove
      dismiss();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.duration]);

  useEffect(() => {
    startRef.current = Date.now();
    rafRef.current = requestAnimationFrame(runProgress);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [runProgress]);

  function pauseProgress() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    elapsedRef.current += Date.now() - startRef.current;
  }

  function resumeProgress() {
    startRef.current = Date.now();
    rafRef.current = requestAnimationFrame(runProgress);
  }

  const translateY =
    visible && !leaving ? "translateY(0)" : "translateY(-20px)";
  const opacity = visible && !leaving ? 1 : 0;

  return (
    <div
      onMouseEnter={pauseProgress}
      onMouseLeave={resumeProgress}
      style={{
        transition:
          "transform 0.35s cubic-bezier(0.34,1.4,0.64,1), opacity 0.3s ease",
        transform: translateY,
        opacity,
        backgroundColor: cfg.bgColor,
        border: `1px solid ${cfg.borderColor}`,
        borderRadius: "12px",
        boxShadow:
          "0 8px 32px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.08)",
        overflow: "hidden",
        minWidth: "300px",
        maxWidth: "380px",
        fontFamily: "var(--font-body)",
        pointerEvents: "auto",
      }}
      role="alert"
      aria-live="assertive"
    >
      {/* main content row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "14px 14px 12px",
        }}
      >
        {/* icon */}
        <span
          style={{ color: cfg.barColor, flexShrink: 0, marginTop: "1px" }}
        >
          {cfg.icon}
        </span>

        {/* message */}
        <p
          style={{
            flex: 1,
            margin: 0,
            fontSize: "14px",
            fontWeight: 500,
            lineHeight: 1.5,
            color: cfg.textColor,
            wordBreak: "break-word",
          }}
        >
          {toast.message}
        </p>

        {/* close button */}
        <button
          onClick={dismiss}
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px",
            color: cfg.textColor,
            opacity: 0.55,
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.55")}
          aria-label="Dismiss notification"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* countdown progress bar */}
      <div style={{ height: "3px", background: "rgba(0,0,0,0.08)" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: cfg.barColor,
            transition: "none",
            borderRadius: "0 2px 2px 0",
          }}
        />
      </div>
    </div>
  );
}

/* ─── Toast Container — fixed top-right ─── */
export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        pointerEvents: "none",
      }}
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
