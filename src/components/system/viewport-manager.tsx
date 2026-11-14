"use client";

import { useEffect } from "react";
import { focusScrollDelta, viewportGeometry } from "@/lib/browser/viewport";

/** Match fixed UI and focused fields to the visible area without disabling native zoom. */
export function ViewportManager() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;

    let frame = 0;
    let focusTimer: number | undefined;
    let baselineHeight = window.innerHeight;
    let keyboardOpen = false;
    let checkFocus = false;
    let allowFocusScroll = true;
    const touch = window.matchMedia("(any-pointer: coarse)").matches;
    const editable = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !el.matches("input,select,textarea,[contenteditable]")) return null;
      if (el.matches('[readonly],[disabled],[contenteditable="false"],[type="checkbox"],[type="radio"],[type="range"],[type="button"],[type="submit"],[type="file"]')) return null;
      return el;
    };
    const geometry = () => viewportGeometry({
      layoutHeight: window.innerHeight, visualHeight: vv.height, visualTop: vv.offsetTop,
      scale: vv.scale, baselineHeight, editing: Boolean(editable()), keyboardWasOpen: keyboardOpen, touch,
    });
    const cancelFocusScroll = () => window.clearTimeout(focusTimer);
    const move = (element: HTMLElement, top: number, page = false) => {
      const previous = element.style.scrollBehavior;
      element.style.scrollBehavior = "auto";
      try { (page ? window : element).scrollBy({ top, behavior: "auto" }); }
      finally { element.style.scrollBehavior = previous; }
    };
    const nudgeFocus = () => {
      const el = editable();
      if (!el || !el.isConnected || !allowFocusScroll || Math.abs(vv.scale - 1) > 0.01) return;
      const view = geometry();
      const header = el.closest('[role="dialog"]') ? null : document.querySelector(".mono-appheader,.mono-setup-header");
      const hr = header?.getBoundingClientRect();
      const visibleTop = Math.max(view.top + 8, hr && hr.top <= view.top && hr.bottom > view.top ? hr.bottom + 8 : 0);
      const delta = () => {
        const rect = el.getBoundingClientRect();
        return focusScrollDelta(rect.top, rect.bottom, visibleTop, view.top + view.height - 8, view.keyboardOpen);
      };
      // Nearest-layout scrolling can no-op behind iOS's keyboard. Correct visual occlusion
      // once after it settles, consuming nested scroll areas before moving the page.
      for (let parent = el.parentElement; parent && Math.abs(delta()) > 1; parent = parent.parentElement) {
        if (parent === document.body || parent === root) break;
        if (parent.scrollHeight > parent.clientHeight && /^(auto|scroll)$/.test(getComputedStyle(parent).overflowY)) {
          move(parent, delta());
        }
      }
      if (Math.abs(delta()) > 1) move(root, delta(), true);
    };
    const apply = () => {
      frame = 0;
      if (vv.height <= 0) return;
      const view = geometry();
      keyboardOpen = view.keyboardOpen;
      if (!editable() && !keyboardOpen && Math.abs(vv.scale - 1) <= 0.01) baselineHeight = window.innerHeight;
      root.style.setProperty("--kb", `${Math.round(view.bottom)}px`);
      root.style.setProperty("--vvh", `${Math.round(view.height)}px`);
      root.style.setProperty("--vv-top", `${Math.round(view.top)}px`);
      if (keyboardOpen) root.setAttribute("data-kb", "open");
      else root.removeAttribute("data-kb");
      if (checkFocus && allowFocusScroll) {
        cancelFocusScroll();
        focusTimer = window.setTimeout(nudgeFocus, 300);
      }
      checkFocus = false;
    };
    const schedule = (focus = false) => {
      checkFocus ||= focus;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onResize = () => schedule(true);
    const onScroll = () => schedule();
    const onOrientation = () => {
      const angle = (window as Window & { orientation?: number }).orientation ?? window.screen.orientation?.angle;
      const landscape = angle === undefined ? innerWidth > innerHeight : Math.abs(angle) % 180 === 90;
      baselineHeight = touch
        ? (landscape ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height))
        : window.innerHeight;
      schedule(true);
    };
    const onFocusIn = () => {
      if (!editable()) return;
      baselineHeight = Math.max(baselineHeight, window.innerHeight);
      allowFocusScroll = true;
      schedule(true);
    };
    const onFocusOut = () => { allowFocusScroll = false; cancelFocusScroll(); schedule(); };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target !== document.activeElement) { allowFocusScroll = false; cancelFocusScroll(); }
    };

    apply();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrientation);
    window.screen.orientation?.addEventListener("change", onOrientation);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      cancelFocusScroll();
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrientation);
      window.screen.orientation?.removeEventListener("change", onOrientation);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onPointerDown);
      for (const property of ["--kb", "--vvh", "--vv-top"]) root.style.removeProperty(property);
      root.removeAttribute("data-kb");
    };
  }, []);
  return null;
}
