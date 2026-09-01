"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Portal } from "@/components/ui/_dialog-primitives";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

type ToastVariant = "default" | "success" | "warning" | "error";

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms; use `Infinity` to require manual dismiss. Default 4500. */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "duration">> {
  id: string;
  open: boolean;
}

interface ToastApi {
  toast: (options: ToastOptions | string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VARIANT: Record<ToastVariant, { glyph: IconName; accent: string }> = {
  default: { glyph: "info", accent: "text-muted" },
  success: { glyph: "checkCircle", accent: "text-success" },
  warning: { glyph: "alertTriangle", accent: "text-warning" },
  error: { glyph: "alertCircle", accent: "text-error" },
};

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: string) => {
    setItems((list) => list.filter((item) => item.id !== id));
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      setItems((list) => list.map((item) => (item.id === id ? { ...item, open: false } : item)));
      const timer = setTimeout(() => remove(id), 200);
      timers.current.set(`${id}:exit`, timer);
    },
    [remove],
  );

  const toast = useCallback(
    (options: ToastOptions | string) => {
      const opts = typeof options === "string" ? { title: options } : options;
      const id = `t${++counter}`;
      const item: ToastItem = {
        id,
        title: opts.title,
        description: opts.description ?? "",
        variant: opts.variant ?? "default",
        open: true,
      };
      setItems((list) => [...list, item].slice(-4));
      const duration = opts.duration ?? 4500;
      if (Number.isFinite(duration)) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {items.length > 0 ? (
        <Portal>
          <div
            className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 pt-safe sm:inset-x-auto sm:right-0 sm:top-auto sm:bottom-0 sm:items-end"
            role="region"
            aria-label="Notifications"
          >
            {items.map((item) => {
              const v = VARIANT[item.variant];
              return (
                <div
                  key={item.id}
                  role="status"
                  className={cn(
                    "pointer-events-auto flex w-full max-w-sm gap-3 rounded-xl border border-line bg-elevated p-3.5 shadow-lg transition-all duration-base ease-out",
                    item.open
                      ? "translate-y-0 opacity-100"
                      : "translate-y-1 opacity-0 sm:translate-y-2",
                  )}
                >
                  <Icon name={v.glyph} size="sm" className={cn("mt-0.5 shrink-0", v.accent)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    {item.description ? (
                      <p className="mt-0.5 text-sm text-muted">{item.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => dismiss(item.id)}
                    className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </Portal>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>.");
  return ctx;
}
