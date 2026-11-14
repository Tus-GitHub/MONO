"use client";

import { useId, useRef, type ReactNode } from "react";

import {
  Portal,
  useBackButton,
  useEscapeKey,
  useFocusTrap,
  useMountTransition,
  useScrollLock,
} from "@/components/ui/_dialog-primitives";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

type ModalSize = "sm" | "md" | "lg" | "full";

const SIZE: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  full: "max-w-none",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Runs after this modal's synthetic history entry has actually been removed. */
  onHistoryClosed?: (stayedOnPage: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  /** Hide the default close button (e.g. for a forced choice). */
  hideClose?: boolean;
  closeLabel?: string;
  className?: string;
}

export function Modal({
  open,
  onClose,
  onHistoryClosed,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose,
  closeLabel = "Close",
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const { mounted, visible } = useMountTransition(open);

  useScrollLock(mounted);
  useFocusTrap(panelRef, visible);
  useEscapeKey(onClose, mounted);
  useBackButton(onClose, open, onHistoryClosed);

  if (!mounted) return null;

  return (
    <Portal>
      <div inert={!open} className={cn("mono-modal-wrap fixed inset-0 z-50 flex items-center justify-center", size === "full" ? "mono-fullscreen-wrap" : "dialog-inset", !open && "pointer-events-none")}>
        <div
          className={cn(
            "absolute inset-0 bg-ink/45 backdrop-blur-[2px] transition-opacity duration-fast",
            visible ? "opacity-100" : "opacity-0",
          )}
          onClick={onClose}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          className={cn(
            // Never taller than the *visible* viewport minus the inset gutters — `--vvh` tracks
            // the keyboard (set by <ViewportManager>); `100dvh` is the fallback. The body
            // scrolls inside instead, so it stays usable in landscape and with the keyboard up.
            "mono-dialog-panel relative z-10 flex w-full origin-center flex-col overflow-hidden bg-elevated transition-[opacity,transform] duration-base ease-out",
            size === "full" ? "mono-fullscreen-panel" : "mono-modal-panel max-h-[calc(var(--vvh,100dvh)-2rem)] rounded-xl border border-line shadow-xl",
            SIZE[size],
            visible ? "scale-100 opacity-100" : "scale-95 opacity-0",
            className,
          )}
        >
          {(title || !hideClose) && (
            <div className={cn("flex shrink-0 items-start justify-between gap-4", size === "full" ? "border-b border-line px-4 py-3" : "px-5 pt-5")}>
              <div className="min-w-0">
                {title ? (
                  <h2 id={titleId} className="font-display text-lg font-medium text-ink">
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p id={descId} className="mt-1 text-sm text-muted">
                    {description}
                  </p>
                ) : null}
              </div>
              {!hideClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={closeLabel}
                  className="tap -mr-2 -mt-1 grid place-items-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
                >
                  <Icon name="x" size="sm" />
                </button>
              ) : null}
            </div>
          )}

          {children ? (
            <div className={cn("scroll-area min-h-0 flex-1 text-sm text-ink", size === "full" ? "p-2 sm:p-4" : "px-5 py-4")}>{children}</div>
          ) : null}

          {footer ? (
            <div className={cn("shrink-0 border-t border-line", size === "full" ? "px-3 py-3 sm:px-5" : "flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end")}>
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}
