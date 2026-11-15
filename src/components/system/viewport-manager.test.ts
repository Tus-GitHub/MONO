import { afterEach, expect, it, vi } from "vitest";
import { ViewportManager } from "./viewport-manager";

const lifecycle = vi.hoisted(() => ({ cleanup: undefined as undefined | (() => void) }));
vi.mock("react", () => ({ useEffect: (effect: () => (() => void)) => { lifecycle.cleanup = effect(); } }));
afterEach(() => { lifecycle.cleanup?.(); lifecycle.cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

function keyboardFixture(chat: boolean, innerHeight = 844, nested = false, keepFocus = false) {
  vi.useFakeTimers();
  const events = new Map<string, (event?: { target: unknown; defaultPrevented: boolean }) => void>();
  const root = { clientHeight: 844, style: { setProperty: vi.fn(), removeProperty: vi.fn(), scrollBehavior: "" }, setAttribute: vi.fn(), removeAttribute: vi.fn() };
  const scroller = { style: { scrollBehavior: "" }, parentElement: null, scrollHeight: 1000, clientHeight: 300, scrollTop: 100,
    scrollBy: vi.fn(({ top }: { top: number }) => { scroller.scrollTop += top; }) };
  class Field {
    isConnected = true;
    parentElement = nested ? scroller : null;
    matches(selector: string) { return selector === "input,select,textarea,[contenteditable]"; }
    closest(selector: string) { return chat && selector === ".mono-chat-page" ? {} : null; }
    getBoundingClientRect() { const shift = nested ? 100 - scroller.scrollTop : 0; return { top: 150 + shift, bottom: 194 + shift }; }
  }
  const scrollBy = vi.fn();
  const viewport = { height: 400, offsetTop: 200, scale: 1, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal("HTMLElement", Field);
  vi.stubGlobal("getComputedStyle", () => ({ overflowY: "auto" }));
  vi.stubGlobal("document", { documentElement: root, body: {}, activeElement: new Field(), querySelector: () => null,
    addEventListener: (name: string, handler: () => void) => events.set(name, handler), removeEventListener: vi.fn() });
  vi.stubGlobal("window", { visualViewport: viewport, innerHeight, matchMedia: () => ({ matches: true }), screen: {}, scrollBy,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), setTimeout, clearTimeout });
  vi.stubGlobal("requestAnimationFrame", (work: () => void) => { work(); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  ViewportManager();
  events.get("focusin")!();
  if (keepFocus) events.get("pointerdown")!({ target: {}, defaultPrevented: true });
  vi.advanceTimersByTime(300);
  return { root, scrollBy, scroller };
}

it("updates the shifted iPhone viewport without scrolling fixed chat a second time", () => {
  const { root, scrollBy } = keyboardFixture(true);
  expect(root.style.setProperty).toHaveBeenCalledWith("--vvh", "400px");
  expect(root.style.setProperty).toHaveBeenCalledWith("--vv-top", "200px");
  expect(scrollBy).not.toHaveBeenCalled();
});
it("still reveals covered fields on ordinary forms", () => {
  const { scrollBy } = keyboardFixture(false);
  expect(scrollBy).toHaveBeenCalledWith({ top: -58, behavior: "auto" });
});
it("uses the layout viewport when iPhone innerHeight already excludes the keyboard", () => {
  const { root, scrollBy } = keyboardFixture(true, 400);
  expect(root.style.setProperty).toHaveBeenCalledWith("--vvh", "400px");
  expect(root.style.setProperty).toHaveBeenCalledWith("--vv-top", "200px");
  expect(root.style.setProperty).toHaveBeenCalledWith("--kb", "244px");
  expect(root.setAttribute).toHaveBeenCalledWith("data-kb", "open");
  expect(scrollBy).not.toHaveBeenCalled();
});
it("reveals a covered chat field inside its nested scroller without moving the document", () => {
  const { scrollBy, scroller } = keyboardFixture(true, 844, true);
  expect(scroller.scrollBy).toHaveBeenCalledWith({ top: -58, behavior: "auto" });
  expect(scroller.scrollTop).toBe(42);
  expect(scrollBy).not.toHaveBeenCalled();
});
it("keeps focus correction active when Send prevents pointer focus transfer", () => {
  const { scrollBy, scroller } = keyboardFixture(true, 844, true, true);
  expect(scroller.scrollBy).toHaveBeenCalledWith({ top: -58, behavior: "auto" });
  expect(scrollBy).not.toHaveBeenCalled();
});
