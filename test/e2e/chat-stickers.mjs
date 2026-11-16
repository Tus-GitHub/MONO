import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import sharp from "sharp";

export async function runChatStickers({ browser, baseUrl, prisma, runId, artifactDir }) {
  let checks = 0;
  const contexts = [], errors = [];
  const pass = (label) => { checks++; console.log(`PASS chat-stickers: ${label}`); };
  const password = randomBytes(20).toString("hex"), passwordHash = await bcrypt.hash(password, 12);
  const users = await Promise.all(["owner", "partner"].map((role) => prisma.user.create({ data: { email: `e2e-${runId}-${role}@example.invalid`, name: `${role} ${runId}`, passwordHash, emailVerified: new Date(), profileCompletedAt: new Date() } })));
  const couple = await prisma.couple.create({ data: { name: "Sticker QA", createdById: users[0].id, inviteCode: randomBytes(15).toString("hex"), setupCompletedAt: new Date(), status: "ACTIVE", members: { create: users.map((user, index) => ({ userId: user.id, role: index ? "PARTNER" : "OWNER", status: "ACTIVE" })) } } });
  const click = async (page, label) => {
    const target = page.locator(`xpath=//button[normalize-space(.)=${JSON.stringify(label)}]`);
    await target.click();
  };
  const text = (page, value) => page.waitForFunction((value) => document.body.innerText.includes(value), {}, value);
  const fill = async (page, selector, value) => {
    await page.locator(selector).click(); await page.keyboard.down("Control"); await page.keyboard.press("KeyA"); await page.keyboard.up("Control"); await page.keyboard.press("Backspace"); await page.type(selector, value);
  };
  const pageFor = async (user) => {
    const context = await browser.createBrowserContext(); contexts.push(context); const page = await context.newPage();
    page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(180000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle2" });
    await fill(page, '[name="email"]', user.email); await fill(page, '[name="password"]', password); await click(page, "Sign in");
    await page.waitForFunction(() => location.pathname === "/home");
    await page.goto(`${baseUrl}/chat`, { waitUntil: "networkidle2" });
    await page.waitForFunction(() => !document.body.innerText.includes("Checking this device…"));
    return page;
  };
  const open = async (page) => { await page.bringToFront(); await page.locator('[aria-label="Open emoji and stickers"]').click(); await text(page, "Emoji & stickers"); };
  const noDialog = (page) => page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  const readyImage = (page, label) => page.waitForFunction((label) => [...document.images].some((image) => image.alt === label && image.complete && image.naturalWidth > 0), {}, label);
  try {
    const owner = await pageFor(users[0]); await click(owner, "Generate recovery code");
    const code = await owner.$eval("p.select-all", (el) => el.textContent);
    await owner.locator('input[type="checkbox"]').click(); await click(owner, "Enable encrypted chat"); await owner.waitForSelector('[aria-label="Message your partner"]');
    const partner = await pageFor(users[1]); await fill(partner, '[aria-label="Private recovery code"]', code); await click(partner, "Unlock on this device"); await partner.waitForSelector('[aria-label="Message your partner"]');
    pass("both partners unlock encrypted chat");

    await owner.bringToFront(); await owner.locator('[aria-label="Add attachment"]').click(); await text(owner, "Share something");
    assert.equal(await owner.$$eval('[role="dialog"] button', (buttons) => buttons.some((button) => button.textContent === "Emoji")), false);
    await owner.screenshot({ path: path.join(artifactDir, "chat-attachments-mobile.png") });
    assert.equal(await owner.evaluate(() => document.body.innerText.includes("25 MB used")), false);
    await click(owner, "Stickers & custom stickers"); await text(owner, "Our stickers");
    await click(owner, "Done"); await noDialog(owner);
    await owner.locator('[aria-label="Add attachment"]').click(); await text(owner, "Share something");
    const documentPath = path.join(artifactDir, "sticker-plan.txt"); await writeFile(documentPath, "Synthetic private attachment");
    const documentChooser = owner.waitForFileChooser(); await owner.locator('xpath=//button[.//span[normalize-space(.)="Document"]]').click(); await (await documentChooser).accept([documentPath]);
    await click(owner, "Send document"); await noDialog(owner); await text(partner, "sticker-plan.txt");
    pass("plus opens focused attachment choices and documents still send");

    const draft = '[aria-label="Message your partner"]'; await fill(owner, draft, "Hello you");
    await owner.$eval(draft, (el) => { el.setSelectionRange(5, 5); });
    await open(owner); await fill(owner, '[aria-label="Search emoji"]', "heart");
    const emoji = await owner.$eval('[role="tabpanel"] button', (el) => el.textContent);
    await owner.locator('[role="tabpanel"] button').click(); await owner.locator('[role="tabpanel"] button').click();
    await click(owner, "Done"); await noDialog(owner);
    assert.equal(await owner.$eval(draft, (el) => el.value), `Hello${emoji}${emoji} you`);
    pass("emoji search inserts repeatedly at the saved cursor without losing the draft");

    await open(owner); await owner.focus('[role="tab"][aria-selected="true"]'); await owner.keyboard.press("ArrowRight");
    await owner.waitForFunction(() => document.activeElement?.textContent === "Stickers"); await text(owner, "Our stickers");
    await owner.waitForFunction(() => !document.body.innerText.includes("Loading your stickers…"));
    await owner.screenshot({ path: path.join(artifactDir, "chat-stickers-empty-mobile.png") });
    for (const width of [320, 390, 1440]) {
      await owner.setViewport({ width, height: width === 1440 ? 900 : 844, isMobile: true, hasTouch: true });
      assert.equal(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await owner.waitForFunction(() => { const el = document.querySelector('[role="dialog"]'); if (!el) return false; const rect = el.getBoundingClientRect(); return rect.top >= -1 && rect.bottom <= innerHeight + 1; }, { timeout: 5000 });
    }
    await owner.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    pass("tabs support keyboard navigation and the picker fits 320px, mobile and desktop");

    const imagePath = path.join(artifactDir, "custom-sticker.png");
    await sharp(Buffer.from('<svg width="160" height="120"><circle cx="80" cy="60" r="45" fill="#a8573c"/><path d="M55 60 Q80 90 105 60" fill="none" stroke="white" stroke-width="7"/></svg>')).png().toFile(imagePath);
    const chooseImage = async () => { const chooser = owner.waitForFileChooser(); await click(owner, "Create"); await (await chooser).accept([imagePath]); await readyImage(owner, "Your custom sticker preview"); };
    await chooseImage(); await click(owner, "Back to stickers");
    assert.equal(await prisma.chatMessage.count({ where: { coupleId: couple.id, kind: "STICKER" } }), 0);
    await chooseImage();
    assert.equal(await owner.$eval('xpath=//button[normalize-space(.)="Send & save sticker"]', (el) => el.disabled), true);
    await fill(owner, 'input[placeholder="Our happy dance"]', "Our QA smile");
    await owner.screenshot({ path: path.join(artifactDir, "chat-sticker-create-mobile.png") });
    let failNext = true;
    await owner.setRequestInterception(true);
    owner.on("request", (request) => {
      if (failNext && request.method() === "POST" && new URL(request.url()).pathname === "/api/together/stickers") { failNext = false; void request.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Please try your sticker again." }) }); }
      else void request.continue();
    });
    await click(owner, "Send & save sticker"); await text(owner, "Please try your sticker again.");
    assert.equal(await owner.$eval('input[placeholder="Our happy dance"]', (el) => el.value), "Our QA smile");
    await click(owner, "Send & save sticker"); await text(owner, "Sticker sent and saved to Our stickers.");
    await owner.waitForSelector('[aria-label="Send Our QA smile custom sticker"]'); await click(owner, "Done"); await noDialog(owner);
    await readyImage(owner, "Our QA smile"); await readyImage(partner, "Our QA smile");
    const stored = await prisma.chatMessage.findFirstOrThrow({ where: { coupleId: couple.id, kind: "STICKER" }, include: { image: true } });
    assert.equal(stored.encrypted, true); assert.equal(stored.image.encrypted, true); assert.equal(stored.body.includes("Our QA smile"), false);
    assert.notDeepEqual(Buffer.from(stored.image.bytes).subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    pass("cancel creates nothing; a named custom sticker survives failed send, retries and renders for both partners with ciphertext-only storage");

    await partner.bringToFront(); await partner.reload({ waitUntil: "networkidle2" }); await readyImage(partner, "Our QA smile");
    await open(partner); await click(partner, "Stickers"); await partner.waitForSelector('[aria-label="Send Our QA smile custom sticker"]');
    await partner.locator('[aria-label="Send Our QA smile custom sticker"]').click(); await text(partner, "Sticker sent.");
    await partner.waitForFunction(() => document.querySelectorAll('[aria-label="Send Our QA smile custom sticker"]').length === 1);
    await partner.screenshot({ path: path.join(artifactDir, "chat-stickers-library-mobile.png") });
    await click(partner, "Done"); await noDialog(partner);
    await owner.waitForFunction(() => [...document.images].filter((image) => image.alt === "Our QA smile" && image.complete && image.naturalWidth > 0).length === 2);
    const rows = await prisma.chatMessage.findMany({ where: { coupleId: couple.id, kind: "STICKER" }, include: { image: true } });
    assert.equal(rows.length, 2); assert.notEqual(rows[0].clientNonce, rows[1].clientNonce); assert.notDeepEqual(rows[0].image.bytes, rows[1].image.bytes);
    pass("custom library survives reload and partner reuse re-encrypts without duplicate library tiles");
    await owner.bringToFront(); await owner.screenshot({ path: path.join(artifactDir, "chat-custom-stickers-mobile.png") });
    await owner.setViewport({ width: 1440, height: 900, isMobile: false, hasTouch: false });
    await owner.waitForSelector('[aria-label="Message your partner"]', { visible: true }); await open(owner); await click(owner, "Stickers");
    await owner.waitForSelector('[aria-label="Send Our QA smile custom sticker"]'); await readyImage(owner, "Our QA smile");
    await owner.waitForFunction(() => { const image = document.querySelector('[aria-label="Send Our QA smile custom sticker"] img'); return image?.complete && image.naturalWidth > 0; });
    await owner.screenshot({ path: path.join(artifactDir, "chat-stickers-desktop.png") });
    assert.deepEqual(errors, []); pass("no uncaught browser errors");
    return { checks };
  } catch (error) {
    for (const [index, context] of contexts.entries()) for (const page of await context.pages()) {
      await page.screenshot({ path: path.join(artifactDir, `chat-stickers-failure-${index}.png`) }).catch(() => {});
      console.log(`STICKER QA ${index}:`, (await page.evaluate(() => document.body.innerText).catch(() => "")).slice(-4000));
    }
    throw error;
  } finally { await Promise.all(contexts.map((context) => context.close())); }
}
