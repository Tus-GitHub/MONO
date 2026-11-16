import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";

/** Real signaling and WebRTC between two isolated users; generated media, never device capture. */
export async function runCallMinimize({ browser, baseUrl, prisma, runId, artifactDir }) {
  const contexts = [], errors = [];
  let checks = 0;
  const pass = label => { checks++; console.log(`PASS call-minimize: ${label}`); };
  const password = randomBytes(20).toString("hex"), passwordHash = await bcrypt.hash(password, 12);
  const users = await Promise.all(["owner", "partner"].map(role => prisma.user.create({ data: { email: `e2e-${runId}-${role}@example.invalid`, name: `${role} ${runId}`, passwordHash, emailVerified: new Date(), profileCompletedAt: new Date() } })));
  await prisma.couple.create({ data: { name: "Call minimization QA", createdById: users[0].id, inviteCode: randomBytes(15).toString("hex"), setupCompletedAt: new Date(), status: "ACTIVE", members: { create: users.map((u, i) => ({ userId: u.id, role: i ? "PARTNER" : "OWNER", status: "ACTIVE" })) } } });
  const target = async (page, selector) => {
    await page.bringToFront(); const el = await page.locator(selector).waitHandle();
    await el.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForFunction(el => { const r = el.getBoundingClientRect(); return !el.disabled && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }, {}, el);
    await page.locator(selector).setEnsureElementIsInTheViewport(false).click(); await el.dispose();
  };
  const click = (page, label) => target(page, `xpath=//button[normalize-space(.)=${JSON.stringify(label)}]`);
  const navigate = async (page, url) => {
    for (let attempt = 0; ; attempt++) try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }); return; }
    catch (error) { if (attempt === 2) throw error; }
  };
  const connected = page => page.waitForFunction(() => window.__qaPeers?.at(-1)?.connectionState === "connected");
  const reveal = async page => { if (await page.$('[aria-label="Show call controls"]')) await target(page, '[aria-label="Show call controls"]'); };
  const sample = page => page.evaluate(async () => {
    const pc = window.__qaPeers.at(-1), stats = [...(await pc.getStats()).values()];
    return { count: window.__qaPeers.length, state: pc.connectionState,
      mic: pc.getSenders().filter(s => s.track?.kind === "audio").map(s => ({ enabled: s.track.enabled, state: s.track.readyState })),
      audio: stats.filter(s => s.type === "inbound-rtp" && s.kind === "audio").reduce((sum, s) => sum + (s.totalAudioEnergy ?? 0), 0),
      video: stats.filter(s => s.type === "inbound-rtp" && s.kind === "video").reduce((sum, s) => sum + (s.framesDecoded ?? 0), 0) };
  });
  const preserved = async (page, before, video = true) => {
    await page.waitForFunction(async (before, video) => {
      const pc = window.__qaPeers.at(-1); if (pc.connectionState !== "connected") return false;
      const stats = [...(await pc.getStats()).values()];
      return stats.some(s => s.type === "inbound-rtp" && s.kind === "audio" && s.totalAudioEnergy > before.audio)
        && (!video || stats.some(s => s.type === "inbound-rtp" && s.kind === "video" && s.framesDecoded > before.video));
    }, {}, before, video);
    const after = await sample(page); assert.equal(after.count, before.count); assert.equal(after.state, "connected");
    assert.deepEqual(after.mic, [{ enabled: true, state: "live" }]);
    assert.equal(await page.$eval('[aria-label="Partner call audio"]', el => !el.paused && !el.muted && el.volume > 0 && Boolean(el.srcObject?.getAudioTracks().some(track => track.readyState === "live"))), true);
  };
  const pageFor = async user => {
    const context = await browser.createBrowserContext(); contexts.push(context); const page = await context.newPage();
    await page.evaluateOnNewDocument("globalThis.__name = (value) => value;");
    await page.evaluateOnNewDocument(() => {
      if (!navigator.mediaDevices) return; // Initial about:blank / non-secure frames have no capture API.
      window.__qaPeers = [];
      const Peer = window.RTCPeerConnection;
      window.RTCPeerConnection = class extends Peer { constructor(...args) { super(...args); window.__qaPeers.push(this); } };
      navigator.mediaDevices.getUserMedia = async constraints => {
        const stream = new MediaStream();
        if (constraints.audio) {
          const ctx = new AudioContext(); await ctx.resume();
          const tone = ctx.createOscillator(), gain = ctx.createGain(), out = ctx.createMediaStreamDestination();
          gain.gain.value = 0.08; tone.frequency.value = 440; tone.connect(gain).connect(out); tone.start();
          const track = out.stream.getAudioTracks()[0]; stream.addTrack(track);
          const stop = track.stop.bind(track); track.stop = () => { stop(); tone.stop(); void ctx.close(); };
        }
        if (constraints.video) {
          const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 240;
          const ctx = canvas.getContext("2d"); let frame = 0;
          const draw = () => { ctx.fillStyle = `hsl(${frame++ % 360} 65% 35%)`; ctx.fillRect(0, 0, 320, 240); ctx.fillStyle = "white"; ctx.font = "24px sans-serif"; ctx.fillText(`MONO QA ${frame}`, 20, 80); };
          draw(); const timer = setInterval(draw, 100), track = canvas.captureStream(10).getVideoTracks()[0];
          stream.addTrack(track); const stop = track.stop.bind(track); track.stop = () => { stop(); clearInterval(timer); };
        }
        return stream;
      };
    });
    page.setDefaultTimeout(90000); page.on("pageerror", error => errors.push(error.message));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await navigate(page, `${baseUrl}/login`); await page.type('[name="email"]', user.email); await page.type('[name="password"]', password); await click(page, "Sign in");
    await page.waitForFunction(() => location.pathname === "/home"); await navigate(page, `${baseUrl}/chat`); return page;
  };
  try {
    const owner = await pageFor(users[0]); await click(owner, "Generate recovery code"); const code = await owner.$eval("p.select-all", el => el.textContent);
    await target(owner, 'input[type="checkbox"]'); await click(owner, "Enable encrypted chat"); await owner.waitForSelector('[aria-label="Message your partner"]');
    const partner = await pageFor(users[1]); await partner.waitForSelector('[aria-label="Private recovery code"]'); await partner.locator('[aria-label="Private recovery code"]').fill(code); await click(partner, "Unlock on this device"); await partner.waitForSelector('[aria-label="Message your partner"]');
    await target(owner, '[aria-label="Video call"]'); await partner.bringToFront(); await target(partner, '[aria-label="Pick up"]');
    await Promise.all([connected(owner), connected(partner)]);
    const before = await sample(owner), peerBefore = await sample(partner);
    await preserved(owner, before); await preserved(partner, peerBefore); pass("both users connect with actual audio/video RTP");
    await owner.evaluate(() => { window.__qaVideo = document.querySelector('[aria-label="Partner live video"]'); window.__qaAudio = document.querySelector('[aria-label="Partner call audio"]'); });
    await reveal(owner); await target(owner, '[aria-label="Minimize call"]'); await owner.waitForSelector('[aria-label="Minimized video call"]');
    assert.equal(await owner.$('[role="dialog"]'), null); assert.equal(await owner.$('[aria-label="Voice call"]'), null);
    assert.equal(await owner.evaluate(() => document.querySelector('[aria-label="Partner live video"]') === window.__qaVideo && document.querySelector('[aria-label="Partner call audio"]') === window.__qaAudio), true);
    assert.equal(await owner.evaluate(() => [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Return to call")), false);
    assert.equal(await owner.$('[aria-label="Open current call"]'), null);
    await target(owner, '[aria-label="Message your partner"]'); await owner.type('[aria-label="Message your partner"]', "Typing while the video continues");
    await preserved(owner, before); await preserved(partner, peerBefore); pass("X minimizes without replacing players or muting either microphone; chat stays usable");
    const startRect = await owner.$eval('[aria-label="Minimized video call"]', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    const touch = await owner.createCDPSession();
    const startPoint = { x: startRect.x + startRect.width / 2, y: startRect.y + startRect.height / 2 };
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [startPoint] });
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: startPoint.x - 140, y: startPoint.y + 180 }] });
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await touch.detach();
    await owner.waitForFunction(x => document.querySelector('[aria-label="Minimized video call"]').getBoundingClientRect().x < x - 80, {}, startRect.x);
    assert.equal(await owner.$('[role="dialog"]'), null);
    await owner.focus('[aria-label="Expand video call"]'); await owner.keyboard.press("ArrowLeft");
    await preserved(owner, before); pass("touch dragging and keyboard movement keep the mini call connected without opening it");
    await owner.screenshot({ path: path.join(artifactDir, "call-mini-mobile.png") });
    for (const [width, height] of [[320, 568], [844, 390], [1440, 900]]) {
      await owner.setViewport({ width, height, isMobile: true, hasTouch: true });
      await owner.waitForFunction(() => {
        const mini = document.querySelector('[aria-label="Minimized video call"]').getBoundingClientRect();
        return mini.width > 60 && mini.right <= innerWidth && mini.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth + 1;
      });
    }
    pass("mini view stays inside 320px mobile, landscape and desktop viewports");
    await target(owner, '[aria-label="Expand video call"]'); await owner.waitForSelector('[role="dialog"]');
    await owner.evaluate(() => history.back()); await owner.waitForSelector('[aria-label="Minimized video call"]');
    assert.equal(new URL(owner.url()).pathname, "/chat"); await preserved(owner, before); pass("browser Back minimizes instead of leaving chat or ending the call");
    await target(owner, '[aria-label="Expand video call"]'); await owner.waitForSelector('[role="dialog"]');
    assert.equal(await owner.evaluate(() => document.querySelector('[aria-label="Partner live video"]') === window.__qaVideo), true);
    await reveal(owner); await target(owner, '[aria-label="Audio"]');
    await target(owner, '[aria-label="Minimize call"]'); await target(owner, '[aria-label="Expand video call"]');
    await owner.evaluate(() => new Promise(resolve => setTimeout(resolve, 5500)));
    assert.equal(await owner.$eval('[aria-label="Call audio output"]', el => getComputedStyle(el).visibility), "visible");
    await target(owner, '[aria-label="Call audio output"] button');
    await reveal(owner); await target(owner, '[aria-label="Minimize call"]'); await owner.waitForSelector('[aria-label="Minimized video call"]');
    await target(owner, '[aria-label="Back to MONO"]'); await owner.waitForFunction(() => location.pathname === "/home");
    await owner.waitForSelector('[aria-label="Minimized video call"]'); await preserved(owner, before);
    await target(owner, '[aria-label="Expand video call"]'); await owner.waitForSelector('[role="dialog"]'); await reveal(owner); await target(owner, '[aria-label="Minimize call"]');
    await target(owner, '[aria-label="Minimized video call"] [aria-label="End call"]');
    await owner.waitForFunction(() => !document.querySelector('[aria-label="Minimized video call"]'));
    await partner.bringToFront(); await partner.waitForFunction(() => window.__qaPeers.at(-1).connectionState === "closed");
    pass("mini view survives in-app navigation; expand and red hang-up work for both partners");
    // Verify the voice-only header path too, with a fresh call and no floating video.
    await navigate(owner, `${baseUrl}/chat`); await target(owner, '[aria-label="Voice call"]'); await target(partner, '[aria-label="Pick up"]');
    await Promise.all([connected(owner), connected(partner)]); const voice = await sample(owner);
    await target(owner, '[aria-label="Minimize call"]'); await owner.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    assert.equal(await owner.$('[aria-label="Minimized video call"]'), null); await preserved(owner, voice, false);
    await target(owner, '[aria-label="Open current call"]'); await target(owner, '[aria-label="End call"]');
    pass("voice calls return through the header icon and preserve microphone audio");
    assert.deepEqual(errors, []); return { checks };
  } catch (error) {
    for (const [i, context] of contexts.entries()) for (const page of await context.pages()) {
      await page.screenshot({ path: path.join(artifactDir, `call-failure-${i}.png`), timeout: 5000 }).catch(() => {});
      console.log(`CALL QA ${i}`, (await page.evaluate(() => document.body.innerText).catch(() => "")).slice(-1800));
    }
    throw error;
  } finally { await Promise.all(contexts.map(c => c.close())); }
}
