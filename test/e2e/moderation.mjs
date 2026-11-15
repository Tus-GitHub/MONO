import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

export async function runModeration({ browser, baseUrl, prisma, runId, artifactDir }) {
  let checks = 0;
  const contexts = [];
  const jsErrors = [];
  const pass = (name) => { checks++; console.log(`PASS moderation: ${name}`); };
  const password = `Fixture-${randomBytes(14).toString("hex")}`;
  const alias = `e2e-${runId}-admin-alias@example.invalid`;
  const email = `e2e-${runId}-admin@example.invalid`;
  // Exercise the real operator-only provisioning path with ephemeral stdin, never argv.
  const child = spawn(process.execPath, ["--import", "tsx", "scripts/provision-admin.ts"], {
    env: process.env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.resume();
  child.stdin.end(JSON.stringify({ email, alias, name: `Admin fixture ${runId}`, password }));
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  assert.equal(code, 0, "Local admin provisioning failed");
  const admin = JSON.parse(output.trim());
  assert.equal(admin.created, true);
  assert.equal(admin.adminReady, false);
  const hash = await bcrypt.hash(password, 12);
  const users = [];
  for (const label of ["reported", "reporter"]) users.push(await prisma.user.create({ data: {
    email: `e2e-${runId}-${label}@example.invalid`, name: `${label} fixture ${runId}`, passwordHash: hash,
    emailVerified: new Date(), profileCompletedAt: new Date(),
  } }));
  const space = await prisma.couple.create({ data: {
    name: "Moderation QA", createdById: users[0].id, inviteCode: randomBytes(16).toString("hex"),
    status: "ACTIVE", setupCompletedAt: new Date(), members: { create: users.map((user, index) => ({ userId: user.id, role: index ? "PARTNER" : "OWNER" })) },
  } });

  const newPage = async () => {
    const context = await browser.createBrowserContext(); contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(180000);
    page.on("pageerror", (error) => { jsErrors.push(error.message); });
    await page.setViewport({ width: 1280, height: 900 });
    return page;
  };
  const goto = async (page, route) => {
    await page.bringToFront();
    return page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle2" });
  };
  const click = async (page, label) => {
    await page.waitForFunction((text) => [...document.querySelectorAll("button")].some((node) => node.textContent.trim() === text && !node.disabled), {}, label);
    const handle = await page.evaluateHandle((text) => [...document.querySelectorAll("button")].find((node) => node.textContent.trim() === text && !node.disabled), label);
    await handle.asElement().click(); await handle.dispose();
  };
  const fill = async (page, selector, text) => {
    // Locator.fill assigns email-input values directly in this Puppeteer version;
    // React's controlled email field needs real input events to retain the text.
    await page.locator(selector).click();
    await page.keyboard.down("Control"); await page.keyboard.press("KeyA"); await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.type(selector, text, { delay: 3 });
    assert.equal(await page.$eval(selector, (node) => node.value), text, "Fixture field did not retain its input");
  };
  const login = async (page, address, destination) => {
    await goto(page, "/login");
    await fill(page, '[name="email"]', address);
    await fill(page, '[name="password"]', password);
    await click(page, "Sign in");
    await page.waitForFunction((expected) => location.pathname === expected, {}, destination);
  };
  const waitText = (page, text) => page.waitForFunction((needle) => document.body.innerText.includes(needle), {}, text);

  try {
    const adminPage = await newPage();
    await goto(adminPage, "/admin");
    await adminPage.waitForFunction(() => location.pathname === "/admin/login");
    await fill(adminPage, '[name="email"]', alias);
    await fill(adminPage, '[name="password"]', password);
    await click(adminPage, "Sign in to admin");
    await waitText(adminPage, "Verify your receiving email address");
    pass("unverified admin alias cannot enter the panel");
    // Local fixture verification only; production never receives this shortcut.
    await prisma.user.update({ where: { id: admin.accountId }, data: { emailVerified: new Date() } });
    // React resets uncontrolled form inputs after the completed server action.
    await fill(adminPage, '[name="email"]', alias);
    await fill(adminPage, '[name="password"]', password);
    await click(adminPage, "Sign in to admin");
    await adminPage.waitForFunction(() => location.pathname === "/admin");
    await waitText(adminPage, "MONO admin");
    await adminPage.screenshot({ path: path.join(artifactDir, "admin-desktop.png"), fullPage: true });
    let body = await adminPage.evaluate(() => document.body.innerText);
    assert(!body.includes(email) && !body.includes(users[0].email) && !body.includes(users[0].name));
    assert(!body.includes("Open MONO") && !body.includes("Connect your partner"));
    pass("verified admin enters directly without profile or partner setup; only account IDs and counts are exposed");

    const reporter = await newPage();
    await login(reporter, users[1].email, "/home");
    const forbidden = await goto(reporter, "/admin"); assert.equal(forbidden.status(), 404);
    await goto(reporter, "/report-account");
    await reporter.select('[name="targetId"]', users[0].id);
    await reporter.select('[name="category"]', "Harassment");
    await fill(reporter, '[name="details"]', "Synthetic QA report <script>window.qaInjected=true</script>");
    await click(reporter, "Send report for review"); await waitText(reporter, "sent for manual review");
    pass("ordinary user is denied admin access and can submit a partner report");

    await goto(adminPage, `/admin?query=${users[0].id}`); await waitText(adminPage, "Synthetic QA report");
    assert.equal(await adminPage.evaluate(() => !!window.qaInjected), false);
    await adminPage.setViewport({ width: 375, height: 812 });
    assert(await adminPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await adminPage.screenshot({ path: path.join(artifactDir, "admin-mobile.png"), fullPage: true });
    pass("report text is escaped and admin layout fits a mobile viewport");

    await adminPage.click("summary");
    await adminPage.select('[name="action"]', "BLOCK_EMAIL");
    await fill(adminPage, '[name="reason"]', "Reviewed this disposable QA report before blocking.");
    await fill(adminPage, '[name="confirmation"]', "incorrect-id");
    await click(adminPage, "Confirm account action"); await waitText(adminPage, "Enter the exact account ID");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users[0].id } })).blockedAt, null);
    await adminPage.select('[name="action"]', "BLOCK_EMAIL");
    await fill(adminPage, '[name="reason"]', "Reviewed this disposable QA report before blocking.");
    await fill(adminPage, '[name="confirmation"]', users[0].id);
    await click(adminPage, "Confirm account action"); await waitText(adminPage, "Account action recorded");
    assert((await prisma.user.findUniqueOrThrow({ where: { id: users[0].id } })).blockedAt);
    pass("typed confirmation protects the real server action before email blocking");

    await adminPage.select('form:has(input[name="reportId"]) select[name="status"]', "ACTIONED");
    await fill(adminPage, 'form:has(input[name="reportId"]) [name="reason"]', "Reviewed the report and blocked the linked email.");
    await click(adminPage, "Save review");
    await adminPage.waitForFunction(() => !document.body.innerText.includes("Synthetic QA report"));
    assert.equal((await prisma.accountReport.findFirstOrThrow({ where: { targetId: users[0].id } })).status, "ACTIONED");
    pass("manual report outcome persists after an account action");

    await goto(adminPage, `/admin?query=${users[0].id}`); await waitText(adminPage, "Review account action");
    await adminPage.click("summary");
    await adminPage.select('[name="action"]', "DELETE");
    await fill(adminPage, '[name="reason"]', "Delete only this disposable QA account after review.");
    await fill(adminPage, '[name="confirmation"]', users[0].id);
    await click(adminPage, "Confirm account action"); await waitText(adminPage, "Account action recorded");
    assert((await prisma.user.findUniqueOrThrow({ where: { id: users[0].id } })).deletedAt);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users[1].id } })).deletedAt, null);
    assert.equal((await prisma.couple.findUniqueOrThrow({ where: { id: space.id } })).status, "ARCHIVED");
    assert.equal(jsErrors.length, 0, jsErrors.join("\n"));
    pass("confirmed deletion archives the shared space and keeps the partner account; no browser JS errors");
    return { checks };
  } catch (error) {
    for (const [index, context] of contexts.entries()) for (const page of await context.pages()) {
      await page.screenshot({ path: path.join(artifactDir, `failure-${index}.png`), fullPage: true }).catch(() => {});
      await writeFile(path.join(artifactDir, `failure-${index}.txt`), await page.evaluate(() => `${location.pathname}\n${document.body.innerText}`).catch(() => "Page unavailable"));
    }
    throw error;
  } finally {
    for (const context of contexts) await context.close();
    // Admin deletion anonymizes the mailbox, so restore only the fixture marker for runner cleanup.
    await prisma.user.updateMany({ where: { id: users[0].id }, data: { email: users[0].email } });
    await prisma.user.updateMany({ where: { id: admin.accountId }, data: { email } });
  }
}
