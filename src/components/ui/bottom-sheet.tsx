"use client";

import { useCallback, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";

import {
  Portal,
  useBackButton,
  useEscapeKey,
  useFocusTrap,
  useMountTransition,
  useScrollLock,
} from "@/components/ui/_dialog-primitives";
import { cn } from "@/lib/utils/cn";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const DISMISS_THRESHOLD = 96;

/** Mobile-first modal that rises from the bottom edge, with drag-to-dismiss. */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { mounted, visible } = useMountTransition(open, 300);
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);

  useScrollLock(mounted);
  useFocusTrap(panelRef, visible);
  useEscapeKey(onClose, mounted);
  useBackButton(onClose, open);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    setDrag(Math.max(0, event.clientY - startY.current));
  }, []);

  const onPointerUp = useCallback(() => {
    if (startY.current === null) return;
    startY.current = null;
    setDrag((value) => {
      if (value > DISMISS_THRESHOLD) onClose();
      return 0;
    });
  }, [onClose]);

  if (!mounted) return null;

  return (
    <Portal>
      {/* `bottom` follows the keyboard (`--kb`, set by <ViewportManager>) so the sheet — and
          its footer actions — ride up above it instead of hiding behind it. */}
      <div
        className="fixed inset-x-0 top-0 z-50 flex items-end justify-center transition-[bottom] duration-base ease-out"
        style={{ bottom: "var(--kb, 0px)" }}
      >
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
          style={{ transform: drag ? `translateY(${drag}px)` : undefined }}
          className={cn(
            "relative z-10 flex max-h-[calc(var(--vvh,92dvh)-1rem)] w-full max-w-xl flex-col rounded-t-2xl border border-line bg-elevated pb-safe shadow-xl",
            "transition-transform duration-slow ease-out",
            !drag && (visible ? "translate-y-0" : "translate-y-full"),
            className,
          )}
        >
          <div
            className="flex shrink-0 cursor-grab touch-none flex-col items-center gap-3 px-5 pt-3 active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <span className="h-1.5 w-10 rounded-full bg-line-strong" aria-hidden="true" />
            {title ? (
              <div className="w-full text-center">
                <h2 id={titleId} className="font-display text-lg font-medium text-ink">
                  {title}
                </h2>
                {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
              </div>
            ) : null}
          </div>

          {children ? (
            <div className="scroll-area min-h-0 flex-1 px-5 py-4 text-sm text-ink">{children}</div>
          ) : null}

          {footer ? (
            <div className="shrink-0 border-t border-line px-5 py-4">{footer}</div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}
