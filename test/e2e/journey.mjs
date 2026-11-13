import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const TIMEOUT = 60_000;
const password = "BrowserJourney92!";
let clickTargetId = 0;

export async function waitFor(work, label) {
  const until = Date.now() + TIMEOUT;
  while (Date.now() < until) {
    if (await work()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${label}`);
}

export async function fill(page, selector, value) {
  // Sheets are visible before their entrance transition has finished. Locators
  // wait for a stable bounding box before interacting with the real input.
  await page.locator(selector).fill(value);
}

export async function clickText(page, text, selector = "button", prefix = false) {
  const predicate = (text, selector, prefix) => [...document.querySelectorAll(selector)].find((el) => {
    const label = el.textContent.trim().replace(/\s+/g, " ");
    return (prefix ? label.startsWith(text) : label === text) && !el.disabled && el.getClientRects().length;
  });
  await page.waitForFunction(predicate, { timeout: TIMEOUT }, text, selector, prefix);
  const handle = await page.evaluateHandle(predicate, text, selector, prefix);
  const marker = `journey-${++clickTargetId}`;
  await handle.evaluate((element, marker) => element.setAttribute("data-e2e-click-target", marker), marker);
  try {
    await page.locator(`[data-e2e-click-target="${marker}"]`).click();
  } finally {
    await handle.evaluate((element) => element.removeAttribute("data-e2e-click-target")).catch(() => {});
    await handle.dispose();
  }
}

export async function bodyContains(page, text) {
  await page.waitForFunction((text) => document.body?.innerText.includes(text) ?? false, { timeout: TIMEOUT }, text);
}

export async function go(page, baseUrl, path) {
  await page.bringToFront();
  const response = await page.goto(new URL(path, baseUrl).href, { waitUntil: "networkidle2", timeout: TIMEOUT });
  // Current Firefox BiDi can finish a navigation without returning its response.
  // Recheck the same GET through that browser's session rather than treating a
  // rendered page as failed or silently accepting an unobserved HTTP status.
  let status = response?.status();
  if (status === undefined && (await page.browser().version()).startsWith("firefox/")) {
    status = await page.evaluate(async () => (await fetch(location.href, { cache: "no-store" })).status);
  }
  assert(status && status < 400, `Route failed: ${path} (HTTP ${status ?? "unknown"})`);
  await page.waitForFunction(() => document.readyState === "complete" && Boolean(document.body));
}

async function api(page, path) {
  return page.evaluate(async (path) => {
    const response = await fetch(path);
    return { status: response.status, text: await response.text() };
  }, path);
}

export async function runJourney({ browser, baseUrl, prisma, runId, artifactDir }) {
  const contexts = [];
  const pages = [];
  const errors = [];
  let checks = 0;
  const pass = (label) => { checks++; console.log(`PASS journey: ${label}`); };
  const email = (person) => `e2e-${runId}-journey-${person}@example.invalid`;
  let stage = "registration";
  const freshPage = async (phone = false) => {
    const context = await browser.createBrowserContext(); contexts.push(context);
    const page = await context.newPage(); pages.push(page);
    page.setDefaultTimeout(TIMEOUT);
    await page.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1365, height: 1000 });
    await page.emulateTimezone("Asia/Kolkata");
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => void dialog.accept());
    return page;
  };
  const register = async (page, person) => {
    await go(page, baseUrl, "/register");
    await fill(page, 'input[name="name"]', `E2E ${person}`);
    await fill(page, 'input[name="email"]', email(person));
    await fill(page, 'input[name="password"]', password);
    await fill(page, 'input[name="confirmPassword"]', password);
    await clickText(page, "Create account");
    await bodyContains(page, "Set up your profile");
    await fill(page, 'input[name="nickname"]', person);
    await clickText(page, "Continue");
    await bodyContains(page, "Connect with your partner");
    let verificationToken;
    await waitFor(async () => {
      const log = await readFile(join(artifactDir, "server.log"), "utf8");
      const block = log.split("──────────── email (console driver) ────────────")
        .find((message) => message.includes(`to:      ${email(person)}\n`) && message.includes("subject: Verify your MONO email\n"));
      verificationToken = block?.match(/\/verify-email#token=([A-Za-z0-9_-]{43})/)?.[1];
      return Boolean(verificationToken);
    }, "registration verification email");
    await go(page, baseUrl, `/verify-email#token=${verificationToken}`);
    await clickText(page, "Verify email address");
    await bodyContains(page, "Email confirmed");
    await go(page, baseUrl, "/onboarding/connect");
    return prisma.user.findUniqueOrThrow({ where: { email: email(person) } });
  };
  try {
    const owner = await freshPage();
    const partner = await freshPage(true);
    const outsider = await freshPage();
    const ownerUser = await register(owner, "owner");
    const partnerUser = await register(partner, "partner");
    await register(outsider, "outsider");
    pass("three isolated browsers register and complete their profiles");

    stage = "couple onboarding";
    await clickText(owner, "Create our space");
    await bodyContains(owner, "Invite your partner");
    await clickText(owner, "Prefer a short code?", "summary");
    const code = await owner.$eval("details .font-mono", (element) => element.textContent.trim());
    await fill(partner, 'input[name="inviteCode"]', code);
    await clickText(partner, "Join with code");
    await bodyContains(partner, "Set up your space");
    await fill(partner, 'input[name="name"]', `Browser couple ${runId}`);
    await fill(partner, 'textarea[name="description"]', "Created by the browser journey");
    await clickText(partner, "Finish setup");
    await clickText(partner, "Enter MONO", "a");
    await go(owner, baseUrl, "/home");
    const couple = await prisma.couple.findFirstOrThrow({ where: { createdById: ownerUser.id } });
    assert.equal(await prisma.coupleMember.count({ where: { coupleId: couple.id, status: "ACTIVE" } }), 2);
    assert.equal(couple.timezone, await owner.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone));
    await fill(outsider, 'input[name="inviteCode"]', code);
    await clickText(outsider, "Join with code");
    await bodyContains(outsider, "already full");
    assert.equal(await prisma.coupleMember.count({ where: { coupleId: couple.id, status: "ACTIVE" } }), 2);
    pass("two-person onboarding succeeds; a third person cannot join");

    stage = "plan basics and date picker";
    await go(owner, baseUrl, "/plan");
    await clickText(owner, "Start a new plan");
    await bodyContains(owner, "The basics");
    const dateId = await owner.$eval('input[name="dateId"]', (input) => input.value);
    const currentMonth = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date());
    await bodyContains(owner, currentMonth);
    await fill(owner, 'input[name="title"]', `Browser date ${runId}`);
    await fill(owner, 'textarea[name="notes"]', "A real browser plan");
    await clickText(owner, "Today");
    await clickText(owner, "Add a place");
    await clickText(owner, "Custom place");
    await fill(owner, "#cp-name", "Browser Cafe");
    await fill(owner, "#cp-city", "Pune");
    await owner.select("#cp-category", "CAFE");
    await clickText(owner, "Use this place");
    await waitFor(async () => Boolean((await prisma.date.findUnique({ where: { id: dateId } }))?.plannedPlaceId), "custom place persisted");
    await owner.waitForSelector('[role="dialog"]', { hidden: true });
    await clickText(owner, "Save & continue");
    await bodyContains(owner, "How much are we planning to spend?");
    await fill(owner, "#expectedTotal", "1200");
    await owner.select("#currency", "INR");
    await clickText(owner, "Continue");
    await owner.waitForSelector('input[aria-label="Custom activity"]');
    await fill(owner, 'input[aria-label="Custom activity"]', "Coffee and conversation");
    await clickText(owner, "Add");
    await waitFor(async () => (await prisma.dateActivity.count({ where: { dateId } })) === 1, "activity persisted");
    await clickText(owner, "Continue", "a");
    await clickText(owner, "Save the plan");
    await bodyContains(owner, "It's a plan.");
    const planned = await prisma.date.findUniqueOrThrow({ where: { id: dateId } });
    assert.equal(planned.currency, "INR");
    assert.equal(planned.expectedBudgetCents, 120000);
    assert(["PLANNED", "TODAY"].includes(planned.status));
    pass("new calendar opens on current month; custom place, budget and activity save through plan steps");

    stage = "shared plan and isolation";
    await go(partner, baseUrl, `/dates/${dateId}`);
    await bodyContains(partner, `Browser date ${runId}`);
    const outsideExport = await api(outsider, "/api/export");
    assert(outsideExport.status >= 400);
    assert(!outsideExport.text.includes(`Browser date ${runId}`));
    pass("partner sees the plan and an outsider cannot export it");

    stage = "date lifecycle and recap";
    await clickText(owner, "Start the date");
    await waitFor(async () => (await prisma.date.findUnique({ where: { id: dateId } }))?.status === "IN_PROGRESS", "date started");
    await go(owner, baseUrl, `/dates/${dateId}/recap`);
    await fill(owner, 'input[aria-label="Actual place"]', "Browser Cafe patio");
    await fill(owner, 'textarea[name="actualNotes"]', "The weather was lovely.");
    await fill(owner, 'input[name="actualSpend"]', "650");
    await clickText(owner, "Save what happened");
    await waitFor(async () => (await prisma.date.findUnique({ where: { id: dateId } }))?.actualSpendCents === 65000, "actuals saved");
    await go(owner, baseUrl, `/dates/${dateId}`);
    await clickText(owner, "Mark completed");
    await waitFor(async () => (await prisma.date.findUnique({ where: { id: dateId } }))?.status === "COMPLETED", "date completed");
    pass("start, recap and complete persist through browser controls");

    stage = "photo upload and reconnect";
    await go(owner, baseUrl, `/dates/${dateId}`);
    const photoFile = join(artifactDir, "journey-fixture.png");
    await sharp({ create: { width: 40, height: 40, channels: 3, background: "#526f73" } }).png().toFile(photoFile);
    await (await owner.waitForSelector('input[type="file"][multiple]')).uploadFile(photoFile);
    await waitFor(async () => (await prisma.datePhoto.count({ where: { dateId, deletedAt: null } })) === 1, "first photo uploaded");
    await owner.waitForSelector("#photos figure");
    await owner.setOfflineMode(true);
    await (await owner.$('input[type="file"][multiple]')).uploadFile(photoFile);
    await bodyContains(owner, "You're offline.");
    await owner.setOfflineMode(false);
    await waitFor(async () => (await prisma.datePhoto.count({ where: { dateId, deletedAt: null } })) === 2, "offline photo retried after reconnect");
    const photo = await prisma.datePhoto.findFirstOrThrow({ where: { dateId, deletedAt: null } });
    assert.equal((await api(partner, photo.url)).status, 200);
    assert((await api(outsider, photo.url)).status >= 400);
    pass("photo upload works, reconnect retries once, and media remains member-only");

    stage = "photo controls and caption validation";
    await go(owner, baseUrl, `/dates/${dateId}`);
    const originalOverflow = await owner.evaluate(() => document.body.style.overflow);
    await owner.locator('button[aria-label="Open photo 1"]').click();
    await owner.waitForSelector('[role="dialog"][aria-label="Photo 1 of 2"]');
    await owner.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Make this the best photo");
    await owner.keyboard.down("Shift"); await owner.keyboard.press("Tab"); await owner.keyboard.up("Shift");
    assert.equal(await owner.evaluate(() => document.activeElement?.textContent.trim()), "Add a caption");
    await owner.keyboard.press("Tab");
    assert.equal(await owner.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Make this the best photo");
    await owner.goBack();
    await owner.waitForSelector('[role="dialog"][aria-label="Photo 1 of 2"]', { hidden: true });
    assert.equal(new URL(owner.url()).pathname, `/dates/${dateId}`, "Back closes the photo without leaving its date");
    await owner.locator('button[aria-label="Open photo 1"]').click();
    await owner.locator('button[aria-label="Delete photo"]').click();
    await bodyContains(owner, "Delete this photo?");
    await owner.goBack();
    // Confirmation text clears immediately, but its backdrop stays until the
    // exit transition finishes. Wait for it to unmount before clicking beneath it.
    await owner.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 1);
    await owner.waitForSelector('[role="dialog"][aria-label="Photo 1 of 2"]');
    assert.equal(await prisma.datePhoto.count({ where: { dateId, deletedAt: null } }), 2, "Back cancels deletion without closing the underlying photo");
    await owner.locator('button[aria-label="Delete photo"]').click();
    await bodyContains(owner, "Delete this photo?");
    await owner.keyboard.press("Escape");
    await owner.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 0 && !history.state?.monoOverlay?.length);
    await owner.waitForFunction((value) => document.body.style.overflow === value, { timeout: 5000 }, originalOverflow);
    assert.equal(new URL(owner.url()).pathname, `/dates/${dateId}`, "Escape removes both overlays without leaving the date");
    await owner.locator('button[aria-label="Open photo 1"]').click();
    stage = "photo caption editing";
    await owner.locator('button[aria-label="Edit caption"]').click();
    await owner.waitForSelector('input[name="caption"]');
    const selectedPhotoId = await owner.$eval('input[name="photoId"]', (input) => input.value);
    await fill(owner, 'input[name="caption"]', "Our browser-tested photo");
    await clickText(owner, "Save", '[role="dialog"] button');
    await waitFor(async () => (await prisma.datePhoto.findUnique({ where: { id: selectedPhotoId } }))?.caption === "Our browser-tested photo", "photo caption saved");
    await owner.waitForSelector('input[name="caption"]', { hidden: true });
    stage = "best photo selection";
    await owner.locator('button[aria-label="Make this the best photo"]').click();
    await waitFor(async () => (await prisma.date.findUnique({ where: { id: dateId } }))?.bestPhotoId === selectedPhotoId, "best photo selected");
    stage = "invalid caption correction";
    await owner.locator('button[aria-label="Edit caption"]').click();
    await fill(owner, 'input[name="caption"]', "x".repeat(301));
    await clickText(owner, "Save", '[role="dialog"] button');
    await bodyContains(owner, "That caption is too long.");
    assert.equal(await owner.$eval('input[name="caption"]', (input) => input.value), "x".repeat(301));
    assert.equal((await prisma.datePhoto.findUniqueOrThrow({ where: { id: selectedPhotoId } })).caption, "Our browser-tested photo");
    await fill(owner, 'input[name="caption"]', "Our corrected photo caption");
    await clickText(owner, "Save", '[role="dialog"] button');
    await waitFor(async () => (await prisma.datePhoto.findUnique({ where: { id: selectedPhotoId } }))?.caption === "Our corrected photo caption", "invalid caption corrected");
    await owner.locator('[role="dialog"] button[aria-label="Close"]').click();
    pass("photo captions and best-photo controls persist, and rejected edits remain correctable");

    stage = "expense and memory";
    await go(owner, baseUrl, `/dates/${dateId}`);
    await clickText(owner, "Add expense", "#spending button");
    await fill(owner, "#ef-amount", "650");
    await fill(owner, "#ef-desc", "Cafe lunch");
    await clickText(owner, "Add expense", '[role="dialog"] button');
    await waitFor(async () => (await prisma.expense.count({ where: { dateId, deletedAt: null } })) === 1, "expense saved");
    await go(owner, baseUrl, `/dates/${dateId}/memory`);
    await fill(owner, "#memory-title", "A browser-tested memory");
    await fill(owner, "#memory-body", "Coffee, sunshine and a good conversation.");
    await clickText(owner, "Keep this memory");
    await waitFor(async () => Boolean(await prisma.memory.findFirst({ where: { dateId, deletedAt: null } })), "memory saved");
    pass("expense and memory forms save real shared records");

    stage = "blind reviews";
    const privateText = `Private owner reflection ${runId}`;
    const writeReview = async (page, text, score) => {
      await go(page, baseUrl, `/dates/${dateId}/review`);
      await fill(page, 'textarea[name="lovedText"]', text);
      const overall = await page.evaluateHandle(() => document.querySelector('input[name="overallRating"]').parentElement.querySelector('[role="slider"]'));
      const button = await overall.asElement().$(`button[aria-label^="${score} —"]`);
      await button.click();
      await clickText(page, "Definitely", "button", true);
    };
    await writeReview(owner, privateText, 9);
    await clickText(owner, "Save draft");
    await bodyContains(owner, "Draft saved. It stays private.");
    assert(!(await api(partner, "/api/export")).text.includes(privateText));
    await clickText(owner, "Submit my side");
    await waitFor(async () => Boolean((await prisma.dateReview.findUnique({ where: { dateId_authorId: { dateId, authorId: ownerUser.id } } }))?.submittedAt), "owner review submitted");
    assert(!(await api(partner, "/api/export")).text.includes(privateText));
    await writeReview(partner, `Partner reflection ${runId}`, 8);
    await clickText(partner, "Submit my side");
    await waitFor(async () => Boolean((await prisma.dateReview.findUnique({ where: { dateId_authorId: { dateId, authorId: partnerUser.id } } }))?.submittedAt), "partner review submitted");
    await go(partner, baseUrl, `/dates/${dateId}`);
    await clickText(partner, "Reveal the comparison");
    await bodyContains(partner, privateText);
    assert((await api(partner, "/api/export")).text.includes(privateText));
    pass("drafts and one-sided submissions stay private, then reveal after both submit");

    stage = "mobile and final views";
    for (const path of ["/home", "/dates/history", "/memories", "/memories/photos", `/dates/${dateId}#spending`, "/couple", "/settings"]) {
      await go(partner, baseUrl, path);
      const dimensions = await partner.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert(dimensions.scroll <= dimensions.width + 1, `Mobile overflow: ${path}`);
    }
    await partner.screenshot({ path: join(artifactDir, "journey-phone-settings.png"), fullPage: true });
    await go(owner, baseUrl, `/dates/${dateId}`);
    await owner.screenshot({ path: join(artifactDir, "journey-desktop-completed.png"), fullPage: true });
    assert.deepEqual(errors, [], "Browser runtime errors");
    pass("key desktop/phone pages render without runtime errors or horizontal overflow");
    return { checks };
  } catch (error) {
    await writeFile(join(artifactDir, "journey-failure.json"), JSON.stringify({ stage, message: error.message, stack: error.stack }, null, 2)).catch(() => {});
    for (let index = 0; index < pages.length; index++) {
      await pages[index].screenshot({ path: join(artifactDir, `journey-failure-${index}.png`), fullPage: true }).catch(() => {});
      await writeFile(join(artifactDir, `journey-failure-${index}.txt`), await pages[index].evaluate(() => document.body.innerText).catch(() => "Page unavailable")).catch(() => {});
    }
    throw new Error(`Journey failed at ${stage}: ${error.message}`, { cause: error });
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
}
