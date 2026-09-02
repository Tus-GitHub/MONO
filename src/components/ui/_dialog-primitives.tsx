"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

/** Renders children into a detached node on <body>. SSR-safe (renders nothing on the server). */
export function Portal({ children }: { children: ReactNode }) {
  const [node] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : document.createElement("div"),
  );

  useEffect(() => {
    if (!node) return;
    node.setAttribute("data-mono-portal", "");
    document.body.appendChild(node);
    return () => {
      document.body.removeChild(node);
    };
  }, [node]);

  return node ? createPortal(children, node) : null;
}

/**
 * Enter/exit transition state without a library. `visible` flips one frame after mount so a
 * CSS transition can run; on close, `mounted` stays true for `durationMs` so the exit plays.
 */
export function useMountTransition(open: boolean, durationMs = 240) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const [lastOpen, setLastOpen] = useState(open);

  // React-recommended pattern: adjust state during render when the prop changes.
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setMounted(true);
    else setVisible(false);
  }

  useEffect(() => {
    if (open && !visible) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    if (!open && mounted) {
      const timer = setTimeout(() => setMounted(false), durationMs);
      return () => clearTimeout(timer);
    }
  }, [open, visible, mounted, durationMs]);

  return { mounted, visible };
}

/** Locks body scroll while `active`, compensating for the scrollbar to avoid layout shift. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [active]);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Traps Tab focus inside `ref` while `active`, and restores focus to the opener on teardown. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusFirst = () => {
      const targets = node.querySelectorAll<HTMLElement>(FOCUSABLE);
      (targets[0] ?? node).focus();
    };
    focusFirst();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const targets = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (targets.length === 0) {
        event.preventDefault();
        return;
      }
      const first = targets[0];
      const last = targets[targets.length - 1];
      const activeEl = document.activeElement;
      if (event.shiftKey && activeEl === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [ref, active]);
}

/** Calls `onClose` on Escape while `active`. */
export function useEscapeKey(onClose: () => void, active: boolean) {
  const handler = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose],
  );
  useEffect(() => {
    if (!active) return;
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler, active]);
}

/**
 * Makes the browser / Android system Back button (and the back-swipe gesture) close an open
 * overlay instead of leaving the page. While `active`, a throwaway history entry is pushed;
 * `popstate` closes the overlay; closing it any other way quietly pops that entry back off.
 * Standard History API — degrades to "no-op" if it isn't there.
 */
export function useBackButton(onClose: () => void, active: boolean) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!active || typeof window === "undefined" || !window.history) return;

    window.history.pushState({ ...window.history.state, monoOverlay: true }, "");
    const onPop = () => onCloseRef.current();
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed by button / Escape / backdrop rather than Back — remove our synthetic entry.
      if (window.history.state?.monoOverlay) window.history.back();
    };
  }, [active]);
}

export function useBodyRef() {
  return useRef<HTMLDivElement>(null);
}
