import { createContext, useContext, type ComponentType, type SVGProps } from "react";

export type ToastTone = "success" | "error" | "info";

export interface ToastAction {
  /** e.g. «Rückgängig», «Nochmals» */
  label: string;
  onClick: () => void;
  /** 16/solid icon before the label (undo shows arrow-uturn-left). */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  action?: ToastAction;
  /** Auto-dismiss after this many ms (default 5000, 8000 with an action). */
  duration?: number;
}

export interface ToastApi {
  /** Shows a toast and returns its id. */
  show: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** Toasts (UI feedback with optional «Rückgängig»). Needs a <ToastProvider> above. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast() must be used inside <ToastProvider>.");
  return api;
}
