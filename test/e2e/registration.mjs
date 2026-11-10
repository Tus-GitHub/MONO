import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { go, fill, clickText, bodyContains, waitFor } from "./journey.mjs";

export async function runRegistration({ browser, baseUrl, prisma, runId, artifactDir }) {
  let checks = 0;
  const pass = (label) => { checks++; console.log(`PASS registration: ${label}`); };
  const contexts = [];
  const pages = [];
  const errors = [];
  const email = `e2e-${runId}-registration@example.invalid`;
  const password = `RegistrationA9-${randomBytes(8).toString("hex")}`;
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  async function page() {
    const context = await browser.createBrowserContext(); contexts.push(context);
    const item = await context.newPage(); pages.push(item);
    item.setDefaultTimeout(60_000); item.setDefaultNavigationTimeout(90_000);
    item.on("pageerror", (error) => errors.push(error.message));
    await item.setViewport({ width: 390, height: 844 });
    return item;
  }
  async function messages(address, subject) {
    const log = await readFile(path.join(artifactDir, "server.log"), "utf8");
    return log.split("──────────── email (console driver) ────────────").slice(1)
      .filter((block) => block.includes(`to:      ${address}\n`) && block.includes(`subject: ${subject}\n`));
  }
  async function verificationLinks(address) {
    return (await messages(address, "Verify your MONO email")).map((block) => {
      const raw = block.match(/\/verify-email#token=([A-Za-z0-9_-]{43})/);
      return raw?.[1];
    }).filter(Boolean);
  }
  async function resend(item, address) {
    await fill(item, 'input[name="email"]', address);
    await clickText(item, "Resend verification email");
    await bodyContains(item, "If that account needs confirmation");
    await item.waitForFunction(() => !document.querySelector('button[aria-busy="true"]'));
  }
  try {
    const signedIn = await page();
    await go(signedIn, baseUrl, "/register");
    await fill(signedIn, '[name="name"]', "Registration fixture");
    await fill(signedIn, '[name="email"]', email);
    await fill(signedIn, '[name="password"]', password);
    await fill(signedIn, '[name="confirmPassword"]', password);
    await clickText(signedIn, "Create account");
    await signedIn.waitForFunction(() => location.pathname === "/onboarding/profile");
    await bodyContains(signedIn, "Confirm your email");
    await waitFor(async () => (await messages(email, "Welcome to MONO")).length === 1 && (await verificationLinks(email)).length === 1, "registration emails after redirect");
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.equal(user.emailVerified, null);
    assert.equal(await prisma.authSession.count({ where: { userId: user.id, revokedAt: null } }), 1);
    const first = (await verificationLinks(email))[0];
    assert.equal((await prisma.emailVerificationToken.findFirstOrThrow({ where: { userId: user.id } })).tokenHash, digest(first));
    pass("real registration redirects to onboarding and dispatches both branded messages without blocking access");

    const visitor = await page();
    await go(visitor, baseUrl, `/verify-email#token=${first}`);
    await visitor.waitForSelector('input[name="token"]');
    assert.equal(new URL(visitor.url()).hash, "");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified, null);
    assert.equal((await prisma.emailVerificationToken.findFirstOrThrow({ where: { userId: user.id } })).usedAt, null);
    pass("opening the link strips the fragment and does not consume it or sign anyone in");

    for (const width of [320, 768, 1280]) {
      await visitor.setViewport({ width, height: 900 });
      assert.ok(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Verification overflows at ${width}`);
      await visitor.screenshot({ path: path.join(artifactDir, `registration-verification-${width}.png`), fullPage: true });
    }
    pass("verification and resend controls fit phone, tablet and desktop layouts");

    await resend(visitor, email);
    assert.equal(await prisma.emailVerificationToken.count({ where: { userId: user.id } }), 1);
    await resend(visitor, `e2e-${runId}-unknown@example.invalid`);
    assert.equal(await prisma.emailVerificationToken.count({ where: { userId: user.id } }), 1);
    await prisma.emailVerificationToken.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
    await resend(visitor, email);
    await waitFor(async () => (await verificationLinks(email)).length === 2, "resend after cooldown");
    const second = (await verificationLinks(email))[1];
    assert.equal((await messages(email, "Welcome to MONO")).length, 1);
    pass("resend uses generic responses, enforces cooldown and does not repeat the welcome email");

    await clickText(visitor, "Verify email address");
    await bodyContains(visitor, "Email confirmed");
    assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified);
    assert.equal(await visitor.evaluate(async () => (await fetch("/api/auth/session")).status), 401);
    assert.equal(await prisma.authSession.count({ where: { userId: user.id } }), 1);
    await go(signedIn, baseUrl, "/onboarding/profile");
    assert.equal(await signedIn.$('a[href="/verify-email"]'), null);
    pass("explicit confirmation accepts the older valid link, persists verification and removes the notice without creating a session");

    await go(visitor, baseUrl, `/verify-email?case=replay#token=${second}`);
    await visitor.waitForSelector('input[name="token"]');
    await clickText(visitor, "Verify email address");
    await bodyContains(visitor, "invalid, expired or already used");
    const expired = randomBytes(32).toString("base64url");
    await prisma.emailVerificationToken.create({ data: { userId: user.id, email, tokenHash: digest(expired), expiresAt: new Date(0) } });
    await go(visitor, baseUrl, `/verify-email?case=expired#token=${expired}`);
    await visitor.waitForSelector('input[name="token"]');
    await clickText(visitor, "Verify email address");
    await bodyContains(visitor, "invalid, expired or already used");
    pass("used and expired links return correctable feedback instead of confirming again");

    const legacyEmail = `e2e-${runId}-legacy-registration@example.invalid`;
    await prisma.user.create({ data: { name: "Existing account", email: legacyEmail, passwordHash: await bcrypt.hash(password, 12) } });
    const legacy = await page();
    await go(legacy, baseUrl, "/login");
    await fill(legacy, '[name="email"]', legacyEmail); await fill(legacy, '[name="password"]', password);
    await clickText(legacy, "Sign in");
    await legacy.waitForFunction(() => location.pathname === "/onboarding/profile");
    await go(legacy, baseUrl, "/verify-email");
    assert.equal(await legacy.$eval('[name="email"]', (input) => input.value), legacyEmail);
    await resend(legacy, legacyEmail);
    await waitFor(async () => (await verificationLinks(legacyEmail)).length === 1, "existing account verification");
    assert.equal((await messages(legacyEmail, "Welcome to MONO")).length, 0);
    pass("existing unverified accounts keep login/onboarding access and can request confirmation");
    assert.deepEqual(errors, []);
    return { checks };
  } catch (error) {
    for (let i = 0; i < pages.length; i++) if (!pages[i].isClosed()) await pages[i].screenshot({ path: path.join(artifactDir, `registration-failure-${i}.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally { for (const context of contexts) await context.close().catch(() => {}); }
}
