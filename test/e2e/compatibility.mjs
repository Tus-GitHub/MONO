import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { bodyContains, clickText, fill, go, waitFor } from "./journey.mjs";

/** Native browser operations shared by Chromium and Firefox, without CDP emulation. */
export async function runCompatibility({ browser, baseUrl, prisma, runId, artifactDir }) {
  let checks = 0, stage = "fixture setup";
  const contexts = [], pages = [], errors = [];
  const pass = (label) => { checks++; console.log(`PASS compatibility: ${label}`); };
  const password = `CompatibilityA9-${randomBytes(8).toString("hex")}`;
  const passwordHash = await bcrypt.hash(password, 12);
  const users = await Promise.all(["owner", "partner"].map((name) => prisma.user.create({ data: {
    email: `e2e-${runId}-compatibility-${name}@example.invalid`, name: `Compatibility ${name}`,
    passwordHash, profileCompletedAt: new Date(),
  } })));
  const couple = await prisma.couple.create({ data: {
    name: "Compatibility fixture", createdById: users[0].id, inviteCode: randomBytes(12).toString("hex"),
    timezone: "America/New_York", currency: "USD", status: "ACTIVE", setupCompletedAt: new Date(),
    members: { create: users.map((user, n) => ({ userId: user.id, role: n ? "PARTNER" : "OWNER", joinedAt: new Date() })) },
    reviewCategories: { create: { key: "connection", label: "Connection", sortOrder: 0 } },
  } });
  const plan = await prisma.date.create({ data: { coupleId: couple.id, createdById: users[0].id, title: "Keyboard plan", status: "DRAFT" } });
  const completed = await prisma.date.create({ data: { coupleId: couple.id, createdById: users[0].id, title: "Compatibility evening", status: "COMPLETED", completedAt: new Date(), currency: "USD" } });
  const pendingReview = await prisma.date.create({ data: { coupleId: couple.id, createdById: users[0].id, title: "Unreviewed compatibility evening", status: "COMPLETED", completedAt: new Date(), currency: "USD" } });
  async function login(user) {
    const context = await browser.createBrowserContext(); contexts.push(context);
    const page = await context.newPage(); pages.push(page);
    page.setDefaultTimeout(60_000);
    await page.setViewport({ width: 1280, height: 900 });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => void dialog.accept());
    await go(page, baseUrl, "/login");
    await fill(page, 'input[name="email"]', user.email);
    await fill(page, 'input[name="password"]', password);
    await page.focus('input[name="password"]');
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => location.pathname === "/home");
    return page;
  }
  async function keyboardClick(page, label, selector = "button", prefix = false) {
    const find = (label, selector, prefix) => [...document.querySelectorAll(selector)].find((node) => {
      const text = node.textContent.trim().replace(/\s+/g, " ");
      return (prefix ? text.startsWith(label) : text === label) && !node.disabled && node.getClientRects().length;
    });
    await page.waitForFunction(find, {}, label, selector, prefix);
    const handle = await page.evaluateHandle(find, label, selector, prefix);
    assert(await handle.evaluate((node) => Boolean(node)), `Missing keyboard target: ${label}`);
    await handle.asElement().focus();
    await page.keyboard.press("Enter");
    await handle.dispose();
  }
  try {
    const owner = await login(users[0]), partner = await login(users[1]);
    assert.equal(await prisma.authSession.count({ where: { userId: { in: users.map((u) => u.id) }, revokedAt: null } }), 2);
    pass("both members sign in with Enter and get stored device sessions");

    stage = "notification checkbox names and persistence";
    await go(owner, baseUrl, "/settings/notifications");
    const labels = await owner.$$eval('input[type="checkbox"][name]', (inputs) => inputs.map((input) => ({
      name: input.name,
      label: input.getAttribute("aria-label") || (input.getAttribute("aria-labelledby") || "").split(/\s+/).map((id) => document.getElementById(id)?.textContent.trim() || "").join(" ").trim() || [...input.labels].map((label) => label.textContent.trim()).join(" ").trim(),
    })));
    assert.equal(labels.length, 6);
    assert(labels.every((item) => item.label), `Checkboxes lack accessible names: ${labels.filter((item) => !item.label).map((item) => item.name).join(", ")}`);
    assert.equal(new Set(labels.map((item) => item.label)).size, 6);
    await owner.focus('input[name="upcomingDate"]');
    await owner.keyboard.press(" ");
    assert.equal(await owner.$eval('input[name="upcomingDate"]', (node) => node.checked), false, "Space toggles the focused native checkbox");
    await keyboardClick(owner, "Save preferences");
    await waitFor(async () => (await prisma.notificationPreference.findUnique({ where: { userId: users[0].id } }))?.upcomingDate === false, "keyboard preference saved");
    await owner.reload({ waitUntil: "networkidle2" });
    assert.equal(await owner.$eval('input[name="upcomingDate"]', (node) => node.checked), false);
    assert.equal(await prisma.notificationPreference.count({ where: { userId: users[1].id, upcomingDate: false } }), 0);
    pass("named notification checkboxes work with Space and persist only for their owner");

    stage = "plan keyboard and native time fields";
    await go(owner, baseUrl, `/plan/${plan.id}?step=basics`);
    await fill(owner, 'input[name="title"]', "Keyboard dinner plan");
    await keyboardClick(owner, "Tomorrow");
    const plannedDay = await owner.$eval('input[name="date"]', (node) => node.value);
    assert.match(plannedDay, /^\d{4}-\d{2}-\d{2}$/);
    for (const [selector, value] of [['input[aria-label="Start time — custom time"]', "18:35"], ['input[aria-label="End time — custom time"]', "20:45"]]) {
      await owner.$eval(selector, (node, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(node, value);
        node.dispatchEvent(new Event("input", { bubbles: true })); node.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
    }
    await fill(owner, 'textarea[name="notes"]', "Saved with the keyboard");
    await keyboardClick(owner, "Save & continue");
    await bodyContains(owner, "How much are we planning to spend?");
    const savedPlan = await prisma.date.findUniqueOrThrow({ where: { id: plan.id } });
    assert.equal(savedPlan.title, "Keyboard dinner plan");
    assert.equal(savedPlan.scheduledFor.toISOString().slice(0, 10), plannedDay);
    assert.equal(savedPlan.plannedStartAt.toISOString().slice(11, 16), "18:35");
    assert.equal(savedPlan.plannedEndAt.toISOString().slice(11, 16), "20:45");
    pass("date shortcut and native custom times survive a keyboard plan save");

    stage = "review keyboard scale";
    await go(owner, baseUrl, `/dates/${completed.id}/review`);
    await owner.focus('[role="slider"]');
    for (const [key, expected] of [["End", "10"], ["Home", "1"], ["ArrowRight", "2"], ["Delete", null], ["ArrowUp", "1"]]) {
      await owner.keyboard.press(key);
      assert.equal(await owner.$eval('[role="slider"]', (node) => node.getAttribute("aria-valuenow")), expected);
    }
    await owner.keyboard.press("End");
    await owner.focus('[role="slider"][aria-labelledby]');
    await fill(owner, 'textarea[name="lovedText"]', "Owner private compatibility reflection");
    await keyboardClick(owner, "Save draft");
    await waitFor(async () => (await prisma.dateReview.findUnique({ where: { dateId_authorId: { dateId: completed.id, authorId: users[0].id } } }))?.overallRating === 10, "keyboard review draft saved");
    await go(partner, baseUrl, `/dates/${completed.id}`);
    assert.doesNotMatch(await partner.$eval("body", (node) => node.innerText), /Owner private compatibility reflection/);
    pass("review arrow Home End Delete controls save a private keyboard draft");

    stage = "blind review submission and reveal";
    await go(owner, baseUrl, `/dates/${completed.id}/review`);
    await keyboardClick(owner, "Definitely", "button", true);
    await keyboardClick(owner, "Submit my side");
    await waitFor(async () => Boolean((await prisma.dateReview.findUnique({ where: { dateId_authorId: { dateId: completed.id, authorId: users[0].id } } }))?.submittedAt), "first review submitted");
    await go(partner, baseUrl, `/dates/${completed.id}`);
    assert.doesNotMatch(await partner.$eval("body", (node) => node.innerText), /Owner private compatibility reflection/);
    await go(partner, baseUrl, `/dates/${completed.id}/review`);
    await partner.focus('[role="slider"]'); await partner.keyboard.press("End");
    await fill(partner, 'textarea[name="lovedText"]', "Partner compatibility reflection");
    await keyboardClick(partner, "Definitely", "button", true);
    await keyboardClick(partner, "Submit my side");
    await waitFor(async () => Boolean((await prisma.dateReview.findUnique({ where: { dateId_authorId: { dateId: completed.id, authorId: users[1].id } } }))?.submittedAt), "both reviews submitted");
    await go(owner, baseUrl, `/dates/${completed.id}`);
    await clickText(owner, "Reveal the comparison");
    await bodyContains(owner, "Partner compatibility reflection");
    pass("one-sided submissions stay private and both submitted reviews reveal");

    stage = "completed review redirect";
    await go(owner, baseUrl, `/dates/${completed.id}/review`);
    await owner.waitForFunction((id) => location.pathname === `/dates/${id}`, {}, completed.id);
    await bodyContains(owner, "Compatibility evening");
    pass("the locked review route finishes its client redirect to the shared date");

    stage = "photo upload and modal keyboard";
    await go(owner, baseUrl, `/dates/${completed.id}`);
    const photoFile = join(artifactDir, "compatibility-fixture.png");
    await sharp({ create: { width: 48, height: 32, channels: 3, background: "#60756a" } }).png().toFile(photoFile);
    await (await owner.waitForSelector('input[type="file"][multiple]')).uploadFile(photoFile);
    await waitFor(async () => await prisma.datePhoto.count({ where: { dateId: completed.id, deletedAt: null } }) === 1, "native browser photo upload");
    await owner.waitForSelector('button[aria-label="Open photo 1"]');
    await owner.focus('button[aria-label="Open photo 1"]'); await owner.keyboard.press("Enter");
    await owner.waitForSelector('[role="dialog"]');
    await owner.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Make this the best photo");
    await owner.keyboard.down("Shift"); await owner.keyboard.press("Tab"); await owner.keyboard.up("Shift");
    assert(await owner.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement)));
    await owner.keyboard.press("Escape");
    await owner.waitForSelector('[role="dialog"]', { hidden: true });
    assert.equal(await owner.evaluate(() => history.state?.monoOverlay?.length ?? 0), 0);
    assert.equal(await owner.evaluate(() => document.body.style.overflow), "");
    assert.equal(await owner.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Open photo 1");
    pass("multipart photo upload and keyboard viewer focus close and restore correctly");

    stage = "member-only private media";
    const photo = await prisma.datePhoto.findFirstOrThrow({ where: { dateId: completed.id, deletedAt: null } });
    assert.equal(await partner.evaluate(async (url) => (await fetch(url)).status, photo.url), 200);
    const anonymousContext = await browser.createBrowserContext(); contexts.push(anonymousContext);
    const anonymous = await anonymousContext.newPage(); pages.push(anonymous);
    await go(anonymous, baseUrl, "/login");
    assert.equal(await anonymous.evaluate(async (url) => (await fetch(url)).status, photo.url), 404);
    pass("photo bytes are accessible to the partner and denied to an anonymous browser");

    stage = "calendar keyboard navigation";
    await go(owner, baseUrl, `/dates?month=${plannedDay.slice(0, 7)}`);
    await owner.focus('a[aria-label="Next month"]'); await owner.keyboard.press("Enter");
    await owner.waitForFunction((month) => new URL(location.href).searchParams.get("month") !== month, {}, plannedDay.slice(0, 7));
    await owner.focus('a[aria-label="Previous month"]'); await owner.keyboard.press("Enter");
    await owner.waitForFunction((month) => new URL(location.href).searchParams.get("month") === month, {}, plannedDay.slice(0, 7));
    await owner.focus(`a[href="/dates?month=${plannedDay.slice(0, 7)}&day=${plannedDay}"]`); await owner.keyboard.press("Enter");
    await owner.waitForFunction((day) => new URL(location.href).searchParams.get("day") === day, {}, plannedDay);
    pass("calendar month and day links can be followed with the keyboard");

    stage = "PWA resources and cache isolation";
    const resources = await owner.evaluate(async () => {
      const manifest = await fetch("/manifest.webmanifest").then((r) => r.json());
      const icons = await Promise.all(manifest.icons.map(async (icon) => ({ src: icon.src, status: (await fetch(icon.src)).status })));
      await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready;
      return { name: manifest.short_name, icons };
    });
    assert.equal(resources.name, "MONO"); assert(resources.icons.every((icon) => icon.status === 200));
    await owner.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await go(owner, baseUrl, `/dates/${completed.id}`);
    const cachePaths = await owner.evaluate(async () => {
      await fetch("/api/account/sessions");
      return (await Promise.all((await caches.keys()).map(async (name) => (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname)))).flat();
    });
    assert(cachePaths.includes("/offline"));
    assert(!cachePaths.some((path) => path.startsWith("/api/") || path.startsWith("/media/") || path.startsWith("/dates/")));
    pass("manifest icons and service worker work without caching private routes or APIs");

    stage = "phone and enlarged text";
    for (const path of ["/home", "/dates", `/dates/${completed.id}`, `/dates/${pendingReview.id}/review`, "/settings/notifications"]) {
      await owner.setViewport({ width: 320, height: 740 });
      await go(owner, baseUrl, path);
      assert(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `Phone overflow: ${path}`);
      if (path === "/settings/notifications") await owner.screenshot({ path: join(artifactDir, "compatibility-normal-text.png"), fullPage: true });
      await owner.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      assert(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `Enlarged text overflow: ${path}`);
      const clipped = await owner.evaluate(() => [...document.querySelectorAll('header a[aria-label], header button, main button[type="submit"], .mono-bottom-nav a')].filter((node) => {
        if (!node.getClientRects().length || getComputedStyle(node).visibility === "hidden") return false;
        const rect = node.getBoundingClientRect();
        return rect.left < -2 || rect.right > innerWidth + 2;
      }).map((node) => ({ label: node.getAttribute("aria-label") || node.textContent.trim(), left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right })));
      assert.deepEqual(clipped, [], `Clipped controls with enlarged text: ${path}`);
      const overlaps = await owner.evaluate(() => {
        const links = [...document.querySelectorAll('.mono-bottom-nav a')].map((node) => ({ label: node.getAttribute("aria-label") || node.textContent.trim(), box: node.getBoundingClientRect() }));
        return links.slice(1).filter((item, n) => links[n].box.right > item.box.left + 2).map((item) => item.label);
      });
      assert.deepEqual(overlaps, [], `Overlapping navigation targets with enlarged text: ${path}`);
    }
    await owner.screenshot({ path: join(artifactDir, "compatibility-enlarged-text.png"), fullPage: true });
    pass("five core routes fit a 320px viewport with normal and doubled root text");
    assert.deepEqual(errors, []);
    return { checks };
  } catch (error) {
    const state = await Promise.all(pages.map((page) => page.evaluate(() => ({ url: location.href, active: document.activeElement?.outerHTML.slice(0, 500), buttons: [...document.querySelectorAll("button")].map((b) => b.textContent.trim()), body: document.body.innerText.slice(0, 5000) })).catch(() => null)));
    await writeFile(join(artifactDir, "compatibility-failure.json"), JSON.stringify({ stage, message: error.message, errors, state }, null, 2));
    for (let n = 0; n < pages.length; n++) await pages[n].screenshot({ path: join(artifactDir, `compatibility-failure-${n}.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally { await Promise.all(contexts.map((context) => context.close())); }
}
