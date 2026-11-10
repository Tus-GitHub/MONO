import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import sharp from "sharp";

/** Real settings pages → protected APIs → PostgreSQL, with disposable users and local media. */
export async function runSettings({ browser, baseUrl, prisma, runId, artifactDir }) {
  let checks = 0;
  const pass = (name) => { checks++; console.log(`PASS settings: ${name}`); };
  const contexts = [];
  const pages = [];
  const errors = [];
  const password = `SettingsA9-${randomBytes(8).toString("hex")}`;
  const newPassword = `UpdatedB9-${randomBytes(8).toString("hex")}`;
  const hash = await bcrypt.hash(password, 12);
  const users = await Promise.all(["owner", "partner", "google", "google-partner"].map((name) => prisma.user.create({ data: {
    email: `e2e-${runId}-settings-${name}@example.invalid`, name: `Settings ${name}`,
    passwordHash: hash, profileCompletedAt: new Date(),
  } })));
  const createSpace = (members, name) => prisma.couple.create({ data: {
    name, createdById: members[0].id, inviteCode: randomBytes(12).toString("hex"),
    status: members.length === 2 ? "ACTIVE" : "PENDING", setupCompletedAt: new Date(), timezone: "Asia/Kolkata",
    members: { create: members.map((user, i) => ({ userId: user.id, role: i ? "PARTNER" : "OWNER", joinedAt: new Date() })) },
  } });
  const source = await createSpace(users.slice(0, 2), "Settings source history");
  await createSpace(users.slice(2), "Google-only settings space");
  const date = await prisma.date.create({ data: {
    coupleId: source.id, createdById: users[0].id, title: "Restored through Settings", status: "COMPLETED", completedAt: new Date(),
  } });
  await prisma.memory.create({ data: { coupleId: source.id, dateId: date.id, authorId: users[0].id, title: "Settings memory", body: "Our preserved history" } });
  await prisma.dateReview.create({ data: { dateId: date.id, authorId: users[1].id, lovedText: "PRIVATE SETTINGS PARTNER DRAFT" } });

  async function newPage() {
    const context = await browser.createBrowserContext(); contexts.push(context);
    const page = await context.newPage(); pages.push(page);
    page.setDefaultTimeout(60_000); page.setDefaultNavigationTimeout(90_000);
    await page.setViewport({ width: 1280, height: 900 });
    page.on("pageerror", (error) => errors.push(error.message));
    return page;
  }
  async function goto(page, pathname) {
    const response = await page.goto(`${baseUrl}${pathname}`, { waitUntil: "networkidle0" });
    assert.ok(response && response.status() < 400, `${pathname} returned ${response?.status()}`);
  }
  async function fill(page, selector, value) {
    await page.waitForSelector(selector, { visible: true });
    await page.click(selector, { clickCount: 3 }); await page.keyboard.press("Backspace");
    await page.type(selector, value);
  }
  async function click(page, label) {
    await page.waitForFunction((text) => [...(document.querySelector('[role="dialog"]') ?? document).querySelectorAll("button")].some((button) => button.textContent.trim() === text && !button.disabled), {}, label);
    const handle = await page.evaluateHandle((text) => [...(document.querySelector('[role="dialog"]') ?? document).querySelectorAll("button")].find((button) => button.textContent.trim() === text && !button.disabled), label);
    await handle.asElement().click(); await handle.dispose();
  }
  async function textIncludes(page, value) {
    await page.waitForFunction((text) => document.body.innerText.includes(text), {}, value);
  }
  async function login(page, user, credential = password) {
    await goto(page, "/login");
    await fill(page, 'input[name="email"]', user.email);
    await fill(page, 'input[name="password"]', credential);
    await click(page, "Sign in");
    await page.waitForFunction(() => location.pathname === "/home", { timeout: 90_000 });
  }
  async function sessions(page) {
    return page.evaluate(async () => {
      const response = await fetch("/api/account/sessions");
      return { status: response.status, ...(await response.json()) };
    });
  }
  async function uploadArchive(page, file) {
    const input = await page.waitForSelector("#archive-file");
    await input.uploadFile(file);
  }
  async function approve(page) {
    await page.waitForSelector('input[type="checkbox"]', { visible: true });
    await page.click('input[type="checkbox"]');
    await click(page, "Approve this archive");
    await page.waitForSelector("#archive-approval");
    return page.$eval("#archive-approval", (input) => input.value);
  }

  try {
    const owner = await newPage(), second = await newPage(), third = await newPage();
    const partner = await newPage(), google = await newPage(), anonymous = await newPage();
    for (const pathname of ["/settings/password", "/settings/sessions", "/settings/archive"]) {
      await goto(anonymous, pathname); assert.equal(new URL(anonymous.url()).pathname, "/login");
    }
    pass("all new settings pages require sign-in");
    await login(owner, users[0]); await login(second, users[0]); await login(partner, users[1]);
    await login(google, users[2]);
    await prisma.user.update({ where: { id: users[2].id }, data: { passwordHash: null } });
    await goto(google, "/settings/password");
    await textIncludes(google, "You sign in with Google");
    assert.equal(await google.$('input[name="currentPassword"]'), null);
    pass("Google-only accounts receive an appropriate password explanation");

    await goto(owner, "/settings");
    for (const pathname of ["password", "sessions", "archive"]) {
      assert.ok(await owner.$(`a[href="/settings/${pathname}"]`), `Missing ${pathname} settings link`);
    }
    await goto(owner, "/settings/sessions");
    assert.equal(await owner.$$eval("[data-session-id]", (rows) => rows.length), 2);
    await textIncludes(owner, "This device"); await textIncludes(owner, "Asia/Kolkata");
    const originalSessions = await sessions(owner);
    const other = originalSessions.sessions.find((session) => !session.current);
    await owner.click(`[data-session-id="${other.id}"] button`);
    await owner.waitForSelector('[role="dialog"]'); await click(owner, "Cancel");
    await owner.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    assert.equal((await sessions(second)).status, 200);
    await owner.click(`[data-session-id="${other.id}"] button`);
    await owner.waitForSelector('[role="dialog"]'); await click(owner, "Sign out");
    await textIncludes(owner, "The session has been signed out.");
    assert.equal((await sessions(second)).status, 401);
    assert.ok((await prisma.authSession.findUniqueOrThrow({ where: { id: other.id } })).revokedAt);
    pass("individual session revocation supports cancellation and ends the selected device in PostgreSQL");

    await login(second, users[0]); await login(third, users[0]);
    await click(owner, "Refresh list");
    await owner.waitForFunction(() => document.querySelectorAll("[data-session-id]").length === 3);
    await click(owner, "Sign out other devices"); await owner.waitForSelector('[role="dialog"]'); await click(owner, "Sign out");
    await textIncludes(owner, "Other devices have been signed out.");
    assert.equal((await sessions(second)).status, 401); assert.equal((await sessions(third)).status, 401);
    assert.equal((await sessions(owner)).status, 200); assert.equal((await sessions(partner)).status, 200);
    pass("sign out other devices preserves this session and the partner's sessions");

    await click(owner, "Sign out everywhere"); await owner.waitForSelector('[role="dialog"]'); await click(owner, "Sign out");
    await owner.waitForFunction(() => location.pathname === "/login" && location.search.includes("signedOut=1"));
    await textIncludes(owner, "You've been signed out.");
    assert.equal(await prisma.authSession.count({ where: { userId: users[0].id, revokedAt: null } }), 0);
    await login(owner, users[0]);
    await goto(owner, "/settings/sessions");
    await click(owner, "Sign out this device"); await owner.waitForSelector('[role="dialog"]'); await click(owner, "Sign out");
    await owner.waitForFunction(() => location.pathname === "/login");
    await login(owner, users[0]); await login(second, users[0]);
    pass("all-device and current-device sign-out return to login and clear active sessions");

    await goto(owner, "/settings/password");
    await click(owner, "Update password"); await textIncludes(owner, "Enter your current password.");
    await fill(owner, '[name="currentPassword"]', password);
    await fill(owner, '[name="password"]', newPassword);
    await fill(owner, '[name="confirmPassword"]', `${newPassword}wrong`);
    await click(owner, "Update password"); await textIncludes(owner, "Passwords do not match.");
    await fill(owner, '[name="currentPassword"]', "IncorrectCurrentA9");
    await fill(owner, '[name="confirmPassword"]', newPassword);
    await click(owner, "Update password"); await textIncludes(owner, "The current password is incorrect");
    assert.equal((await sessions(owner)).status, 200);
    await fill(owner, '[name="currentPassword"]', password);
    await click(owner, "Update password");
    await owner.waitForFunction(() => location.pathname === "/login" && location.search.includes("reset=1"));
    await textIncludes(owner, "Your password was updated.");
    assert.equal((await sessions(second)).status, 401);
    assert.equal(await prisma.authSession.count({ where: { userId: users[0].id, revokedAt: null } }), 0);
    assert.ok(await bcrypt.compare(newPassword, (await prisma.user.findUniqueOrThrow({ where: { id: users[0].id } })).passwordHash));
    await login(owner, users[0], newPassword);
    pass("password form validates, reports incorrect credentials, changes the hash and revokes every device");

    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 180, g: 100, b: 70 } } }).png().toBuffer();
    await owner.evaluate(async (dateId, encoded) => {
      const bytes = Uint8Array.from(atob(encoded), (value) => value.charCodeAt(0));
      const form = new FormData(); form.append("file", new File([bytes], "settings.png", { type: "image/png" }));
      const response = await fetch(`/api/uploads/date-photo?dateId=${dateId}`, { method: "POST", body: form });
      if (!response.ok) throw new Error("Fixture image upload failed");
    }, date.id, image.toString("base64"));
    await goto(owner, "/settings/archive");
    await textIncludes(owner, "This space isn't available for restore");
    assert.equal(await owner.$("#archive-file"), null);
    const downloadDir = path.join(artifactDir, "downloads");
    await mkdir(downloadDir, { recursive: true });
    const downloadSession = await owner.createCDPSession();
    await downloadSession.send("Browser.setDownloadBehavior", {
      behavior: "allow", downloadPath: downloadDir, browserContextId: owner.browserContext().id,
    });
    await click(owner, "Download archive");
    await textIncludes(owner, "Your archive is ready to save.");
    const downloadedPath = path.join(downloadDir, `mono-archive-${new Date().toISOString().slice(0, 10)}.json`);
    const deadline = Date.now() + 30_000;
    while (!existsSync(downloadedPath) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
    const archive = JSON.parse(await readFile(downloadedPath, "utf8"));
    await downloadSession.detach();
    assert.equal(archive.format, "mono.archive.v1"); assert.ok(archive.media.length > 0);
    assert.doesNotMatch(JSON.stringify(archive), /PRIVATE SETTINGS PARTNER DRAFT|passwordHash|tokenVersion/);
    pass("archive download works from a populated space, includes photos and preserves review privacy");

    // Provision an empty destination without deleting or modifying the source history.
    await prisma.$transaction([
      prisma.coupleMember.updateMany({ where: { coupleId: source.id }, data: { status: "LEFT" } }),
      prisma.couple.update({ where: { id: source.id }, data: { status: "ARCHIVED" } }),
    ]);
    const destination = await createSpace(users.slice(0, 2), "Settings restored space");
    const archiveFile = path.join(artifactDir, "settings-archive.json");
    const brokenFile = path.join(artifactDir, "settings-invalid.json");
    const tamperedFile = path.join(artifactDir, "settings-tampered.json");
    await writeFile(archiveFile, JSON.stringify(archive)); await writeFile(brokenFile, "not JSON");
    await writeFile(tamperedFile, JSON.stringify({ ...archive, couple: { ...archive.couple, name: "Tampered name" } }));
    await goto(owner, "/settings/archive"); await goto(partner, "/settings/archive");
    await uploadArchive(owner, brokenFile); await textIncludes(owner, "This file isn't readable JSON.");
    await uploadArchive(owner, tamperedFile);
    await owner.click('input[type="checkbox"]'); await click(owner, "Approve this archive");
    await textIncludes(owner, "Archive size or checksum is invalid.");
    assert.equal(await owner.$("#archive-approval"), null);
    assert.equal(await prisma.date.count({ where: { coupleId: destination.id } }), 0);
    pass("file validation and server integrity failures leave the destination untouched");

    await uploadArchive(owner, archiveFile); await uploadArchive(partner, archiveFile);
    await textIncludes(owner, "Dates: 1 · Photos: 1 · Memories: 1");
    const ownApproval = await approve(owner);
    assert.equal(await partner.$("#partner-approval"), null);
    const partnerApproval = await approve(partner);
    await owner.setViewport({ width: 320, height: 900 });
    await owner.screenshot({ path: path.join(artifactDir, "settings-archive-approval-320.png"), fullPage: true });
    assert.ok(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Archive approval overflows a phone");
    await owner.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    assert.ok(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Enlarged archive approval overflows a phone");
    await owner.screenshot({ path: path.join(artifactDir, "settings-archive-approval-large-text-320.png"), fullPage: true });
    await owner.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await owner.setViewport({ width: 1280, height: 900 });
    await fill(owner, "#partner-approval", ownApproval);
    await click(owner, "Restore archive"); await owner.waitForSelector('[role="dialog"]'); await click(owner, "Restore history");
    await textIncludes(owner, "Each member must approve this exact archive");
    assert.equal(await prisma.date.count({ where: { coupleId: destination.id } }), 0);
    pass("each partner approves independently; a repeated self-approval cannot replace partner consent");

    await fill(owner, "#partner-approval", partnerApproval);
    // Switching files must clear previous approvals and consent before another action.
    await uploadArchive(owner, brokenFile); await textIncludes(owner, "This file isn't readable JSON.");
    await uploadArchive(owner, archiveFile);
    assert.equal(await owner.$("#archive-approval"), null);
    assert.equal(await owner.$eval("#partner-approval", (input) => input.value), "");
    await approve(owner); await fill(owner, "#partner-approval", partnerApproval);
    await click(owner, "Restore archive"); await owner.waitForSelector('[role="dialog"]'); await click(owner, "Cancel");
    await owner.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    assert.equal(await prisma.date.count({ where: { coupleId: destination.id } }), 0);
    pass("changing archive clears stale approvals and final confirmation can be cancelled");

    await click(owner, "Restore archive"); await owner.waitForSelector('[role="dialog"]'); await click(owner, "Restore history");
    await textIncludes(owner, "Your history is restored");
    const restored = await prisma.date.findFirstOrThrow({ where: { coupleId: destination.id }, include: { photos: true, memory: true } });
    assert.notEqual(restored.id, date.id); assert.equal(restored.memory.body, "Our preserved history");
    assert.equal(restored.photos.length, 1);
    assert.ok(await prisma.archiveRestore.findUnique({ where: { coupleId: destination.id } }));
    await goto(owner, `/dates/${restored.id}`); await textIncludes(owner, "Restored through Settings");
    assert.equal(await owner.evaluate(async (url) => (await fetch(url)).status, `/media/${restored.photos[0].storageKey}`), 200);
    await goto(owner, "/settings/archive"); await textIncludes(owner, "already received an archive");
    assert.equal(await owner.$("#archive-file"), null);
    pass("dual-approved restore persists history and media, renders in the app and prevents repeated restore");

    await goto(owner, "/settings/sessions");
    await owner.setOfflineMode(true);
    try { await click(owner, "Refresh list"); await textIncludes(owner, "Couldn't connect."); }
    finally { await owner.setOfflineMode(false); }
    await click(owner, "Refresh list"); await textIncludes(owner, "Your device list is up to date.");
    pass("offline session requests show recoverable feedback and retry successfully");

    for (const pathname of ["/settings/password", "/settings/sessions", "/settings/archive"]) {
      for (const width of [320, 768, 1280]) {
        await owner.setViewport({ width, height: 900 }); await goto(owner, pathname);
        assert.ok(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${pathname} overflows at ${width}px`);
        await owner.screenshot({ path: path.join(artifactDir, `settings-${pathname.split("/").at(-1)}-${width}.png`), fullPage: true });
      }
    }
    assert.deepEqual(errors, []);
    pass("new screens fit phone, tablet and desktop sizes without browser errors");
    return { checks };
  } catch (error) {
    await mkdir(artifactDir, { recursive: true });
    for (let i = 0; i < pages.length; i++) {
      if (!pages[i].isClosed()) await pages[i].screenshot({ path: path.join(artifactDir, `settings-failure-${i}.png`), fullPage: true }).catch(() => {});
    }
    throw error;
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
  }
}
