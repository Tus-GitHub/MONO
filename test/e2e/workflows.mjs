import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { bodyContains, clickText, fill, go, waitFor } from "./journey.mjs";

async function fillLocalTime(page, value) {
  await page.locator("#ef-when").click();
  // Puppeteer 23's special-input fill writes through React's value tracker.
  // Use the native setter so the subsequent input/change events update controlled state.
  await page.$eval("#ef-when", (input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

export async function runWorkflows({ browser, baseUrl, prisma, runId, artifactDir }) {
  const contexts = [], pages = [], errors = [];
  let checks = 0, stage = "fixture setup";
  const pass = (label) => { checks++; console.log(`PASS workflows: ${label}`); };
  const password = `WorkflowA9-${randomBytes(8).toString("hex")}`;
  const hash = await bcrypt.hash(password, 12);
  const users = await Promise.all(["owner", "partner"].map((person) => prisma.user.create({ data: {
    email: `e2e-${runId}-workflows-${person}@example.invalid`, name: `Workflow ${person}`,
    passwordHash: hash, profileCompletedAt: new Date(),
  } })));
  const couple = await prisma.couple.create({ data: {
    name: "Workflow fixture", createdById: users[0].id, inviteCode: randomBytes(12).toString("hex"),
    timezone: "Asia/Kolkata", currency: "INR", status: "ACTIVE", setupCompletedAt: new Date(),
    members: { create: users.map((user, i) => ({ userId: user.id, role: i ? "PARTNER" : "OWNER", joinedAt: new Date() })) },
  } });
  const source = await prisma.date.create({ data: {
    coupleId: couple.id, createdById: users[0].id, title: "Original browser plan", status: "PLANNED",
    scheduledFor: new Date(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)),
    currency: "INR", expectedBudgetCents: 100000,
    activities: { create: { kind: "PLANNED", title: "Dinner together", sortOrder: 0, durationMinutes: 60, costCents: 90000 } },
  } });
  const completed = await prisma.date.create({ data: {
    coupleId: couple.id, createdById: users[0].id, title: "Expense workflow", currency: "INR",
    status: "COMPLETED", completedAt: new Date(),
  } });
  const expense = await prisma.expense.create({ data: {
    coupleId: couple.id, dateId: completed.id, recordedById: users[0].id, category: "FOOD",
    paidBy: "SHARED", ownerShareCents: 40000, amountCents: 80000, currency: "INR",
    description: "Original dinner", note: "Original note", spentAt: new Date("2026-11-05T12:15:47.123Z"),
  } });
  const layoutPlan = await prisma.date.create({ data: {
    coupleId: couple.id, createdById: users[0].id, title: "Responsive plan", currency: "INR", status: "DRAFT",
  } });
  async function login(user) {
    const context = await browser.createBrowserContext(); contexts.push(context);
    const page = await context.newPage(); pages.push(page);
    page.setDefaultTimeout(60_000);
    await page.setViewport({ width: 1280, height: 900 });
    await page.emulateTimezone("UTC");
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => void dialog.accept());
    await go(page, baseUrl, "/login");
    await fill(page, 'input[name="email"]', user.email);
    await fill(page, 'input[name="password"]', password);
    await clickText(page, "Sign in");
    await page.waitForFunction(() => location.pathname === "/home");
    return page;
  }
  try {
    const owner = await login(users[0]), partner = await login(users[1]);
    stage = "plan edit";
    await go(owner, baseUrl, `/plan/${source.id}?step=basics`);
    await go(partner, baseUrl, `/plan/${source.id}?step=basics`);
    await fill(partner, 'input[name="title"]', "Partner unsaved edit");
    await fill(owner, 'input[name="title"]', "Updated browser plan");
    await fill(owner, 'textarea[name="notes"]', "Saved from the real editor");
    await clickText(owner, "Save & continue");
    await bodyContains(owner, "How much are we planning to spend?");
    assert.equal((await prisma.date.findUniqueOrThrow({ where: { id: source.id } })).title, "Updated browser plan");
    pass("editing an existing plan saves its title and notes");

    stage = "stale partner edit";
    await clickText(partner, "Save & continue");
    await bodyContains(partner, "This plan changed while you were editing.");
    assert.equal(await partner.$eval('input[name="title"]', (input) => input.value), "Partner unsaved edit");
    assert.equal((await prisma.date.findUniqueOrThrow({ where: { id: source.id } })).title, "Updated browser plan");
    pass("a stale partner save is rejected with its typed draft preserved");

    stage = "duplicate plan";
    await go(owner, baseUrl, `/plan/${source.id}?step=review`);
    await clickText(owner, "Duplicate");
    await owner.waitForFunction((id) => location.pathname.startsWith("/plan/") && location.pathname !== `/plan/${id}`, {}, source.id);
    await owner.waitForSelector('input[name="dateId"]');
    const copyId = await owner.$eval('input[name="dateId"]', (input) => input.value);
    const copy = await prisma.date.findUniqueOrThrow({ where: { id: copyId }, include: { activities: true } });
    assert.equal(copy.status, "DRAFT"); assert.equal(copy.title, "Updated browser plan (copy)");
    assert.equal(copy.scheduledFor, null); assert.equal(copy.expectedBudgetCents, 100000);
    assert.equal(copy.activities[0].title, "Dinner together"); assert.equal(copy.activities[0].costCents, 90000);
    pass("duplicate creates a fresh draft with the plan budget and activities");

    stage = "delete draft";
    await go(owner, baseUrl, `/plan/${copyId}?step=review`);
    await clickText(owner, "Delete draft");
    await clickText(owner, "Cancel", '[role="dialog"] button');
    await owner.waitForSelector('[role="dialog"]', { hidden: true });
    assert.equal((await prisma.date.findUniqueOrThrow({ where: { id: copyId } })).deletedAt, null);
    await clickText(owner, "Delete draft");
    await clickText(owner, "Delete", '[role="dialog"] button');
    await owner.waitForFunction(() => location.pathname === "/plan");
    assert((await prisma.date.findUniqueOrThrow({ where: { id: copyId } })).deletedAt);
    assert.equal((await prisma.date.findUniqueOrThrow({ where: { id: source.id } })).deletedAt, null);
    pass("draft deletion can be cancelled, then deletes only the chosen copy");

    stage = "cancel planned date";
    await go(owner, baseUrl, `/plan/${source.id}?step=review`);
    await clickText(owner, "Cancel date");
    await clickText(owner, "Cancel date", '[role="dialog"] button');
    await owner.waitForFunction((id) => location.pathname === `/dates/${id}`, {}, source.id);
    assert.equal((await prisma.date.findUniqueOrThrow({ where: { id: source.id } })).status, "CANCELLED");
    await go(partner, baseUrl, `/dates/${source.id}`);
    await bodyContains(partner, "Updated browser plan");
    pass("cancellation redirects correctly and the partner retains the shared date");

    stage = "expense validation";
    await go(owner, baseUrl, `/dates/${completed.id}`);
    await owner.locator('button[aria-label="Edit expense"]').click();
    assert.equal(await owner.$eval('#ef-when', (input) => input.value), "2026-11-05T17:45", "Editor uses the space timezone even while the device uses UTC");
    await fill(owner, '#ef-amount', "-5");
    await fill(owner, '#ef-desc', "Dinner and dessert");
    await fill(owner, '#ef-note', "Keep this correction");
    await clickText(owner, "Fewer details", "#spending button");
    await clickText(owner, "Add a note or time", "#spending button");
    assert.equal(await owner.$eval('#ef-note', (input) => input.value), "Keep this correction");
    await clickText(owner, "Save", "#spending button");
    await bodyContains(owner, "Check the amount and description.");
    assert.equal(await owner.$eval('#ef-desc', (input) => input.value), "Dinner and dessert");
    assert.equal(await owner.$eval('#ef-note', (input) => input.value), "Keep this correction");
    assert.equal((await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } })).amountCents, 80000);
    pass("rejected expense edits retain typed corrections and leave stored money unchanged");

    stage = "expense update";
    await fill(owner, '#ef-amount', "125.50");
    await clickText(owner, "You paid", "#spending button");
    await clickText(owner, "Fewer details", "#spending button");
    await clickText(owner, "Save", "#spending button");
    await waitFor(async () => (await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } })).amountCents === 12550, "expense correction saved");
    const updated = await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } });
    assert.equal(updated.description, "Dinner and dessert"); assert.equal(updated.note, "Keep this correction");
    assert.equal(updated.paidBy, "OWNER"); assert.equal(updated.ownerShareCents, null);
    assert.equal(updated.spentAt.toISOString(), "2026-11-05T12:15:47.123Z", "Amount-only correction preserves the exact instant");
    await go(partner, baseUrl, `/dates/${completed.id}`);
    await bodyContains(partner, "Dinner and dessert");
    await bodyContains(partner, "Partner paid");
    pass("corrected expense amount, payer and notes persist and are shared");

    stage = "expense local time";
    await owner.locator('button[aria-label="Edit expense"]').click();
    await fillLocalTime(owner, "2026-11-06T00:15");
    await clickText(owner, "Fewer details", "#spending button");
    await clickText(owner, "Add a note or time", "#spending button");
    assert.equal(await owner.$eval('#ef-when', (input) => input.value), "2026-11-06T00:15");
    await clickText(owner, "Save", "#spending button");
    await waitFor(async () => (await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } })).spentAt.toISOString() === "2026-11-05T18:45:00.000Z", "couple local time converted to UTC");
    await go(partner, baseUrl, `/dates/${completed.id}`);
    await partner.locator('button[aria-label="Edit expense"]').click();
    assert.equal(await partner.$eval('#ef-when', (input) => input.value), "2026-11-06T00:15");
    await clickText(partner, "Cancel", "#spending button");
    pass("expense time follows the space timezone across devices and UTC day boundaries");

    stage = "expense DST correction";
    await prisma.couple.update({ where: { id: couple.id }, data: { timezone: "America/New_York" } });
    await go(owner, baseUrl, `/dates/${completed.id}`);
    await owner.locator('button[aria-label="Edit expense"]').click();
    await fillLocalTime(owner, "2026-03-08T02:30");
    await clickText(owner, "Save", "#spending button");
    await bodyContains(owner, "That time does not exist in your space's timezone.");
    assert.equal(await owner.$eval('#ef-when', (input) => input.value), "2026-03-08T02:30");
    assert.equal((await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } })).spentAt.toISOString(), "2026-11-05T18:45:00.000Z");
    await fillLocalTime(owner, "2026-03-08T03:30");
    await clickText(owner, "Save", "#spending button");
    await waitFor(async () => (await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } })).spentAt.toISOString() === "2026-03-08T07:30:00.000Z", "DST gap corrected");
    await prisma.couple.update({ where: { id: couple.id }, data: { timezone: "Asia/Kolkata" } });
    await go(owner, baseUrl, `/dates/${completed.id}`);
    pass("nonexistent DST clock times show an error and remain correctable");

    stage = "expense removal";
    await owner.waitForSelector('button[aria-label="Remove expense"]');
    await owner.locator('button[aria-label="Remove expense"]').click();
    await clickText(owner, "Cancel", '[role="dialog"] button');
    await owner.waitForSelector('[role="dialog"]', { hidden: true });
    assert.equal((await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } })).deletedAt, null);
    await owner.locator('button[aria-label="Remove expense"]').click();
    await clickText(owner, "Remove", '[role="dialog"] button');
    await waitFor(async () => Boolean((await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } })).deletedAt), "expense removed");
    await owner.waitForSelector('button[aria-label="Remove expense"]', { hidden: true });
    pass("expense removal honours confirmation and updates the existing page");

    stage = "keyboard expense dialog";
    await owner.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await go(owner, baseUrl, `/dates/${completed.id}`);
    await clickText(owner, "Add expense", "#spending button");
    await owner.waitForSelector('[role="dialog"]', { visible: true });
    await owner.waitForFunction(() => document.activeElement?.id === "ef-amount", { timeout: 5000 });
    await owner.keyboard.down("Shift"); await owner.keyboard.press("Tab"); await owner.keyboard.up("Shift");
    assert.equal(await owner.evaluate(() => document.activeElement?.textContent.trim()), "Add expense", "Shift+Tab wraps to the dialog submit control");
    await owner.keyboard.press("Tab");
    assert.equal(await owner.evaluate(() => document.activeElement?.id), "ef-amount");
    await owner.keyboard.press("Escape");
    await owner.waitForSelector('[role="dialog"]', { hidden: true });
    assert(await owner.evaluate(() => document.activeElement?.textContent.includes("Add expense") && !document.activeElement.closest('[role="dialog"]')));
    assert.equal(new URL(owner.url()).pathname, `/dates/${completed.id}`);
    pass("expense dialog focuses its visible input, traps Tab and restores focus on Escape");

    stage = "responsive routes";
    await prisma.expense.create({ data: {
      coupleId: couple.id, dateId: completed.id, recordedById: users[0].id, category: "FOOD",
      paidBy: "SHARED", amountCents: 12550, currency: "INR", description: "Responsive dinner",
    } });
    await prisma.memory.create({ data: {
      coupleId: couple.id, dateId: completed.id, authorId: users[0].id,
      title: "Responsive memory", body: "A saved memory for the responsive page checks.",
    } });
    const sizes = [[320, 800], [414, 896], [768, 1024], [1024, 768], [1280, 900], [1536, 960], [844, 390]];
    const paths = [
      "/home", "/settings", "/dates", "/dates/history", "/dates/upcoming", "/memories",
      "/memories/photos", "/settings/notifications", "/couple", `/dates/${completed.id}`,
      `/dates/${completed.id}/review`, `/dates/${completed.id}/recap`,
      ...["basics", "budget", "activities", "review"].map((step) => `/plan/${layoutPlan.id}?step=${step}`),
    ];
    for (const [width, height] of sizes) {
      const mobile = width <= 414 || height === 390;
      await owner.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
      for (const path of paths) {
        await go(owner, baseUrl, path);
        const box = await owner.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert(box.scroll <= box.width + 1, `Horizontal overflow at ${width}×${height}: ${path}`);
      }
      if (width === 320 || height === 390) await owner.screenshot({ path: join(artifactDir, `workflows-layout-${width}x${height}.png`), fullPage: true });
    }
    assert.deepEqual(errors, [], "Workflow browser runtime errors");
    pass("core routes fit 320–1536px widths and phone landscape without horizontal overflow");
    return { checks };
  } catch (error) {
    await Promise.allSettled(pages.map(async (page, i) => page.screenshot({ path: join(artifactDir, `workflows-failure-${i}.png`), fullPage: true })));
    await writeFile(join(artifactDir, "workflows-failure.json"), JSON.stringify({ stage, message: error.message, stack: error.stack }, null, 2));
    throw new Error(`Workflows failed at ${stage}: ${error.message}`, { cause: error });
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
}
