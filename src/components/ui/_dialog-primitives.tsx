"use client";

import {
  useCallback,
  useEffect,
  useId,
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

let bodyLockCount = 0;
let unlockedBodyStyle: { overflow: string; paddingRight: string } | null = null;

/** Nested overlays share one scroll lock; only the last teardown restores the original styles. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (bodyLockCount === 0) {
      const { overflow, paddingRight } = document.body.style;
      unlockedBodyStyle = { overflow, paddingRight };
      const gap = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    }
    bodyLockCount++;
    return () => {
      bodyLockCount--;
      if (bodyLockCount === 0 && unlockedBodyStyle) {
        document.body.style.overflow = unlockedBodyStyle.overflow;
        document.body.style.paddingRight = unlockedBodyStyle.paddingRight;
        unlockedBodyStyle = null;
      }
    };
  }, [active]);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([type="hidden"]):not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Traps Tab focus inside `ref` while `active`, and restores focus to the opener on teardown. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    let addedTabIndex = false;
    const targets = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.tabIndex >= 0 && el.getClientRects().length > 0
        && getComputedStyle(el).visibility !== "hidden" && !el.closest("[inert]"),
    );
    const focusFirst = () => {
      const first = targets()[0];
      if (first) first.focus();
      else {
        if (!node.hasAttribute("tabindex")) { node.tabIndex = -1; addedTabIndex = true; }
        node.focus();
      }
    };
    focusFirst();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = targets();
      if (controls.length === 0) {
        event.preventDefault();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      const activeEl = document.activeElement;
      if (activeEl === node || !node.contains(activeEl)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeEl === first) {
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
      if (addedTabIndex) node.removeAttribute("tabindex");
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
export function useBackButton(
  onClose: () => void,
  active: boolean,
  onHistoryClosed?: (stayedOnPage: boolean) => void,
) {
  const onCloseRef = useRef(onClose);
  const onHistoryClosedRef = useRef(onHistoryClosed);
  const entryId = useId();
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPendingCleanup = useRef<(() => void) | null>(null);
  useEffect(() => {
    onCloseRef.current = onClose;
    onHistoryClosedRef.current = onHistoryClosed;
  });

  useEffect(() => {
    if (!active || typeof window === "undefined" || !window.history) return;

    // Strict Mode replays mount effects. Reuse our entry and cancel the deferred
    // teardown instead of letting an asynchronous history.back close the replay.
    if (cleanupTimer.current !== null) {
      clearTimeout(cleanupTimer.current);
      cleanupTimer.current = null;
    }
    cancelPendingCleanup.current?.();
    const entries = (): string[] => {
      const value = window.history.state?.monoOverlay;
      return Array.isArray(value) ? value : [];
    };
    const entryUrl = window.location.href;
    if (!entries().includes(entryId)) {
      window.history.pushState({ ...window.history.state, monoOverlay: [...entries(), entryId] }, "");
    }
    // A nested confirmation owns its own entry; Back closes only that overlay.
    const onPop = () => {
      if (!entries().includes(entryId)) onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed by button / Escape / backdrop rather than Back — remove our synthetic entry.
      cleanupTimer.current = setTimeout(() => {
        cleanupTimer.current = null;
        let traversalRequested = false;
        const cancel = () => {
          window.removeEventListener("popstate", removeEntry);
          cancelPendingCleanup.current = null;
        };
        const removeEntry = () => {
          const stack = entries();
          if (window.location.href !== entryUrl || !stack.includes(entryId)) {
            cancel();
            onHistoryClosedRef.current?.(window.location.href === entryUrl);
          } else if (stack.at(-1) === entryId && !traversalRequested) {
            traversalRequested = true;
            window.history.back();
          }
        };
        // Escape can close a confirmation and its parent together. Wait for
        // the child's asynchronous pop before removing the parent's entry.
        cancelPendingCleanup.current = cancel;
        window.addEventListener("popstate", removeEntry);
        removeEntry();
      }, 0);
    };
  }, [active, entryId]);
}

export function useBodyRef() {
  return useRef<HTMLDivElement>(null);
}
