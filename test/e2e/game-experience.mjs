import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";

export async function runGameExperience({ browser, baseUrl, prisma, runId, artifactDir }) {
  let checks = 0;
  const contexts = [], errors = [];
  const pass = (label) => { checks++; console.log(`PASS game-experience: ${label}`); };
  if (new URL(baseUrl).hostname === "127.0.0.1") {
    for (const route of ["/games/cm000000000000000000000000", "/api/together/games", "/api/together/games/chat", "/api/together", "/api/together/status", "/api/audio", "/api/reminders/dispatch"]) await fetch(baseUrl + route);
  }
  const password = randomBytes(20).toString("hex"), passwordHash = await bcrypt.hash(password, 12);
  const users = await Promise.all(["owner", "partner"].map((role) => prisma.user.create({ data: { email: `e2e-${runId}-${role}@example.invalid`, name: `${role} ${runId}`, passwordHash, emailVerified: new Date(), profileCompletedAt: new Date() } })));
  const couple = await prisma.couple.create({ data: { name: "Game QA", createdById: users[0].id, inviteCode: randomBytes(15).toString("hex"), setupCompletedAt: new Date(), status: "ACTIVE", members: { create: users.map((user, index) => ({ userId: user.id, role: index ? "PARTNER" : "OWNER", status: "ACTIVE" })) } } });
  const clickTarget = async (page, selector) => {
    await page.bringToFront();
    const handle = await page.locator(selector).waitHandle();
    await handle.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForFunction(el => { const r = el.getBoundingClientRect(); return !el.disabled && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }, {}, handle);
    await page.locator(selector).setEnsureElementIsInTheViewport(false).click(); await handle.dispose();
  };
  const click = (page, label) => clickTarget(page, `xpath=//button[normalize-space(.)=${JSON.stringify(label)}]`);
  const text = (page, value) => page.waitForFunction((value) => document.body?.innerText.includes(value), {}, value);
  const fill = async (page, selector, value) => {
    await page.locator(selector).click(); await page.keyboard.down("Control"); await page.keyboard.press("KeyA"); await page.keyboard.up("Control"); await page.keyboard.press("Backspace"); await page.type(selector, value);
  };
  const pageFor = async (user) => {
    const context = await browser.createBrowserContext(); contexts.push(context); const page = await context.newPage();
    page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(180000);
    page.on("console", msg => { if (/reload|HMR|Fast Refresh/.test(msg.text())) console.log("DEV", msg.text()); });
    page.on("pageerror", (error) => { errors.push(error.message); console.log("BROWSER ERROR", error.message); });
    page.on("framenavigated", frame => { if (frame === page.mainFrame()) console.log("PAGE", new URL(frame.url()).pathname); });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle2" });
    await fill(page, '[name="email"]', user.email); await fill(page, '[name="password"]', password); await click(page, "Sign in");
    await page.waitForFunction(() => location.pathname === "/home");
    await page.goto(`${baseUrl}/games`, { waitUntil: "networkidle2" });
    return page;
  };

  const bodies = [];
  try {
    const owner = await pageFor(users[0]), partner = await pageFor(users[1]);
    for (const page of [owner, partner]) page.on("request", request => { if (request.method() === "POST") bodies.push(request.postData() ?? ""); });
    await owner.bringToFront(); await clickTarget(owner, '[aria-label="Invite to Tic-tac-toe"]');
    await text(owner, "Waiting for");
    const game = await prisma.gameMatch.findFirstOrThrow({ where: { coupleId: couple.id }, orderBy: { createdAt: "desc" } });
    await partner.bringToFront(); await partner.goto(`${baseUrl}/games/${game.id}`, { waitUntil: "networkidle2" });
    await click(partner, "Accept game");
    await owner.bringToFront(); await text(owner, "Match chat");
    await Promise.all([owner, partner].map(page => page.waitForFunction(() => { const el = document.querySelector('[aria-label="Temporary game message"]'); return el && !el.disabled; }, { timeout: 90000 })));
    pass("two players connect a private inline match chat");
    const count = await prisma.chatMessage.count({ where: { coupleId: couple.id } });
    const first = `temporary-owner-${runId}`, second = `temporary-partner-${runId}`;
    await owner.type('[aria-label="Temporary game message"]', first); await clickTarget(owner, '[aria-label="Send game message"]');
    await text(partner, first); await text(owner, "Delivered");
    await partner.bringToFront(); await partner.type('[aria-label="Temporary game message"]', second); await clickTarget(partner, '[aria-label="Send game message"]'); await text(owner, second);
    assert.equal(await prisma.chatMessage.count({ where: { coupleId: couple.id } }), count);
    assert.equal(bodies.some(body => body.includes(first) || body.includes(second)), false);
    pass("messages travel in both directions without chat records or message-text API requests");
    for (const width of [320, 390, 768, 1440]) {
      await owner.setViewport({ width, height: 900, isMobile: width < 768, hasTouch: width < 768 });
      assert.equal(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `overflow at ${width}`);
      const order = await owner.evaluate(() => {
        const resign = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Resign this match');
        return resign.getBoundingClientRect().top < document.querySelector('[data-game-chat]').getBoundingClientRect().top;
      }); assert.equal(order, true);
    }
    await owner.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await owner.screenshot({ path: path.join(artifactDir, "match-chat-mobile.png"), fullPage: true });
    pass("match controls and inline chat fit mobile, tablet and desktop");
    await owner.bringToFront(); await click(owner, "Resign this match"); await click(owner, "Confirm resignation");
    await owner.waitForSelector('[role="dialog"]');
    await partner.bringToFront(); await partner.waitForSelector('[role="dialog"]');
    await text(partner, `${users[1].name} wins!`);
    for (const page of [owner, partner]) {
      assert.equal(await page.$('[data-game-chat]'), null);
      assert.equal(await page.evaluate(value => document.body?.innerText.includes(value), first), false);
    }
    assert.equal(await prisma.gameChatSignal.count({ where: { gameId: game.id } }), 0);
    pass("winner popup appears and temporary messages disappear at match end");
    await click(partner, "Back to match"); await partner.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    await owner.bringToFront();
    await clickTarget(owner, 'xpath=//*[@role="dialog"]//button[normalize-space(.)="Play again"]');
    await text(owner, "Waiting for");
    const finishedCount = await prisma.chatMessage.count({ where: { coupleId: couple.id } });
    await partner.bringToFront(); await text(partner, "One more round?");
    await click(partner, "Accept rematch");
    await partner.waitForFunction(old => location.pathname.startsWith('/games/') && !location.pathname.endsWith(old), {}, game.id);
    const parent = await prisma.gameMatch.findUniqueOrThrow({ where: { id: game.id } });
    await owner.bringToFront(); await owner.waitForFunction(id => location.pathname === `/games/${id}`, {}, parent.rematchGameId);
    assert.equal(await prisma.chatMessage.count({ where: { coupleId: couple.id } }), finishedCount);
    const rematch = await prisma.gameMatch.findUniqueOrThrow({ where: { id: parent.rematchGameId } });
    assert.equal(rematch.status, "ACTIVE"); assert.equal(rematch.playerOneId, users[1].id);
    await owner.waitForSelector('[data-game-chat]');
    assert.equal(await owner.$$eval('[role="log"] p', nodes => nodes.length), 0);
    pass("accepted rematch opens for both players with a fresh chat and no main-chat invitation");
    await owner.screenshot({ path: path.join(artifactDir, "rematch-mobile.png"), fullPage: true });
    if (new URL(baseUrl).hostname === "127.0.0.1") {
      await prisma.adminAccess.create({ data: { userId: users[0].id } });
      await owner.goto(`${baseUrl}/admin`, { waitUntil: "networkidle2" });
      await text(owner, "Storage overview"); await text(owner, "No per-couple storage quota"); await text(owner, "up to 10 MB");
      await owner.screenshot({ path: path.join(artifactDir, "admin-storage-mobile.png"), fullPage: true });
      pass("admin sees aggregate storage and the 10 MB music upload option");
    }
    assert.deepEqual(errors, []); pass("no browser JavaScript errors");
    return { checks };
  } catch (error) {
    for (let index = 0; index < contexts.length; index++) {
      const pages = await contexts[index].pages();
      for (const page of pages) { console.log('FAILURE UI', (await page.evaluate(() => document.body.innerText)).slice(-4000)); await page.screenshot({ path: path.join(artifactDir, `game-failure-${index}.png`), fullPage: true }).catch(() => {}); }
    }
    throw error;
  } finally {
    for (const context of contexts) await context.close();
    await prisma.couple.delete({ where: { id: couple.id } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  }
}
