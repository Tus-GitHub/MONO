"use client";
import { useEffect, useRef, type PointerEvent, type MouseEvent, type KeyboardEvent, type RefObject } from "react";
import { clampFloatingCall } from "@/lib/together/floating-call";

/** Pointer capture keeps dragging reliable on touch screens without moving the video DOM. */
export function useFloatingCall(ref: RefObject<HTMLDivElement | null>, active: boolean) {
  const position = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean; handle: HTMLElement } | null>(null);
  const suppressClick = useRef(false);
  const apply = (point: { x: number; y: number }) => {
    const node = ref.current; if (!node) return;
    const rect = node.getBoundingClientRect(), vv = window.visualViewport;
    const next = clampFloatingCall(point, rect, { left: vv?.offsetLeft ?? 0, top: vv?.offsetTop ?? 0,
      width: vv?.width ?? innerWidth, height: vv?.height ?? innerHeight,
      inset: parseFloat(getComputedStyle(node).getPropertyValue("--call-drag-inset")) || 12 });
    position.current = next; node.style.left = `${next.x}px`; node.style.top = `${next.y}px`; node.style.right = "auto";
  };
  const applyRef = useRef(apply); useEffect(() => { applyRef.current = apply; });
  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const fit = () => { const rect = node.getBoundingClientRect(); applyRef.current(position.current ?? { x: rect.left, y: rect.top }); };
    fit(); window.addEventListener("resize", fit); window.visualViewport?.addEventListener("resize", fit); window.visualViewport?.addEventListener("scroll", fit);
    const observer = new ResizeObserver(fit); observer.observe(node);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("scroll", fit); node.style.removeProperty("left"); node.style.removeProperty("top"); node.style.removeProperty("right"); drag.current = null; };
  }, [active, ref]);
  const isHandle = (target: EventTarget) => target instanceof Element && !!target.closest("[data-call-drag]");
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (!active || !event.isPrimary || event.button !== 0 || !isHandle(event.target)) return;
      const rect = event.currentTarget.getBoundingClientRect(); suppressClick.current = false;
      const handle = (event.target as Element).closest<HTMLElement>("[data-call-drag]")!;
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false, handle };
      handle.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const current = drag.current; if (!current || current.id !== event.pointerId) return;
      const dx = event.clientX - current.x, dy = event.clientY - current.y;
      if (Math.hypot(dx, dy) > 6) current.moved = true;
      if (current.moved) { event.preventDefault(); apply({ x: current.left + dx, y: current.top + dy }); }
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      if (drag.current?.id !== event.pointerId) return;
      const { handle, moved } = drag.current; suppressClick.current = moved; drag.current = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    },
    onPointerCancel: () => { drag.current = null; suppressClick.current = true; },
    onClickCapture: (event: MouseEvent<HTMLDivElement>) => { if (suppressClick.current) { suppressClick.current = false; if (event.detail !== 0) { event.preventDefault(); event.stopPropagation(); } } },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (!active || !isHandle(event.target) || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(), step = event.shiftKey ? 32 : 12;
      apply({ x: rect.left + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), y: rect.top + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) });
    },
  };
}
