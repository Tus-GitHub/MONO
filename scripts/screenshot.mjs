/**
 * Visual QA — drives the running app with system Chrome (via puppeteer-core, no bundled
 * browser) and captures light/dark, phone/tablet/desktop screenshots, asserting no page has
 * horizontal overflow.
 *
 *   npm run start            # in one terminal (or: npm run dev)
 *   npm run screenshot        # -> ./.screenshots
 *   BASE_URL=http://localhost:3000 OUT_DIR=/tmp/shots npm run screenshot
 */
import { mkdir } from "node:fs/promises";

import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.OUT_DIR || process.argv[2] || ".screenshots";

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1440, height: 1000 },
};

/** Public routes only — authenticated pages need a real database session. */
const ROUTES = [
  { path: "/", name: "landing", full: true },
  { path: "/login", name: "login" },
  { path: "/register", name: "register", full: true },
  { path: "/forgot-password", name: "forgot" },
  // Dev-only component gallery (404s in production builds).
  { path: "/style", name: "style", full: true },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars"],
});

await mkdir(OUT, { recursive: true });
let overflowFound = false;

for (const scheme of ["light", "dark"]) {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    for (const route of ROUTES) {
      const page = await browser.newPage();
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
      await page.setViewport({ ...vp, deviceScaleFactor: 2 });
      await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle0" });
      await page.evaluateHandle("document.fonts.ready");
      await new Promise((r) => setTimeout(r, 300));

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      const overflow = scrollWidth > clientWidth;
      if (overflow) overflowFound = true;

      const file = `${OUT}/${scheme}-${vpName}-${route.name}.png`;
      await page.screenshot({ path: file, fullPage: Boolean(route.full) });
      console.log(
        `${overflow ? "OVERFLOW " : "ok       "}${scheme}/${vpName}/${route.name}  (${scrollWidth}px)`,
      );
      await page.close();
    }
  }
}

await browser.close();
console.log(overflowFound ? "\nFAIL: horizontal overflow detected" : "\nOK: no horizontal overflow");
process.exit(overflowFound ? 1 : 0);
