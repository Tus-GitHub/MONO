import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import sharp from "sharp";

// Exercise the visible custom menu, retaining compatibility with older deployments.
async function chooseOption(page, selector, value) {
  const control = await page.$(selector);
  const info = await control.evaluate((node, value) => {
    const native = node.tagName === "SELECT" ? node : node.parentElement.querySelector("select");
    const trigger = native?.parentElement.querySelector('button[role="combobox"]');
    return { label: Array.from(native?.options ?? []).find(o => o.value === value)?.textContent, triggerId: trigger?.id };
  }, value);
  if (!info.triggerId) { await page.select(selector, value); return; }
  await page.locator(`[id=${JSON.stringify(info.triggerId)}]`).click();
  await page.waitForSelector('[role="option"]');
  const option = await page.evaluateHandle(label => Array.from(document.querySelectorAll('[role="option"]')).find(el => el.textContent.trim() === label.trim()), info.label);
  await option.asElement().evaluate(el => el.scrollIntoView({block:"nearest",behavior:"instant"}));
  await new Promise(resolve => setTimeout(resolve, 250));
  await option.asElement().click();
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'));
  await new Promise(resolve => setTimeout(resolve, 300));
}

export async function runChatPlanner({ browser, baseUrl, prisma, runId, artifactDir, allowGlobalAudio = true, responsiveSmoke = false, plannerOnly = false }) {
  let checks = 0; const contexts = [], errors = [];
  const pass = (label) => { checks++; console.log(`PASS chat-planner: ${label}`); };
  const password = randomBytes(20).toString("hex"), passwordHash = await bcrypt.hash(password, 12);
  const users = await Promise.all(["owner", "partner"].map((role) => prisma.user.create({ data: { email: `e2e-${runId}-${role}@example.invalid`, name: `${role} ${runId}`, passwordHash, emailVerified: new Date(), profileCompletedAt: new Date() } })));
  const couple = await prisma.couple.create({ data: { name: "Our QA route", createdById: users[0].id, inviteCode: randomBytes(15).toString("hex"), setupCompletedAt: new Date(), status: "ACTIVE", timezone: "Asia/Kolkata", members: { create: users.map((u, i) => ({ userId: u.id, role: i ? "PARTNER" : "OWNER", status: "ACTIVE" })) } } });
  const click = async (page, label) => {
    const selector = `xpath=//button[normalize-space(.)=${JSON.stringify(label)}]`;
    const target = await page.locator(selector).waitHandle();
    await target.evaluate((el) => el.scrollIntoView({block:"center",behavior:"instant"}));
    await page.waitForFunction((label) => {
      const el=[...document.querySelectorAll("button")].find(el=>el.textContent.trim()===label && !el.disabled); if(!el)return false;
      const r=el.getBoundingClientRect(); const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return hit && el.contains(hit);
    }, {}, label);
    await page.locator(selector).setEnsureElementIsInTheViewport(false).click(); await target.dispose();
  };
  const fill = async (page, selector, value) => { await page.locator(selector).click(); await page.keyboard.down("Control"); await page.keyboard.press("KeyA"); await page.keyboard.up("Control"); await page.keyboard.press("Backspace"); await page.type(selector, value, { delay: 3 }); assert.equal(await page.$eval(selector, (el) => el.value), value, "Typed field value was not retained"); };
  const text = (page, value) => page.waitForFunction((value) => document.body.innerText.includes(value), {}, value);
  const goto = async (page, route) => {
    await page.bringToFront();
    console.log("NAVIGATE", route);
    try { await page.goto(baseUrl + route, { waitUntil: "networkidle2", timeout: 180000 }); }
    catch (error) {
      // A just-completed server action can finish its redirect after pathname changes.
      if (!String(error).includes("net::ERR_ABORTED")) throw error;
      await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 });
      await page.goto(baseUrl + route, { waitUntil: "networkidle2", timeout: 180000 });
    }
    if (await page.evaluate(() => document.body.innerText.includes("You’re offline"))) {
      console.log("NETWORK RETRY: offline navigation fallback at", route);
      await page.goto(baseUrl + route, { waitUntil: "networkidle2", timeout: 180000 });
      assert.equal(await page.evaluate(() => document.body.innerText.includes("You’re offline")), false, `Still offline at ${route}`);
    }
  };
  const pageFor = async (user) => {
    const context = await browser.createBrowserContext(); contexts.push(context); const page = await context.newPage();
    page.on("console", async (message) => { if (message.type() === "error") { const details = await Promise.all(message.args().map((arg) => arg.evaluate((value) => value instanceof Error ? `${value.name}: ${value.message}` : typeof value === "string" ? value.slice(0, 500) : "[object]").catch(() => "[unavailable]"))); console.log("Browser console error:", details.join(" ") || message.text()); } });
    page.on("requestfailed", (request) => { const u = new URL(request.url()); if (u.origin === new URL(baseUrl).origin) console.log("Network failure:", request.method(), u.pathname, request.failure()?.errorText); });
    page.setDefaultTimeout(120000); page.setDefaultNavigationTimeout(180000); page.on("pageerror", (e) => { errors.push(e.message); console.error("Browser error:", e.message); });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await goto(page, "/login"); await fill(page, '[name="email"]', user.email); await fill(page, '[name="password"]', password); assert.equal(await page.$eval('[name="email"]', (el) => el.value), user.email); await click(page, "Sign in");
    await page.waitForFunction(() => location.pathname === "/home"); await page.waitForNetworkIdle({ idleTime: 1000, timeout: 60000 }); if (!plannerOnly) await goto(page, "/chat");
    await page.waitForFunction(() => !document.body.innerText.includes("Checking this device…")); console.log("CHECKPOINT device ready:", contexts.length); return page;
  };
  const api = (page, body) => page.evaluate(async (body) => { const r = await fetch("/api/audio", { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, value: await r.json() }; }, body);
  try {
    const owner = await pageFor(users[0]);
    let partner;
    if (!plannerOnly) {
    await click(owner, "Generate recovery code");
    await owner.waitForSelector("p.select-all");
    const code = await owner.$eval("p.select-all", (el) => el.textContent);
    await owner.locator('input[type="checkbox"]').click(); await click(owner, "Enable encrypted chat");
    await owner.waitForSelector('[aria-label="Message your partner"]');
    await fill(owner, '[aria-label="Message your partner"]', "A little adventure for us"); await owner.locator('[aria-label="Send message"]').click(); await text(owner, "A little adventure for us");
    partner = await pageFor(users[1]); await fill(partner, '[aria-label="Private recovery code"]', code); await click(partner, "Unlock on this device"); await text(partner, "A little adventure for us");
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
    await owner.locator('[aria-label="Add attachment"]').click();
    const documentPath = path.join(artifactDir, "itinerary.txt"); await writeFile(documentPath, "Café -> Arcade -> Movie\nPrivate attachment fixture");
    const chooser = owner.waitForFileChooser(); await owner.locator('xpath=//button[.//span[normalize-space(.)="Document"]]').click(); await (await chooser).accept([documentPath]); await click(owner, "Send document"); await text(owner, "itinerary.txt");
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
      await click(owner, "Use photo"); await owner.waitForSelector('[aria-label="Photo access"]:not(select.mono-native-control)', {visible:true}); await chooseOption(owner, '[aria-label="Photo access"]', String(limit)); await click(owner, "Send image");
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
    }
    await goto(owner, "/plan/new"); await text(owner, "Make a day of it.");
    await click(owner, "Tomorrow"); await click(owner, "Add your first stop");
    await click(owner, "Cancel"); await owner.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    assert.equal(await owner.$$eval('.mono-itinerary-stop', (rows) => rows.length), 0);
    await click(owner, "Add your first stop");
    await owner.setViewport({ width: 320, height: 700, isMobile: true, hasTouch: true });
    assert.equal(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await owner.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await owner.screenshot({ path: path.join(artifactDir, "activity-popup-mobile.png") });
    await click(owner, "Arcade"); await text(owner, "Choose on map");
    await owner.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button[aria-pressed="true"]')].some((el) => el.textContent.includes("Activities")));
    if (plannerOnly) {
      await owner.browserContext().overridePermissions(baseUrl, ["geolocation"]);
      await owner.setGeolocation({ latitude: 28.6, longitude: 77.2, accuracy: 100 });
      const nearbyRequest = owner.waitForRequest((request) => { const u=new URL(request.url()); return u.pathname==="/api/places/search" && u.searchParams.get("lat")==="28.6" && u.searchParams.get("lng")==="77.2" && u.searchParams.get("radius")==="5"; }, {timeout:15000});
      const locationResponse = owner.waitForResponse((r) => r.url().includes("/api/places/locations?lat=") && r.status() === 200, {timeout:15000}).then(r=>r.json()).catch(()=>null);
      await click(owner, "Use my location");
      await owner.waitForFunction(() => Boolean(document.querySelector('input[placeholder="City or Gaur City Mall"]')?.value));
      await text(owner, "Within 5 km."); await nearbyRequest;
      const named = await locationResponse;
      if (named?.label) await owner.waitForFunction((label) => document.querySelector('input[placeholder="City or Gaur City Mall"]')?.value === label, {}, named.label);
      await fill(owner, 'input[placeholder="City or Gaur City Mall"]', "Noida");
      assert.equal(await owner.evaluate(() => document.body.innerText.includes("Around your selected location")), false);
      pass("device location fills the area field, keeps radius search, and permits manual replacement");
    }
    await owner.keyboard.press("Escape"); await owner.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    await owner.locator('[aria-label="Edit stop 1"]').click(); await click(owner, "Afternoon");
    if (plannerOnly) {
      const start = await owner.evaluateHandle(() => {
        const label = Array.from(document.querySelectorAll("label")).find(el => el.textContent.trim() === "Stop 1 start");
        return label ? document.getElementById(label.htmlFor) : null;
      });
      await start.asElement().click(); await owner.waitForSelector('.mono-date-menu');
      await chooseOption(owner, 'button[aria-label="Hour"]', "15");
      await chooseOption(owner, 'button[aria-label="Minute"]', "30");
      await click(owner, "Set time");
      await owner.waitForFunction(() => Array.from(document.querySelectorAll('input[type="time"]')).some(el => el.value === "15:30"));
      await new Promise(resolve => setTimeout(resolve, 300));
      pass("custom time picker updates the controlled date-stop field");
    }
    await click(owner, "Done editing");
    await click(owner, "Add a stop"); await click(owner, "Hotel"); await text(owner, "Choose on map");
    await owner.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button[aria-pressed="true"]')].some((el) => el.textContent.includes("Staycation")));
    assert.equal(await prisma.date.count({ where: { coupleId: couple.id } }), 0);
    pass("adding route stops creates no database date before Save");
    await click(owner, "Choose on map");
    await owner.waitForSelector(".leaflet-container");
    if (plannerOnly) {
      await owner.locator('xpath=(//div[@role="dialog"]//button[normalize-space(.)="Use my location"])[last()]').click();
      await owner.waitForFunction(() => Boolean(document.querySelector('input[aria-label="City, area or landmark"]')?.value) && document.querySelector('input[aria-label="City, area or landmark"]').value !== "Noida");
      pass("map location button fills its location field");
    } else await click(owner, "Use map centre");
    await chooseOption(owner, '[aria-label="Map search radius"]', "10");
    await click(owner, "Search within 10 km of this pin"); await text(owner, "Within 10 km.");
    pass("nested Leaflet picker selects a pin and updates venue search radius");
    // Choose a clearly synthetic custom venue rather than inventing a real place at the map pin.
    await owner.locator('[role="tab"][id$="custom"]').click();
    await fill(owner, "#cp-name", "QA private retreat"); await chooseOption(owner, "#cp-category", "TRAVEL");
    await click(owner, "Use this place"); await owner.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    await text(owner, "QA private retreat");
    assert.equal(await prisma.date.count({ where: { coupleId: couple.id } }), 0);
    await owner.evaluate(() => window.scrollTo({top:0,behavior:"instant"}));
    await owner.screenshot({ path: path.join(artifactDir, "itinerary-mobile.png"), fullPage: true });
    assert.equal(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    if (plannerOnly) {
      for (const width of [320, 390, 768, 1440]) {
        await owner.setViewport({width,height:900,isMobile:width<768,hasTouch:width<768});
        await owner.$eval('button[value="plan"]', el => el.scrollIntoView({block:"center",behavior:"instant"}));
        await owner.waitForFunction(() => {
          const save=document.querySelector('button[value="plan"]'); const r=save.getBoundingClientRect();
          const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          const nav=document.querySelector('.mono-bottom-nav'); const n=nav?.getBoundingClientRect();
          return save.contains(hit) && (innerWidth>=1024 || r.bottom <= n.top) && document.documentElement.scrollWidth<=innerWidth+1;
        });
        await owner.screenshot({path:path.join(artifactDir,`planner-save-${width}.png`)});
      }
      pass("Save stays visible above mobile navigation at 320/390/768px and fits desktop at 1440px");
    }
    await click(owner, "Save date"); await owner.waitForFunction(() => location.pathname.startsWith("/dates/"));
    const saved = await prisma.date.findFirst({ where: { coupleId: couple.id }, include: { activities: { orderBy: { sortOrder: "asc" } } } });
    if (plannerOnly) assert.equal(new Intl.DateTimeFormat("en-GB", {hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(saved.activities[0].startAt), "15:30");
    assert.equal(saved.activities.length, 2); assert.ok(saved.activities[0].startAt); assert.ok(saved.activities[1].startAt); assert.ok(saved.activities[1].placeId);
    pass("one-screen route saves both stops and their times in one explicit action");
    if (responsiveSmoke) {
      partner ??= await pageFor(users[1]);
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
          assert.equal(await partner.evaluate(() => /Something went wrong|This didn.t load|You.re offline/.test(document.body.innerText)), false, `Error at ${route}`);
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
