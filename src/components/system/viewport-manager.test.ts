import { afterEach, expect, it, vi } from "vitest";
import { ViewportManager } from "./viewport-manager";

const lifecycle = vi.hoisted(() => ({ cleanup: undefined as undefined | (() => void) }));
vi.mock("react", () => ({ useEffect: (effect: () => (() => void)) => { lifecycle.cleanup = effect(); } }));
afterEach(() => { lifecycle.cleanup?.(); lifecycle.cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

function keyboardFixture(chat: boolean) {
  vi.useFakeTimers();
  const events = new Map<string, () => void>();
  const root = { style: { setProperty: vi.fn(), removeProperty: vi.fn(), scrollBehavior: "" }, setAttribute: vi.fn(), removeAttribute: vi.fn() };
  class Field {
    isConnected = true;
    parentElement = null;
    matches(selector: string) { return selector === "input,select,textarea,[contenteditable]"; }
    closest(selector: string) { return chat && selector === ".mono-chat-page" ? {} : null; }
    getBoundingClientRect() { return { top: 150, bottom: 194 }; }
  }
  const scrollBy = vi.fn();
  const viewport = { height: 400, offsetTop: 200, scale: 1, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal("HTMLElement", Field);
  vi.stubGlobal("document", { documentElement: root, body: {}, activeElement: new Field(), querySelector: () => null,
    addEventListener: (name: string, handler: () => void) => events.set(name, handler), removeEventListener: vi.fn() });
  vi.stubGlobal("window", { visualViewport: viewport, innerHeight: 844, matchMedia: () => ({ matches: true }), screen: {}, scrollBy,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), setTimeout, clearTimeout });
  vi.stubGlobal("requestAnimationFrame", (work: () => void) => { work(); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  ViewportManager();
  events.get("focusin")!();
  vi.advanceTimersByTime(300);
  return { root, scrollBy };
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
