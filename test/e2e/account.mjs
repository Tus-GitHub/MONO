import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import sharp from "sharp";

// Fixtures set up histories; every authentication and control operation crosses real HTTP.
export async function runAccountControls({ browser, baseUrl, prisma, runId, artifactDir }) {
  let checks = 0;
  const pass = (name) => { checks++; console.log(`PASS account: ${name}`); };
  const contexts = [];
  const pages = [];
  const password = `FixtureA9-${randomBytes(8).toString("hex")}`;
  const changedPassword = `ChangedA9-${randomBytes(8).toString("hex")}`;
  const resetPassword = `ResetA9-${randomBytes(8).toString("hex")}`;
  const hash = await bcrypt.hash(password, 12);
  const users = await Promise.all(["owner", "partner", "outsider", "outsider-partner"].map((label) => prisma.user.create({
    data: { email: `e2e-${runId}-account-${label}@example.invalid`, name: `E2E ${label}`, passwordHash: hash, profileCompletedAt: new Date() },
  })));
  const createSpace = (members, name, client = prisma) => client.couple.create({ data: {
    name, createdById: members[0].id, inviteCode: randomBytes(12).toString("hex"),
    status: members.length === 2 ? "ACTIVE" : "PENDING", setupCompletedAt: new Date(),
    members: { create: members.map((user, i) => ({ userId: user.id, role: i ? "PARTNER" : "OWNER", joinedAt: new Date() })) },
  } });
  const source = await createSpace(users.slice(0, 2), "Account archive source");
  await createSpace(users.slice(2), "Isolated outsider space");
  const date = await prisma.date.create({ data: {
    coupleId: source.id, createdById: users[0].id, title: "Browser archive history", status: "COMPLETED", completedAt: new Date(),
  } });
  await prisma.dateReview.createMany({ data: [
    { dateId: date.id, authorId: users[0].id, overallRating: 8, submittedAt: new Date(), lovedText: "Visible own review" },
    { dateId: date.id, authorId: users[1].id, overallRating: 9, lovedText: "PRIVATE PARTNER DRAFT E2E" },
  ] });
  await prisma.memory.create({ data: { coupleId: source.id, dateId: date.id, authorId: users[1].id, title: "Browser saved memory", body: "Preserved memory body" } });

  async function newPage() {
    const context = await browser.createBrowserContext(); contexts.push(context);
    const page = await context.newPage(); pages.push(page);
    page.setDefaultTimeout(60_000); page.setDefaultNavigationTimeout(90_000);
    await page.setViewport({ width: 1280, height: 900 });
    return page;
  }
  async function goto(page, pathname) {
    // Private pages poll partner updates; an idle network is not a page-ready signal.
    const response = await page.goto(`${baseUrl}${pathname}`, { waitUntil: "networkidle2" });
    assert(response && response.status() < 400, `Route failed: ${pathname}`);
    await page.waitForFunction(() => document.readyState === "complete" && Boolean(document.body));
  }
  async function fill(page, selector, value) {
    await page.waitForSelector(selector, { visible: true });
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.type(selector, value);
  }
  async function clickText(page, text) {
    await page.waitForFunction((label) => [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === label && !button.disabled), {}, text);
    const button = await page.evaluateHandle((label) => [...document.querySelectorAll("button")].find((candidate) => candidate.textContent.trim() === label && !candidate.disabled), text);
    await button.asElement().click(); await button.dispose();
  }
  async function login(page, user, credential = password) {
    await goto(page, "/login");
    await fill(page, 'input[name="email"]', user.email);
    await fill(page, 'input[name="password"]', credential);
    await clickText(page, "Sign in");
    await page.waitForFunction(() => location.pathname === "/home", { timeout: 90_000 });
  }
  async function api(page, route, body) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await page.evaluate(async (url, payload) => {
          const response = await fetch(url, payload === null ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          const text = await response.text();
          let data; try { data = JSON.parse(text); } catch { data = null; }
          return { status: response.status, body: data, cache: response.headers.get("cache-control"), text };
        }, route, body ?? null);
      } catch (error) {
        // On-demand development compilation can reload another page. Retry only
        // reads; never repeat a mutation whose commit result is uncertain.
        if (body != null || attempt >= 2 || !String(error).includes("Execution context was destroyed")) throw error;
        await page.waitForFunction(() => document.readyState === "complete" && Boolean(document.body));
      }
    }
  }
  try {
    const owner = await newPage(), second = await newPage(), partner = await newPage(), outsider = await newPage();
    await login(owner, users[0]); await login(second, users[0]);
    await login(partner, users[1]); await login(outsider, users[2]);
    const ownerSessions = await api(owner, "/api/account/sessions");
    assert.equal(ownerSessions.status, 200); assert.equal(ownerSessions.cache, "no-store");
    assert.equal(ownerSessions.body.sessions.length, 2);
    assert.equal(ownerSessions.body.sessions.filter((item) => item.current).length, 1);
    assert.doesNotMatch(ownerSessions.text, /tokenVersion|passwordHash/);
    pass("real UI login creates distinct device sessions");

    const partnerSessions = await api(partner, "/api/account/sessions");
    assert.equal((await api(owner, "/api/account/sessions", { action: "revoke", sessionId: partnerSessions.body.sessions[0].id })).status, 404);
    const fixtureCookies = await owner.cookies(baseUrl);
    const sessionCookie = fixtureCookies.find((cookie) => cookie.name === process.env.SESSION_COOKIE_NAME);
    assert.ok(sessionCookie?.httpOnly); assert.equal(sessionCookie.sameSite, "Lax");
    const csrf = await fetch(`${baseUrl}/api/account/sessions`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "https://foreign.example.invalid", Cookie: fixtureCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ") },
      body: JSON.stringify({ action: "revoke-all" }),
    });
    assert.equal(csrf.status, 403);
    assert.equal((await api(owner, "/api/account/sessions")).status, 200);
    pass("cross-user revocation and cross-origin authenticated mutations are refused");

    assert.equal((await api(owner, "/api/account/sessions", { action: "revoke-others" })).status, 200);
    assert.equal((await api(second, "/api/account/sessions")).status, 401);
    await goto(second, "/home");
    assert.equal(new URL(second.url()).pathname, "/login", "A revoked cookie must redirect a protected page to login");
    await second.waitForSelector('input[name="email"]', { visible: true });
    await goto(second, "/settings");
    assert.equal(new URL(second.url()).pathname, "/login", "Settings must also redirect a revoked browser to login");
    pass("revoked browser cannot fetch private data and reaches login without a redirect loop");

    // A real multipart browser upload makes archive media coverage independent of storage fixtures.
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 180, g: 100, b: 70 } } }).png().toBuffer();
    const uploaded = await owner.evaluate(async (dateId, encoded) => {
      const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      const form = new FormData(); form.append("file", new File([bytes], "e2e-archive.png", { type: "image/png" }));
      const response = await fetch(`/api/uploads/date-photo?dateId=${dateId}`, { method: "POST", body: form });
      return { status: response.status, body: await response.json() };
    }, date.id, image.toString("base64"));
    assert.equal(uploaded.status, 200, `Fixture upload failed: ${uploaded.body.error ?? "unknown"}`);
    const media = await owner.evaluate(async (url) => { const response = await fetch(url); return { status: response.status, bytes: (await response.arrayBuffer()).byteLength }; }, uploaded.body.fullUrl);
    assert.equal(media.status, 200); assert.ok(media.bytes > 0);
    assert.equal(await outsider.evaluate(async (url) => (await fetch(url)).status, uploaded.body.fullUrl), 404);
    const foreignDate = await outsider.goto(`${baseUrl}/dates/${date.id}`, { waitUntil: "networkidle0" });
    // Next's streamed not-found response can have committed HTTP 200 before authorization finishes.
    assert.ok([200, 404].includes(foreignDate.status()));
    assert.match(await outsider.$eval("h1", (heading) => heading.innerText), /This page doesn't exist/);
    assert.doesNotMatch(await foreignDate.text(), /Browser archive history|PRIVATE PARTNER DRAFT E2E/);
    assert.doesNotMatch(await outsider.$eval("body", (body) => body.innerText), /Browser archive history|PRIVATE PARTNER DRAFT E2E/);
    pass("multipart upload works and foreign date/media access is denied");

    const downloaded = await api(owner, "/api/archive");
    assert.equal(downloaded.status, 200); assert.equal(downloaded.body.format, "mono.archive.v1");
    assert.ok(downloaded.body.media.length >= 1);
    assert.doesNotMatch(downloaded.text, /PRIVATE PARTNER DRAFT E2E|passwordHash|tokenVersion|pushSubscription/);
    const legacy = await api(owner, "/api/export");
    assert.equal(legacy.status, 200); assert.doesNotMatch(legacy.text, /PRIVATE PARTNER DRAFT E2E/);
    pass("both export formats preserve blind-review privacy; portable export includes media");

    // The source history stays archived. A distinct empty target is explicitly provisioned.
    const target = await prisma.$transaction(async (tx) => {
      await tx.coupleMember.updateMany({ where: { coupleId: source.id }, data: { status: "LEFT" } });
      await tx.couple.update({ where: { id: source.id }, data: { status: "ARCHIVED" } });
      return createSpace(users.slice(0, 2), "Restored account space", tx);
    });
    await goto(owner, "/home"); await goto(partner, "/home"); await goto(outsider, "/home");
    assert.equal((await api(outsider, "/api/archive", { action: "approve", archive: downloaded.body })).status, 403);
    const ownConsent = await api(owner, "/api/archive", { action: "approve", archive: downloaded.body });
    const partnerConsent = await api(partner, "/api/archive", { action: "approve", archive: downloaded.body });
    assert.equal(ownConsent.status, 200); assert.equal(partnerConsent.status, 200);
    assert.equal((await api(owner, "/api/archive", { action: "restore", archive: downloaded.body, approvals: [ownConsent.body.approval] })).status, 403);
    const approvals = [ownConsent.body.approval, partnerConsent.body.approval];
    const restored = await api(owner, "/api/archive", { action: "restore", archive: downloaded.body, approvals });
    assert.equal(restored.status, 200, `Restore failed: ${restored.body?.error}`);
    const restoredDate = await prisma.date.findFirstOrThrow({ where: { coupleId: target.id }, include: { photos: true, memory: true } });
    assert.notEqual(restoredDate.id, date.id); assert.equal(restoredDate.memory?.body, "Preserved memory body");
    await goto(owner, `/dates/${restoredDate.id}`);
    assert.match(await owner.$eval("body", (body) => body.innerText), /Browser archive history/);
    const restoredMedia = `/media/${restoredDate.photos[0].storageKey}`;
    assert.equal(await owner.evaluate(async (url) => (await fetch(url)).status, restoredMedia), 200);
    assert.equal(await outsider.evaluate(async (url) => (await fetch(url)).status, restoredMedia), 404);
    assert.equal((await api(owner, "/api/archive", { action: "restore", archive: downloaded.body, approvals })).status, 409);
    pass("dual-approved archive restores through HTTP, renders in existing UI, and rejects replay");

    // Dev intentionally does not auto-register workers. Exercise the shipped worker explicitly
    // in a separate temporary profile so it cannot affect subsequent authentication checks.
    const offline = await newPage();
    await offline.setCookie(...await partner.cookies(baseUrl));
    await goto(offline, "/home");
    await offline.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
    });
    await offline.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await goto(offline, `/dates/${restoredDate.id}`);
    assert.equal((await api(offline, "/api/account/sessions")).status, 200);
    assert.equal(await offline.evaluate(async (url) => (await fetch(url)).status, restoredMedia), 200);
    const cachedPaths = await offline.evaluate(async () => {
      const paths = [];
      for (const key of await caches.keys()) {
        for (const request of await (await caches.open(key)).keys()) paths.push(new URL(request.url).pathname);
      }
      return paths;
    });
    assert.ok(cachedPaths.includes("/offline"), "Worker must precache the offline fallback");
    assert.ok(cachedPaths.every((pathname) => !/^\/(?:api|media|dates|home)(?:\/|$)/.test(pathname)), "Private responses must never enter CacheStorage");
    // Chromium's page-only offline emulation does not disable the service
    // worker's own fetch target. Exercise a real worker network failure too.
    const workerTarget = await browser.waitForTarget((target) => target.type() === "service_worker"
      && target.browserContext() === offline.browserContext() && target.url().startsWith(`${baseUrl}/`));
    const workerSession = await workerTarget.createCDPSession();
    await workerSession.send("Network.enable");
    await workerSession.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await offline.setOfflineMode(true);
    try {
      await offline.goto(`${baseUrl}/dates/${restoredDate.id}?offline=e2e`, { waitUntil: "domcontentloaded" });
      await offline.waitForFunction(() => /You[’']re offline/.test(document.body.innerText));
      assert.doesNotMatch(await offline.$eval("body", (body) => body.innerText), /Browser archive history|Preserved memory body/);
    } finally {
      await offline.setOfflineMode(false);
      await workerSession.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await workerSession.detach();
    }
    await offline.browserContext().close();
    contexts.splice(contexts.indexOf(offline.browserContext()), 1);
    pages.splice(pages.indexOf(offline), 1);
    pass("shipped service worker serves offline fallback without caching private HTML, API data or media");

    const passwordChange = await api(owner, "/api/account/password", { currentPassword: password, password: changedPassword, confirmPassword: changedPassword });
    assert.equal(passwordChange.status, 200); assert.equal(passwordChange.body.signedOut, true);
    assert.equal((await api(owner, "/api/account/sessions")).status, 401);
    await login(owner, users[0], changedPassword);
    pass("password change revokes cookies and the new password signs in through UI");

    await goto(owner, "/forgot-password");
    assert.equal(new URL(owner.url()).pathname, "/forgot-password", "Signed-in users must be able to request mailbox recovery");
    // Seed only the emailed capability; submit it while signed in on a second device.
    await login(second, users[0], changedPassword);
    const resetToken = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({ data: { userId: users[0].id, tokenHash: createHash("sha256").update(resetToken).digest("hex"), expiresAt: new Date(Date.now() + 60_000) } });
    await goto(second, `/reset-password?token=${resetToken}`);
    await fill(second, 'input[name="password"]', resetPassword);
    await fill(second, 'input[name="confirmPassword"]', resetPassword);
    await clickText(second, "Update password");
    await second.waitForFunction(() => location.pathname === "/login" && new URLSearchParams(location.search).get("reset") === "1", { timeout: 90_000 });
    assert.equal((await api(owner, "/api/account/sessions")).status, 401);
    assert.equal((await second.browserContext().cookies()).some((cookie) => cookie.name === "mono_e2e_session"), false);
    await login(owner, users[0], resetPassword);
    pass("signed-in recovery consumes the token, clears its cookie, revokes other sessions and permits fresh login");

    await goto(owner, "/settings");
    await clickText(owner, "Delete account…");
    await fill(owner, 'input[name="confirm"]', "DELETE");
    await clickText(owner, "Delete my account");
    await owner.waitForFunction(() => location.pathname === "/login", { timeout: 90_000 });
    const deleted = await prisma.user.findUniqueOrThrow({ where: { id: users[0].id } });
    assert.ok(deleted.deletedAt); assert.equal(deleted.passwordHash, null);
    assert.equal(await prisma.authSession.count({ where: { userId: users[0].id, revokedAt: null } }), 0);
    assert.equal((await prisma.couple.findUniqueOrThrow({ where: { id: target.id } })).status, "ARCHIVED");
    assert.equal(await prisma.date.count({ where: { id: restoredDate.id } }), 1);
    assert.equal((await api(partner, "/api/account/sessions")).status, 200);
    assert.equal(await partner.evaluate(async (url) => (await fetch(url)).status, restoredMedia), 404);
    pass("existing DELETE form closes account atomically, preserves history and releases partner");

    const signedOutAll = await api(partner, "/api/account/sessions", { action: "revoke-all" });
    assert.equal(signedOutAll.status, 200); assert.equal(signedOutAll.body.signedOut, true);
    assert.equal((await api(partner, "/api/account/sessions")).status, 401);
    pass("all-device revocation clears the active cookie even after leaving a space");

    await goto(outsider, "/settings");
    await clickText(outsider, "Sign out");
    await outsider.waitForFunction(() => location.pathname === "/login", { timeout: 90_000 });
    assert.equal((await api(outsider, "/api/account/sessions")).status, 401);
    pass("existing sign-out form revokes its real browser session");
    return { checks };
  } catch (error) {
    if (artifactDir) {
      await mkdir(artifactDir, { recursive: true });
      await Promise.all(pages.map((page, index) => page.screenshot({ path: path.join(artifactDir, `account-failure-${index}.png`), fullPage: true }).catch(() => {})));
    }
    throw error;
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
}
