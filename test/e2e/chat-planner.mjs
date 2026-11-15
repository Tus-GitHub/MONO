import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import sharp from "sharp";

export async function runChatPlanner({ browser, baseUrl, prisma, runId, artifactDir, allowGlobalAudio = true, responsiveSmoke = false }) {
  let checks = 0; const contexts = [], errors = [];
  const pass = (label) => { checks++; console.log(`PASS chat-planner: ${label}`); };
  const password = randomBytes(20).toString("hex"), passwordHash = await bcrypt.hash(password, 12);
  const users = await Promise.all(["owner", "partner"].map((role) => prisma.user.create({ data: { email: `e2e-${runId}-${role}@example.invalid`, name: `${role} ${runId}`, passwordHash, emailVerified: new Date(), profileCompletedAt: new Date() } })));
  const couple = await prisma.couple.create({ data: { name: "Our QA route", createdById: users[0].id, inviteCode: randomBytes(15).toString("hex"), setupCompletedAt: new Date(), status: "ACTIVE", timezone: "Asia/Kolkata", members: { create: users.map((u, i) => ({ userId: u.id, role: i ? "PARTNER" : "OWNER", status: "ACTIVE" })) } } });
  const click = async (page, label) => {
    await page.locator(`xpath=//button[normalize-space(.)=${JSON.stringify(label)}]`).click();
  };
  const fill = async (page, selector, value) => { await page.locator(selector).click(); await page.keyboard.down("Control"); await page.keyboard.press("KeyA"); await page.keyboard.up("Control"); await page.keyboard.press("Backspace"); await page.type(selector, value, { delay: 3 }); assert.equal(await page.$eval(selector, (el) => el.value), value, "Typed field value was not retained"); };
  const text = (page, value) => page.waitForFunction((value) => document.body.innerText.includes(value), {}, value);
  const goto = async (page, route) => {
    await page.bringToFront();
    try { await page.goto(baseUrl + route, { waitUntil: "networkidle2", timeout: 180000 }); }
    catch (error) {
      // A just-completed server action can finish its redirect after pathname changes.
      if (!String(error).includes("net::ERR_ABORTED")) throw error;
      await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 });
      await page.goto(baseUrl + route, { waitUntil: "networkidle2", timeout: 180000 });
    }
  };
  const pageFor = async (user) => {
    const context = await browser.createBrowserContext(); contexts.push(context); const page = await context.newPage();
    page.setDefaultTimeout(120000); page.setDefaultNavigationTimeout(180000); page.on("pageerror", (e) => { errors.push(e.message); console.error("Browser error:", e.message); });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await goto(page, "/login"); await fill(page, '[name="email"]', user.email); await fill(page, '[name="password"]', password); assert.equal(await page.$eval('[name="email"]', (el) => el.value), user.email); await click(page, "Sign in");
    await page.waitForFunction(() => location.pathname === "/home"); await page.waitForNetworkIdle({ idleTime: 1000, timeout: 60000 }); await goto(page, "/chat");
    await page.waitForFunction(() => !document.body.innerText.includes("Checking this device…")); console.log("CHECKPOINT device ready:", contexts.length); return page;
  };
  const api = (page, body) => page.evaluate(async (body) => { const r = await fetch("/api/audio", { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, value: await r.json() }; }, body);
  try {
    const owner = await pageFor(users[0]);
    await click(owner, "Generate recovery code");
    await owner.waitForSelector("p.select-all");
    const code = await owner.$eval("p.select-all", (el) => el.textContent);
    await owner.locator('input[type="checkbox"]').click(); await click(owner, "Enable encrypted chat");
    await owner.waitForSelector('[aria-label="Message your partner"]');
    await fill(owner, '[aria-label="Message your partner"]', "A little adventure for us"); await owner.locator('[aria-label="Send message"]').click(); await text(owner, "A little adventure for us");
    const partner = await pageFor(users[1]); await fill(partner, '[aria-label="Private recovery code"]', code); await click(partner, "Unlock on this device"); await text(partner, "A little adventure for us");
    pass("both devices unlock and decrypt the real sent message");
    await owner.bringToFront();
    const message = await owner.$('.mono-message > p'); const box = await message.boundingBox();
    await owner.touchscreen.touchStart(box.x + 12, box.y + 8); await new Promise((r) => setTimeout(r, 650)); await owner.touchscreen.touchEnd();
    await text(owner, "Delete for everyone"); await click(owner, "Edit message"); await fill(owner, '[aria-label="Edit your message"]', "Coffee then arcade"); await click(owner, "Save edit"); await text(owner, "Coffee then arcade");
    pass("touch hold opens icon actions and encrypted editing works");
    await partner.bringToFront(); await text(partner, "Coffee then arcade");
    await partner.locator('[aria-label="Message options"]').click(); await click(partner, "Delete for me");
    await partner.waitForFunction(() => !document.body.innerText.includes("Coffee then arcade"));
    await owner.bringToFront(); await text(owner, "Coffee then arcade");
    await owner.locator('[aria-label="Message options"]').click(); await click(owner, "Delete for everyone");
    await text(owner, "Message deleted");
    pass("delete for me hides only the recipient copy; author can still delete for everyone");
    await owner.locator('[aria-label="Emoji, stickers, photos and documents"]').click();
    const documentPath = path.join(artifactDir, "itinerary.txt"); await writeFile(documentPath, "Café -> Arcade -> Movie\nPrivate attachment fixture");
    await (await owner.waitForSelector('[aria-label="Choose a chat document"]')).uploadFile(documentPath); await click(owner, "Send document"); await text(owner, "itinerary.txt");
    await partner.bringToFront(); await text(partner, "itinerary.txt");
    const download = partner.waitForResponse((r) => r.url().includes("/api/together/images/") && r.status() === 200);
    await click(partner, "Save document"); await download;
    pass("document upload encrypts, reaches partner, decrypts filename and downloads");
    assert.equal(await partner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await partner.screenshot({ path: path.join(artifactDir, "chat-mobile.png") });
    await partner.setViewport({ width: 1440, height: 900 }); await partner.screenshot({ path: path.join(artifactDir, "chat-desktop.png") });
    pass("chat fits mobile and desktop without horizontal overflow");
    await partner.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const photoPath = path.join(artifactDir, "private-photo.png");
    await sharp({ create: { width: 320, height: 240, channels: 3, background: "#a8573c" } }).png().toFile(photoPath);
    for (const limit of [0, 1, 2]) {
      await owner.bringToFront();
      await (await owner.waitForSelector('[aria-label="Choose a chat image"]')).uploadFile(photoPath);
      await click(owner, "Use photo"); await owner.waitForSelector('[aria-label="Photo access"]', {visible:true}); await owner.select('[aria-label="Photo access"]', String(limit)); await click(owner, "Send image");
      await owner.waitForFunction(() => !document.querySelector('[aria-label="Photo access"]'));
      await partner.bringToFront();
      const openLabel = limit ? `Open photo · ${limit} ${limit === 1 ? "view" : "views"} left` : "Open photo";
      await text(partner, openLabel);
      const openPhoto = async (label) => {
        await partner.locator(`xpath=//button[.//span[text()=${JSON.stringify(label)}]]`).click(); await text(partner, "Close photo");
      };
      await openPhoto(openLabel);
      assert.equal(await partner.evaluate(() => [...document.querySelectorAll('button')].some((el) => el.textContent.includes("Save / share photo"))), limit === 0);
      await partner.waitForSelector('img[alt="Shared private chat photo"]');
      await partner.waitForFunction(() => { const photo = document.querySelector('img[alt="Shared private chat photo"]'); return photo.complete && photo.naturalWidth > 0; });
      await click(partner, "Close photo");
      if (limit === 2) { await openPhoto("Open photo · 1 view left"); await click(partner, "Close photo"); }
      if (limit) await partner.waitForFunction((limit) => [...document.querySelectorAll('button')].some((el) => el.disabled && el.textContent.includes("Photo opened") && el.querySelector("span.font-display")?.textContent === String(limit)), {}, limit);
    }
    pass("normal photos decode with a save action; once/twice photos have no save action and exhaust exactly their view limit");
    await owner.bringToFront(); await goto(owner, "/settings/profile");
    const wav = Buffer.alloc(44 + 1600); wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(1600, 40);
    const audioPath = path.join(artifactDir, "fixture-tone.wav"); await writeFile(audioPath, wav);
    await (await owner.waitForSelector('[aria-label="Choose ringtone"]')).uploadFile(audioPath); await click(owner, "Save ringtone"); await text(owner, "Your ringtone is saved.");
    const range = await owner.evaluate(async () => { const r = await fetch("/api/audio?kind=ringtone", { headers: { Range: "bytes=0-1" } }); return { status: r.status, length: (await r.arrayBuffer()).byteLength }; });
    assert.deepEqual(range, { status: 206, length: 2 });
    assert.equal((await api(partner)).value.ringtoneName, null);
    pass("personal ringtone uploads and streams byte ranges without leaking to partner");
    if (allowGlobalAudio) {
    await prisma.adminAccess.create({ data: { userId: users[0].id } });
    await goto(owner, "/admin"); await (await owner.waitForSelector('[aria-label="Choose background song"]')).uploadFile(audioPath); await click(owner, "Publish song to MONO"); await text(owner, "Background song updated for MONO users.");
    await goto(partner, "/settings/profile"); await text(partner, "fixture-tone.wav"); assert.equal((await api(partner)).value.musicVolume, 0.2);
    await click(partner, "Play music"); await partner.waitForFunction(() => !document.querySelector('audio[aria-label="Background music"]').paused);
    await click(partner, "Mute music"); await partner.waitForFunction(() => document.querySelector('audio[aria-label="Background music"]').muted);
    await new Promise((r) => setTimeout(r, 800)); assert.equal((await api(partner)).value.musicVolume, 0);
    await click(partner, "Pause music");
    pass("admin song reaches users with default 20% and persistent playback/volume controls");
    }
    await goto(owner, "/plan/new"); await text(owner, "Make a day of it.");
    await click(owner, "Tomorrow"); await click(owner, "Arcade");
    await click(owner, "Afternoon"); await click(owner, "Hotel");
    assert.equal(await prisma.date.count({ where: { coupleId: couple.id } }), 0);
    pass("adding route stops creates no database date before Save");
    await click(owner, "Find our first venue"); await click(owner, "Choose on map");
    await owner.waitForSelector(".leaflet-container");
    await click(owner, "Use map centre"); await owner.select('[aria-label="Map search radius"]', "10");
    await click(owner, "Search within 10 km of this pin"); await text(owner, "Within 10 km.");
    pass("nested Leaflet picker selects a pin and updates venue search radius");
    // Close the venue finder without saving an arbitrary map location as a real venue.
    await owner.keyboard.press("Escape");
    await owner.screenshot({ path: path.join(artifactDir, "itinerary-mobile.png"), fullPage: true });
    assert.equal(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await click(owner, "Save date"); await owner.waitForFunction(() => location.pathname.startsWith("/dates/"));
    const saved = await prisma.date.findFirst({ where: { coupleId: couple.id }, include: { activities: { orderBy: { sortOrder: "asc" } } } });
    assert.equal(saved.activities.length, 2); assert.ok(saved.activities[0].startAt); assert.ok(saved.activities[1].startAt);
    pass("one-screen route saves both stops and their times in one explicit action");
    if (responsiveSmoke) {
      await goto(owner, `/dates/${saved.id}`); await click(owner, "Start the date");
      await text(owner, "Mark completed"); await click(owner, "Mark completed");
      await goto(owner, `/dates/${saved.id}/memory`);
      await fill(owner, "#memory-title", "Our QA adventure"); await fill(owner, "#memory-body", "Coffee, arcade and a little time together.");
      await click(owner, "Keep this memory");
      await owner.waitForFunction((id) => location.pathname === `/dates/${id}`, {}, saved.id);
      const memory = await prisma.memory.findFirstOrThrow({ where: { dateId: saved.id, deletedAt: null } });
      await goto(partner, `/memories/${memory.id}`); await text(partner, "Coffee, arcade and a little time together.");
      pass("date completes and a saved memory reaches the partner");
      for (const width of [320, 390, 768, 1440]) {
        await partner.setViewport({ width, height: 900, isMobile: width < 768, hasTouch: width < 768 });
        for (const route of ["/home", "/chat", "/plan/new", "/explore", "/memories", "/memories/photos", "/settings/profile"]) {
          await goto(partner, route);
          assert.equal(await partner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Overflow at ${width}: ${route}`);
          assert.equal(await partner.evaluate(() => document.body.innerText.includes("Something went wrong")), false, `Error at ${route}`);
        }
        await partner.screenshot({path:path.join(artifactDir,`profile-${width}.png`),fullPage:true});
      }
      pass("seven core pages fit 320, 390, 768 and 1440 pixel screens without page errors");
    }
    assert.deepEqual(errors, []); return { checks, jsErrors: errors.length };
  } catch (e) {
    for (let i = 0; i < contexts.length; i++) for (const page of await contexts[i].pages()) {
      await page.screenshot({ path: path.join(artifactDir, `failure-chat-${i}.png`), fullPage: true }).catch(() => {});
      await writeFile(path.join(artifactDir, `failure-chat-${i}.txt`), await page.evaluate(() => document.body.innerText).catch(() => ""));
    }
    throw e;
  } finally { await prisma.siteAudio.deleteMany({ where: { updatedById: users[0].id } }); for (const context of contexts) await context.close(); }
}
