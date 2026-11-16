import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

export async function runMusicLibrary({ browser, baseUrl, prisma, runId, artifactDir }) {
  const contexts = [], errors = []; let checks = 0;
  const local = new URL(baseUrl).hostname === "127.0.0.1";
  const pass = message => { checks++; console.log(`PASS music-library: ${message}`); };
  const password = randomBytes(20).toString("hex"), passwordHash = await bcrypt.hash(password, 12);
  const users = await Promise.all(["owner", "partner"].map(role => prisma.user.create({ data: { email: `e2e-${runId}-${role}@example.invalid`, name: `${role} ${runId}`, passwordHash, emailVerified: new Date(), profileCompletedAt: new Date() } })));
  const couple = await prisma.couple.create({ data: { name: "Music QA", createdById: users[0].id, inviteCode: randomBytes(15).toString("hex"), status: "ACTIVE", setupCompletedAt: new Date(), members: { create: users.map((u, i) => ({ userId: u.id, role: i ? "PARTNER" : "OWNER", status: "ACTIVE" })) } } });
  const target = async (page, selector) => { await page.bringToFront(); const el = await page.locator(selector).waitHandle(); await el.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" })); await page.waitForFunction(el => { const r = el.getBoundingClientRect(); return !el.disabled && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }, {}, el); await page.locator(selector).setEnsureElementIsInTheViewport(false).click(); await el.dispose(); };
  const click = (page, label) => target(page, `xpath=//button[normalize-space(.)=${JSON.stringify(label)}]`);
  const nav = (page, route) => page.goto(baseUrl + route, { waitUntil: "domcontentloaded", timeout: 60000 });
  const pageFor = async user => {
    const context = await browser.createBrowserContext(); contexts.push(context); const page = await context.newPage(); page.setDefaultTimeout(90000);
    await page.evaluateOnNewDocument("globalThis.__name = (value) => value;");
    await page.evaluateOnNewDocument(() => {
      if (!window.AudioContext) return; window.__qaGains = [];
      const create = AudioContext.prototype.createGain; AudioContext.prototype.createGain = function () { const gain = create.call(this); window.__qaGains.push(gain); return gain; };
    });
    page.on("pageerror", error => errors.push(error.message)); await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await nav(page, "/login"); await page.type('[name="email"]', user.email); await page.type('[name="password"]', password); await click(page, "Sign in"); await page.waitForFunction(() => location.pathname === "/home"); return page;
  };
  const settings = page => page.evaluate(async () => (await fetch("/api/audio", { cache: "no-store" })).json());
  const saved = async (page, expected) => page.waitForFunction(async expected => { const value = await (await fetch("/api/audio", { cache: "no-store" })).json(); return Object.entries(expected).every(([key, wanted]) => JSON.stringify(value[key]) === JSON.stringify(wanted)); }, { polling: 1000 }, expected);
  try {
    const owner = await pageFor(users[0]);
    if (local) {
      await prisma.adminAccess.create({ data: { userId: users[0].id } }); await nav(owner, "/admin");
      const files = [];
      for (let i = 0; i < 3; i++) {
        const rate = 16000, samples = rate * 3, data = Buffer.alloc(44 + samples * 2);
        data.write("RIFF", 0); data.writeUInt32LE(data.length - 8, 4); data.write("WAVEfmt ", 8); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write("data", 36); data.writeUInt32LE(samples * 2, 40);
        for (let sample = 0; sample < samples; sample++) data.writeInt16LE(Math.round(Math.sin(sample / rate * 2 * Math.PI * (330 + i * 110)) * 8000), 44 + sample * 2);
        const file = path.join(artifactDir, `QA ${i + 1} ${runId}.wav`); await writeFile(file, data); files.push(file);
      }
      const chooser = owner.waitForFileChooser(); await click(owner, "Choose songs"); await (await chooser).accept(files); await click(owner, "Publish 3 songs");
      await owner.waitForFunction(() => document.body.innerText.includes("3 songs added to MONO."));
      assert.equal(await prisma.siteAudio.count({ where: { updatedById: users[0].id } }), 3);
      await owner.screenshot({ path: path.join(artifactDir, "admin-music-library.png"), fullPage: true }); pass("admin uploads three songs together without replacing existing songs");
    }
    const partner = await pageFor(users[1]); await nav(partner, "/settings/profile");
    await partner.waitForSelector('[aria-label="Background music volume"]');
    const before = await settings(partner); assert.ok(before.tracks.length > 0, "live library needs at least one existing song");
    const tracks = local ? before.tracks.filter(track => track.title.includes(runId)) : before.tracks;
    const chosen = tracks[Math.min(1, tracks.length - 1)];
    for (const track of before.tracks) if (track.id !== chosen.id) await target(partner, `button[aria-label=${JSON.stringify(`Exclude ${track.title}`)}]`);
    if (before.tracks.length === 1) { await target(partner, `button[aria-label=${JSON.stringify(`Exclude ${chosen.title}`)}]`); await target(partner, `button[aria-label=${JSON.stringify(`Include ${chosen.title}`)}]`); }
    await partner.$eval('[aria-label="Background music volume"]', el => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "2"); el.dispatchEvent(new Event("input", { bubbles: true })); });
    await click(partner, "Repeat playlist"); await target(partner, `button[aria-label=${JSON.stringify(`Play ${chosen.title}`)}]`);
    await saved(partner, { musicVolume: 0.02, musicMode: "selected", musicSelectedIds: [chosen.id], musicRepeatOne: true, musicEnabled: true });
    await partner.waitForFunction(() => window.__qaGains?.some(gain => Math.abs(gain.gain.value - Math.pow(.02, 2.4)) < .00001));
    assert.equal(await partner.$eval('[aria-label="Background music"]', el => el.loop), true);
    pass("2% applies near-silent gain and selected-song repeat is saved");
    if (tracks.length > 1) await target(partner, `button[aria-label=${JSON.stringify(`Move ${chosen.title} up`)}]`);
    const expectedOrder = await partner.$$eval('[aria-label="Your music playlist"] [data-track-id]', rows => rows.map(row => row.dataset.trackId));
    await saved(partner, { musicOrder: tracks.length > 1 ? expectedOrder : [] });
    await nav(partner, "/settings/profile"); await partner.waitForSelector('[aria-label="Background music volume"]');
    assert.equal(await partner.$eval('[aria-label="Background music volume"]', el => el.value), "2");
    const restored = await settings(partner); assert.equal(restored.musicVolume, .02); assert.deepEqual(restored.musicSelectedIds, [chosen.id]); assert.equal(restored.musicRepeatOne, true);
    assert.equal((await settings(owner)).musicVolume, .2);
    await partner.screenshot({ path: path.join(artifactDir, "personal-playlist-mobile.png"), fullPage: true }); pass("volume, selection, order and repeat survive reload and stay independent between users");
    if (local) {
      await click(partner, "Play all songs"); await click(partner, "Repeat this song"); await target(partner, `button[aria-label=${JSON.stringify(`Play ${tracks[0].title}`)}]`);
      const ordered = await partner.$$eval('[aria-label="Your music playlist"] [data-track-id]', rows => rows.map(row => row.dataset.trackId));
      const nextId = ordered[(ordered.indexOf(tracks[0].id) + 1) % ordered.length];
      await partner.waitForFunction(id => new URL(document.querySelector('[aria-label="Background music"]').src).searchParams.get("id") === id, { timeout: 15000 }, nextId);
      pass("playlist advances automatically when a song ends");
      await target(owner, `button[aria-label=${JSON.stringify(`Remove ${tracks[0].title}`)}]`); await click(owner, "Remove song"); await owner.waitForFunction(() => !document.querySelector('[role="dialog"]'));
      await nav(partner, "/settings/profile"); await partner.waitForSelector('[aria-label="Background music volume"]'); assert.equal((await settings(partner)).tracks.some(track => track.id === tracks[0].id), false);
      pass("admin removes one song while the other songs remain available");
    }
    for (const width of [320, 768, 1440]) { await partner.setViewport({ width, height: 900, isMobile: true, hasTouch: true }); assert.equal(await partner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true); }
    assert.deepEqual(errors, []); pass("playlist controls fit mobile and desktop without JavaScript errors"); return { checks };
  } catch (error) {
    for (const [index, context] of contexts.entries()) for (const page of await context.pages()) { console.log("MUSIC QA", (await page.evaluate(() => document.body.innerText).catch(() => "")).slice(-2000)); await page.screenshot({ path: path.join(artifactDir, `music-failure-${index}.png`), timeout: 5000 }).catch(() => {}); }
    throw error;
  } finally { await Promise.all(contexts.map(context => context.close())); await prisma.siteAudio.deleteMany({ where: { updatedById: users[0].id } }); await prisma.moderationAudit.deleteMany({ where: { actorId: { in: users.map(u => u.id) } } }); await prisma.couple.deleteMany({ where: { id: couple.id } }); await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } }); }
}
