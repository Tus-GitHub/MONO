import assert from "node:assert/strict";
import path from "node:path";

// A real service worker is installed after hydration/form entry, as it can be on a slow
// first visit. Only registration timing is delayed; no account is submitted or verified.
export async function runFirstVisit({ browser, baseUrl, artifactDir }) {
  let checks = 0;
  const pass = (label) => { checks++; console.log(`PASS first visit: ${label}`); };
  for (const route of ["/register", "/verify-email"]) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(60_000);
      await page.setViewport({ width: 390, height: 844 });
      let documentRequests = 0;
      page.on("request", (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests++;
      });
      await page.evaluateOnNewDocument(() => {
        const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
        let first = true;
        navigator.serviceWorker.register = async (...args) => {
          if (first) {
            first = false;
            await new Promise((resolve) => { window.releaseFirstWorker = resolve; });
          }
          return register(...args);
        };
      });
      const token = "a".repeat(43); // Invalid fixture capability: never submitted.
      const url = new URL(route, baseUrl);
      if (route === "/verify-email") url.hash = `token=${token}`;
      const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 90_000 });
      assert.equal(response.status(), 200);
      await page.waitForFunction(() => typeof window.releaseFirstWorker === "function");
      if (route === "/register") await page.locator('[name="name"]').fill("Unsaved registration draft");
      else {
        await page.waitForSelector('input[name="token"]');
        assert.equal(new URL(page.url()).hash, "");
      }
      const before = documentRequests;
      await page.evaluate(() => window.releaseFirstWorker());
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      // Allow controllerchange/reload work to finish instead of asserting in its event turn.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      assert.equal(documentRequests, before, `Initial worker claim reloaded ${route}`);
      if (route === "/register") {
        assert.equal(await page.$eval('[name="name"]', (input) => input.value), "Unsaved registration draft");
        pass("first worker claim preserves a registration draft without reloading");
      } else {
        assert.equal(await page.$eval('[name="token"]', (input) => input.value), token);
        assert.equal(new URL(page.url()).hash, "");
        pass("first worker claim preserves the scrubbed verification capability");
      }
      await page.screenshot({ path: path.join(artifactDir, `first-visit-${route.slice(1)}.png`), fullPage: true });

      if (route === "/register") {
        // A genuinely replaced controller must still reload a controlled page onto the
        // updated build. Changing the script URL installs the same real worker anew.
        const beforeUpdate = documentRequests;
        const reloaded = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.evaluate(() => {
          void navigator.serviceWorker.register(`/sw.js?first-visit-update=${Date.now()}`);
        });
        await reloaded;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        assert.equal(documentRequests, beforeUpdate + 1, "Replacing an existing worker should reload once");
        pass("an existing controller update still reloads exactly once");
      }
    } finally { await context.close(); }
  }
  return { checks };
}
