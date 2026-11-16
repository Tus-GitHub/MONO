import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

export async function runChatVideos({ browser, baseUrl, prisma, runId, artifactDir }) {
  let checks = 0;
  const contexts = [], errors = [], wire = [];
  const pass = (label) => { checks++; console.log(`PASS chat-videos: ${label}`); };
  const password = randomBytes(20).toString("hex"), passwordHash = await bcrypt.hash(password, 12);
  const users = await Promise.all(["owner", "partner"].map((role) => prisma.user.create({ data: { email: `e2e-${runId}-${role}@example.invalid`, name: `${role} ${runId}`, passwordHash, emailVerified: new Date(), profileCompletedAt: new Date() } })));
  const couple = await prisma.couple.create({ data: { name: "Video QA", createdById: users[0].id, inviteCode: randomBytes(15).toString("hex"), setupCompletedAt: new Date(), status: "ACTIVE", members: { create: users.map((user, index) => ({ userId: user.id, role: index ? "PARTNER" : "OWNER", status: "ACTIVE" })) } } });
  const target = async (page, selector) => {
    await page.bringToFront(); const el = await page.locator(selector).waitHandle();
    await el.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForFunction(el => { const r = el.getBoundingClientRect(); return !el.disabled && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }, {}, el);
    await page.locator(selector).setEnsureElementIsInTheViewport(false).click(); await el.dispose();
  };
  const click = (page, label) => target(page, `xpath=//button[normalize-space(.)=${JSON.stringify(label)}]`);
  const text = (page, value) => page.waitForFunction(value => document.body.innerText.includes(value), { timeout: 120000 }, value);
  const noDialog = page => page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  const navigate = async (page, url) => {
    for (let attempt = 0; ; attempt++) {
      try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }); await page.waitForSelector("body", { timeout: 15000 }); return; }
      catch (error) { if (attempt >= 2) throw error; console.log(`Retry QA navigation ${new URL(url).pathname}`); }
    }
  };
  const pageFor = async user => {
    const context = await browser.createBrowserContext(); contexts.push(context); const page = await context.newPage();
    // tsx preserves names with this helper when the live TypeScript harness imports the suite.
    await page.evaluateOnNewDocument("globalThis.__name = (value) => value;");
    page.setDefaultTimeout(90000); page.setDefaultNavigationTimeout(180000);
    page.on("pageerror", e => errors.push(e.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await navigate(page, `${baseUrl}/login`);
    await page.type('[name="email"]', user.email); await page.type('[name="password"]', password); await click(page, "Sign in");
    await page.waitForFunction(() => location.pathname === "/home"); await navigate(page, `${baseUrl}/chat`);
    await page.waitForFunction(() => !document.body.innerText.includes("Checking this device…")); return page;
  };
  try {
    const owner = await pageFor(users[0]); await click(owner, "Generate recovery code");
    const code = await owner.$eval("p.select-all", el => el.textContent);
    await target(owner, 'input[type="checkbox"]'); await click(owner, "Enable encrypted chat"); await owner.waitForSelector('[aria-label="Message your partner"]');
    const partner = await pageFor(users[1]); await partner.waitForSelector('[aria-label="Private recovery code"]', { visible: true }); await partner.type('[aria-label="Private recovery code"]', code); await click(partner, "Unlock on this device"); await partner.waitForSelector('[aria-label="Message your partner"]');
    pass("both partners unlock encrypted chat");
    await owner.bringToFront(); await target(owner, '[aria-label="Add attachment"]'); await text(owner, "Share something");
    // Record genuine moving frames and an audio tone locally. No personal camera/microphone.
    const source = await owner.evaluate(async () => {
      const canvas = document.createElement("canvas"); canvas.width = 960; canvas.height = 540;
      const ctx = canvas.getContext("2d"), pixels = ctx.createImageData(canvas.width, canvas.height);
      const audio = new AudioContext(); await audio.resume();
      const oscillator = audio.createOscillator(), gain = audio.createGain(), destination = audio.createMediaStreamDestination();
      oscillator.frequency.value = 660; gain.gain.value = 0.1; oscillator.connect(gain).connect(destination); oscillator.start();
      const stream = canvas.captureStream(30); stream.addTrack(destination.stream.getAudioTracks()[0]);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus", videoBitsPerSecond: 14000000, audioBitsPerSecond: 96000 });
      const chunks = []; recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise(resolve => { recorder.onstop = resolve; });
      let frame = 0; const draw = () => { const view = new Uint32Array(pixels.data.buffer); for (let i = 0; i < view.length; i++) view[i] = 0xff000000 | (Math.random() * 0xffffff); ctx.putImageData(pixels, 0, 0); ctx.fillStyle = "white"; ctx.font = "40px sans-serif"; ctx.fillText(`AMOR video QA ${frame++}`, 30, 60); };
      draw(); const timer = setInterval(draw, 34); recorder.start(500);
      await new Promise(resolve => setTimeout(resolve, 14000)); recorder.stop(); await stopped; clearInterval(timer); stream.getTracks().forEach(t => t.stop()); oscillator.stop(); await audio.close();
      const blob = new Blob(chunks, { type: "video/webm" });
      const data = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
      return { size: blob.size, data: data.split(",")[1] };
    });
    assert.ok(source.size > 8 * 1024 * 1024, `fixture must exercise compression: ${source.size}`);
    const file = path.join(artifactDir, "private-qa-video.webm"); await writeFile(file, Buffer.from(source.data, "base64"));
    const choose = owner.waitForFileChooser(); await target(owner, 'xpath=//button[.//span[normalize-space(.)="Video"]]'); await (await choose).accept([file]);
    await text(owner, "Compressed on this device");
    const beforeSend = await prisma.chatMessage.count({ where: { coupleId: couple.id, kind: "VIDEO" } }); assert.equal(beforeSend, 0);
    await owner.screenshot({ path: path.join(artifactDir, "video-prepared-mobile.png") });
    // Fail one chunk three times to exercise the visible retry, retaining the same ciphertext.
    let failures = 0;
    await owner.setRequestInterception(true); owner.on("request", request => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/together/videos") {
        const data = request.postData() ?? ""; wire.push(data);
        const body = JSON.parse(data);
        if (body.action === "part" && body.index === 1 && failures < 3) { failures++; void request.respond({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic connection interruption. Retry your video." }) }); return; }
      }
      void request.continue();
    });
    await click(owner, "Send video"); await text(owner, "Synthetic connection interruption"); await click(owner, "Retry video"); await noDialog(owner);
    await text(owner, "Open video"); await partner.bringToFront(); await text(partner, "Open video");
    const row = await prisma.chatMessage.findFirstOrThrow({ where: { coupleId: couple.id, kind: "VIDEO" }, include: { video: { include: { parts: true } } } });
    assert.ok(row.video.byteLength < source.size); assert.equal(row.encrypted, true);
    assert.ok(!wire.some(body => body.includes("private-qa-video"))); assert.ok(wire.every(body => Buffer.byteLength(body) < 1500000));
    assert.equal(await prisma.chatMessage.count({ where: { coupleId: couple.id, kind: "VIDEO" } }), 1);
    pass(`compresses ${source.size} to ${row.video.byteLength} bytes; chunk retry sends exactly one encrypted message`);
    const playback = async page => {
      await click(page, "Open video"); await page.waitForSelector('video[aria-label="Encrypted chat video"]');
      await page.waitForFunction(() => document.querySelector('video[aria-label="Encrypted chat video"]')?.readyState >= 2);
      const stats = await page.evaluate(async () => {
        const video = document.querySelector('video[aria-label="Encrypted chat video"]');
        const audio = new AudioContext(); await audio.resume(); const source = audio.createMediaElementSource(video), analyser = audio.createAnalyser(); source.connect(analyser); analyser.connect(audio.destination);
        await video.play(); const values = new Float32Array(analyser.fftSize); let peak = 0;
        for (let i = 0; i < 20; i++) { await new Promise(resolve => setTimeout(resolve, 100)); analyser.getFloatTimeDomainData(values); for (const value of values) peak = Math.max(peak, Math.abs(value)); }
        const result = { width: video.videoWidth, height: video.videoHeight, time: video.currentTime, duration: video.duration, peak }; video.pause(); await audio.close(); return result;
      });
      assert.ok(stats.time > 0.5 && stats.duration > 10); assert.ok(stats.peak > 0.001, `audio must survive: ${JSON.stringify(stats)}`); assert.ok(Math.max(stats.width, stats.height) <= 720);
    };
    await playback(owner); await playback(partner); pass("both partners decrypt and play moving video with a measurable audio track");
    await navigate(partner, `${baseUrl}/chat`); await playback(partner); pass("encrypted video survives reload and remains playable");
    await partner.screenshot({ path: path.join(artifactDir, "video-playback-mobile.png") });
    for (const width of [320, 768, 1440]) { await partner.setViewport({ width, height: 900, isMobile: true, hasTouch: true }); assert.equal(await partner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true); }
    await partner.screenshot({ path: path.join(artifactDir, "video-playback-wide.png") }); pass("video controls fit narrow mobile and wide layouts");
    await prisma.adminAccess.create({ data: { userId: users[0].id } });
    await navigate(owner, `${baseUrl}/admin?view=couples&query=${couple.id}`);
    await text(owner, users[0].id); await text(owner, users[1].id); await text(owner, "Videos");
    const adminText = await owner.evaluate(() => document.body.innerText); assert.ok(!adminText.includes(users[1].email)); assert.ok(!adminText.includes("private-qa-video"));
    await owner.$eval('#couples-heading', el => el.scrollIntoView({ block: "start", behavior: "instant" }));
    await owner.screenshot({ path: path.join(artifactDir, "admin-couple-storage.png") }); pass("admin groups both IDs with storage without disclosing names, emails or video metadata");
    await navigate(owner, `${baseUrl}/chat`); await text(owner, "Open video");
    await target(partner, '[aria-label="Message options"]'); await click(partner, "Delete for me"); await noDialog(partner);
    assert.equal(await partner.evaluate(async id => (await fetch(`/api/together/videos/${id}`)).status, row.id), 404);
    await target(owner, '[aria-label="Message options"]'); await click(owner, "Delete for everyone"); await noDialog(owner);
    assert.equal(await owner.evaluate(async id => (await fetch(`/api/together/videos/${id}?part=0`)).status, row.id), 404);
    pass("delete for me and delete for everyone revoke the correct media access");
    assert.deepEqual(errors, []); return { checks, originalBytes: source.size, uploadedBytes: row.video.byteLength, storageKeys: row.video.parts.map(part => part.storageKey) };
  } catch (error) {
    for (const [index, context] of contexts.entries()) for (const page of await context.pages()) {
      await page.screenshot({ path: path.join(artifactDir, `video-failure-${index}.png`), timeout: 5000 }).catch(() => {});
      console.log(`VIDEO QA ${index}:`, (await page.evaluate(() => document.body.innerText).catch(() => "")).slice(-2500));
    }
    throw error;
  } finally { await Promise.all(contexts.map(context => context.close())); }
}
