import assert from "node:assert/strict";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import sharp from "sharp";

/** Real server-action pagination, including equal completion timestamps across the page boundary. */
export async function runPagination({ browser, baseUrl, prisma, runId, artifactDir, storageRoot }) {
  const mediaRoot = storageRoot ?? process.env.STORAGE_LOCAL_ROOT;
  assert(mediaRoot, "Pagination E2E requires the isolated server storage root.");
  const password = `E2e-Pagination-${runId}!`;
  const user = await prisma.user.create({ data: {
    email: `e2e-${runId}-pagination-owner@example.invalid`, name: "Pagination fixture",
    passwordHash: await bcrypt.hash(password, 12), profileCompletedAt: new Date(),
  } });
  const partner = await prisma.user.create({ data: {
    email: `e2e-${runId}-pagination-partner@example.invalid`, name: "Pagination partner",
    passwordHash: user.passwordHash, profileCompletedAt: new Date(),
  } });
  const couple = await prisma.couple.create({ data: {
    name: "Pagination fixture", createdById: user.id, inviteCode: `paging-${runId}`,
    status: "ACTIVE", setupCompletedAt: new Date(), timezone: "UTC",
    members: { create: [{ userId: user.id, role: "OWNER" }, { userId: partner.id, role: "PARTNER" }] },
  } });
  const key = `couples/${couple.id}/e2e/photo.png`;
  const file = path.resolve(mediaRoot, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 65, g: 105, b: 85 } } }).png().toBuffer());
  const completedAt = new Date("2026-10-01T12:00:00.000Z");
  const amount = 53; // First page is 48; remaining five must use the compound cursor action.
  for (let n = 0; n < amount; n++) {
    const date = await prisma.date.create({ data: {
      title: `Pagination date ${String(n).padStart(2, "0")}`, coupleId: couple.id,
      createdById: user.id, status: "COMPLETED", completedAt, scheduledFor: completedAt,
    } });
    const photo = await prisma.datePhoto.create({ data: {
      dateId: date.id, uploadedById: user.id, storageKey: key, displayKey: key, thumbKey: key,
      url: `/media/${key}`, contentType: "image/png", width: 16, height: 16,
    } });
    await prisma.date.update({ where: { id: date.id }, data: { bestPhotoId: photo.id } });
  }
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(45_000);
  await page.setViewport({ width: 1280, height: 800 });
  let checks = 0;
  const pass = (name) => { checks++; console.log(`PASS pagination: ${name}`); };
  async function clickText(label) {
    // The phone layout keeps a hidden desktop Sign out button in the DOM.
    // Accessibility selectors skip it; locators also wait for modal animation
    // and scroll offscreen controls into view before clicking.
    await page.locator(`aria/${label}[role="button"]`).click();
  }
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle0" });
    await page.type('input[name="email"]', user.email);
    await page.type('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !location.pathname.startsWith("/login") && !location.pathname.startsWith("/onboarding"));
    const cookie = (await page.cookies()).find((item) => item.httpOnly && item.name.includes("session"));
    assert(cookie, "UI login must issue a real httpOnly session cookie.");
    pass("fixture signs in through the real login form");
    await page.goto(`${baseUrl}/memories/photos`, { waitUntil: "networkidle0" });
    const selector = 'button[aria-label^="Open photo from Pagination date"]';
    await page.waitForSelector(selector);
    assert.equal(await page.$$eval(selector, (nodes) => nodes.length), 48);
    pass("first page renders exactly 48 chosen photos");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction((selector, count) => document.querySelectorAll(selector).length === count, {}, selector, amount);
    const labels = await page.$$eval(selector, (nodes) => nodes.map((node) => node.getAttribute("aria-label")));
    assert.equal(new Set(labels).size, amount);
    assert.equal(await page.$$eval("button", (nodes) => nodes.filter((node) => node.textContent.trim() === "Load more").length), 0);
    pass("compound cursor loads all 53 tied-time photos once and reaches the end");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    assert(width.content <= width.viewport + 1, "Photo wall must fit the phone viewport.");
    await mkdir(artifactDir, { recursive: true });
    await page.screenshot({ path: path.join(artifactDir, "pagination-phone.png") });
    pass("existing photo wall fits the phone viewport");

    const draftDate = await prisma.date.create({ data: {
      title: "Private browser draft fixture", coupleId: couple.id, createdById: user.id,
      status: "COMPLETED", completedAt,
    } });
    await page.evaluate((id) => localStorage.setItem(`mono:memory:${id}:body`, JSON.stringify({ version: 1, base: JSON.stringify(""), value: "Unscoped legacy draft", savedAt: Date.now() })), draftDate.id);
    await page.goto(`${baseUrl}/dates/${draftDate.id}/memory`, { waitUntil: "networkidle0" });
    assert.equal(await page.$eval("#memory-body", (node) => node.value), "");
    await page.type("#memory-body", "Only the first person's unsaved text");
    await page.waitForFunction((key) => localStorage.getItem(key)?.includes("Only the first person"), {}, `mono:memory:${user.id}:${draftDate.id}:body`);
    await page.goto(`${baseUrl}/settings`, { waitUntil: "networkidle0" });
    await clickText("Sign out");
    await page.waitForFunction(() => location.pathname === "/login");
    await page.type('input[name="email"]', partner.email);
    await page.type('input[name="password"]', password);
    await clickText("Sign in");
    await page.waitForFunction(() => location.pathname === "/home");
    await page.goto(`${baseUrl}/dates/${draftDate.id}/memory`, { waitUntil: "networkidle0" });
    assert.equal(await page.$eval("#memory-body", (node) => node.value), "");
    pass("partner login on the same browser sees neither owner nor unscoped legacy drafts");
    await page.type("#memory-body", "A deliberately saved shared memory");
    await clickText("Keep this memory");
    await page.waitForFunction((id) => location.pathname === `/dates/${id}`, {}, draftDate.id);
    assert.equal((await prisma.memory.findUniqueOrThrow({ where: { dateId: draftDate.id } })).body, "A deliberately saved shared memory");
    await page.goto(`${baseUrl}/dates/${draftDate.id}/memory`, { waitUntil: "networkidle0" });
    await clickText("Remove memory");
    await clickText("Remove");
    await page.waitForFunction((id) => location.pathname === `/dates/${id}`, {}, draftDate.id);
    assert((await prisma.memory.findUniqueOrThrow({ where: { dateId: draftDate.id } })).deletedAt);
    await page.goto(`${baseUrl}/dates/${draftDate.id}/memory`, { waitUntil: "networkidle0" });
    assert.equal(await page.$eval("#memory-body", (node) => node.value), "");
    assert(await page.evaluate(() => document.body.textContent.includes("Keep it as a memory")));
    pass("remove-memory confirmation works and reopening the editor excludes deleted text");
    return { checks };
  } catch (error) {
    await mkdir(artifactDir, { recursive: true });
    await page.screenshot({ path: path.join(artifactDir, "pagination-failure.png"), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
    await unlink(file).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}
