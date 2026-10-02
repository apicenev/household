import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/20/solid";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { ToastContext, type ToastApi, type ToastOptions } from "./toastContext";

const MAX_TOASTS = 3;

interface ToastItem extends ToastOptions {
  id: string;
}

let nextId = 0;

/**
 * Hosts the toast stack: bottom-anchored above the tab bar (bottom 24 px from lg),
 * announced politely; errors use role="alert".
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    nextId += 1;
    const id = `toast-${nextId}`;
    setToasts((current) => [...current, { ...options, id }].slice(-MAX_TOASTS));
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+--spacing(3))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { message, tone = "success", action } = toast;
  const duration = toast.duration ?? (action ? 8000 : 5000);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);

  // Auto-dismiss; hovering or focusing the toast pauses the timer (WCAG 2.2.1).
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = window.setTimeout(onDismiss, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, onDismiss]);

  const Icon =
    tone === "error"
      ? ExclamationCircleIcon
      : tone === "info"
        ? InformationCircleIcon
        : CheckCircleIcon;
  const ActionIcon = action?.icon;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cx(
        "pointer-events-auto flex min-h-13 w-full max-w-[358px] items-center gap-3 rounded-[14px] bg-ink pl-4 text-canvas shadow-raised",
        "transition-[opacity,translate] duration-(--duration-base) ease-out starting:translate-y-2 starting:opacity-0",
        action ? "pr-1.5" : "pr-4",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cx(
          "size-5 shrink-0",
          tone === "error"
            ? "text-toast-danger"
            : tone === "info"
              ? "text-line-strong"
              : "text-toast-success",
        )}
      />
      <span className="flex-1 py-3.5 text-[15px] leading-[22px]">{message}</span>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] px-3.5 text-[15px] font-semibold text-toast-action focus-visible:outline-toast-action hovered:bg-canvas/10"
        >
          {ActionIcon && <ActionIcon aria-hidden="true" className="size-4" />}
          {action.label}
        </button>
      )}
    </div>
  );
}
