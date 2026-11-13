import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { bodyContains, clickText, fill, go, waitFor } from "./journey.mjs";

/** Exercise transitions through the real UI, HTTP handlers, storage and PostgreSQL. */
export async function runStateMachines({ browser, baseUrl, prisma, runId, artifactDir }) {
  const password = "StateRegression92!";
  const user = await prisma.user.create({ data: {
    email: `e2e-${runId}-states@example.invalid`, name: `State browser ${runId}`,
    passwordHash: await bcrypt.hash(password, 12), profileCompletedAt: new Date(),
  } });
  const partner = await prisma.user.create({ data: { email: `e2e-${runId}-states-partner@example.invalid`, name: `State partner ${runId}`, profileCompletedAt: new Date() } });
  const couple = await prisma.couple.create({ data: {
    createdById: user.id, inviteCode: `states-${runId}`, status: "ACTIVE", setupCompletedAt: new Date(),
    members: { create: [{ userId: user.id, role: "OWNER" }, { userId: partner.id, role: "PARTNER" }] },
  } });
  const date = await prisma.date.create({ data: { coupleId: couple.id, createdById: user.id, title: "Browser state transitions", status: "COMPLETED", completedAt: new Date() } });
  await prisma.reviewCategory.create({ data: { coupleId: couple.id, key: "fun", label: "Fun" } });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => void dialog.accept());
  let checks = 0;
  const pass = (label) => { checks++; console.log(`PASS states: ${label}`); };
  let heldAction = null, holdAction = false, heldUpload = null, uploadMode = "normal";
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (holdAction && request.method() === "POST" && request.headers()["next-action"]) {
      holdAction = false; heldAction = request; return;
    }
    if (request.method() === "POST" && request.url().includes("/api/uploads/date-photo")) {
      if (uploadMode === "hold") { heldUpload = request; return; }
      if (uploadMode === "fail") { void request.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Fixture upload interruption" }) }); return; }
    }
    void request.continue();
  });
  try {
    await go(page, baseUrl, "/login");
    await fill(page, '[name="email"]', user.email); await fill(page, '[name="password"]', password);
    await clickText(page, "Sign in"); await page.waitForFunction(() => location.pathname === "/home");
    await go(page, baseUrl, `/dates/${date.id}/review`);
    const gap = await page.$eval('form > fieldset > div', (element) => parseFloat(getComputedStyle(element).marginBottom));
    assert(gap > 0, "Pending-field protection preserves the form's vertical spacing");
    await page.screenshot({ path: join(artifactDir, "state-review-phone.png"), fullPage: true });
    await fill(page, 'textarea[name="lovedText"]', "The submitted snapshot");
    holdAction = true;
    await clickText(page, "Save draft");
    await waitFor(() => heldAction !== null, "intercepted draft save");
    await page.waitForFunction(() => document.querySelector('textarea[name="lovedText"]')?.matches(":disabled"));
    assert.equal(await page.$eval('textarea[name="lovedText"]', (input) => input.value), "The submitted snapshot");
    await heldAction.continue(); heldAction = null;
    await bodyContains(page, "Draft saved. It stays private.");
    assert.equal((await prisma.dateReview.findUniqueOrThrow({ where: { dateId_authorId: { dateId: date.id, authorId: user.id } } })).lovedText, "The submitted snapshot");
    pass("pending form protects its exact snapshot until the server commits");

    await fill(page, 'textarea[name="lovedText"]', "New work after saving");
    await page.waitForFunction(() => Object.keys(localStorage).some((key) => key.endsWith(":texts") && localStorage.getItem(key)?.includes("New work after saving")));
    await page.reload({ waitUntil: "networkidle2" });
    await page.waitForFunction(() => document.querySelector('textarea[name="lovedText"]')?.value === "New work after saving");
    pass("edits after a completed save survive reload as a device draft");

    await go(page, baseUrl, `/dates/${date.id}`);
    const image = join(artifactDir, "state-upload.png");
    await writeFile(image, await sharp({ create: { width: 80, height: 80, channels: 3, background: "#92715e" } }).png().toBuffer());
    const pick = async () => { const input = await page.$('#photos input[type="file"]'); assert(input); await input.uploadFile(image); };
    uploadMode = "hold";
    await pick(); await waitFor(() => heldUpload !== null, "in-flight upload");
    await clickText(page, "Cancel", "#photos li button");
    await bodyContains(page, "Canceled");
    await heldUpload.abort().catch(() => {}); heldUpload = null;
    assert.equal(await prisma.datePhoto.count({ where: { dateId: date.id, deletedAt: null } }), 0);
    uploadMode = "normal";
    await clickText(page, "Retry", "#photos li button");
    await waitFor(async () => await prisma.datePhoto.count({ where: { dateId: date.id, deletedAt: null } }) === 1, "retried upload commit");
    await bodyContains(page, "Added");
    pass("cancelled upload cannot commit and its retry creates exactly one photo");

    uploadMode = "fail";
    await pick(); await bodyContains(page, "Fixture upload interruption");
    uploadMode = "normal";
    await clickText(page, "Retry", "#photos li button");
    await waitFor(async () => await prisma.datePhoto.count({ where: { dateId: date.id, deletedAt: null } }) === 2, "failed upload retry commit");
    pass("failed upload releases its slot and can be retried without choosing the file again");

    const plan = await prisma.date.create({ data: { coupleId: couple.id, createdById: user.id, title: "Activity retry", status: "DRAFT" } });
    await go(page, baseUrl, `/plan/${plan.id}?step=activities`);
    const invalid = "x".repeat(161);
    await fill(page, 'input[aria-label="Custom activity"]', invalid);
    await clickText(page, "Add");
    await bodyContains(page, "Add a name for the activity.");
    assert.equal(await page.$eval('input[aria-label="Custom activity"]', (input) => input.value), invalid);
    await fill(page, 'input[aria-label="Custom activity"]', "Retryable custom activity");
    await clickText(page, "Add");
    await waitFor(async () => await prisma.dateActivity.count({ where: { dateId: plan.id } }) === 1, "activity retry");
    await page.waitForFunction(() => document.querySelector('input[aria-label="Custom activity"]')?.value === "");
    await clickText(page, "Continue", "a");
    await bodyContains(page, "Ready?");
    pass("rejected activity preserves its text and clears only after a successful retry");

    await go(page, baseUrl, "/settings");
    await page.screenshot({ path: join(artifactDir, "state-settings-phone.png"), fullPage: true });
    assert.deepEqual(errors, [], "No browser runtime errors during transitions");
    return { checks };
  } catch (error) {
    await page.screenshot({ path: join(artifactDir, "state-failure.png"), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await heldAction?.abort().catch(() => {}); await heldUpload?.abort().catch(() => {});
    await context.close();
  }
}
