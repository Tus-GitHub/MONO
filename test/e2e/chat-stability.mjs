import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";

export async function runChatStability({ browser, baseUrl, prisma, runId, artifactDir }) {
  const contexts = [], errors = [], password = randomBytes(20).toString("hex"), passwordHash = await bcrypt.hash(password, 12);
  let checks = 0, failNormal = 0, failGame = 0, normalFailures = 0, gameFailures = 0;
  const pass = label => { checks++; console.log(`PASS chat-stability: ${label}`); };
  const users = await Promise.all(["owner", "partner"].map(role => prisma.user.create({data:{email:`e2e-${runId}-${role}@example.invalid`,name:`${role} ${runId}`,passwordHash,emailVerified:new Date(),profileCompletedAt:new Date()}})));
  const couple = await prisma.couple.create({data:{name:"Reconnect QA",createdById:users[0].id,inviteCode:randomBytes(15).toString("hex"),setupCompletedAt:new Date(),status:"ACTIVE",members:{create:users.map((user,i)=>({userId:user.id,role:i?"PARTNER":"OWNER",status:"ACTIVE"}))}}});
  const button = label => `xpath=//button[normalize-space(.)=${JSON.stringify(label)}]`;
  const click = async (page, selector) => {
    await page.bringToFront(); const handle = await page.locator(selector).waitHandle();
    await handle.evaluate(el=>el.scrollIntoView({block:"center",behavior:"instant"}));
    await page.locator(selector).setEnsureElementIsInTheViewport(false).click(); await handle.dispose();
  };
  const text = (page, value) => page.waitForFunction(value => document.body.innerText.includes(value), {}, value);
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const connected = pages => Promise.all(pages.map(page => page.waitForSelector('[data-game-chat][data-chat-phase="connected"]', {timeout:90000})));
  const setup = async user => {
    const context = await browser.createBrowserContext(); contexts.push(context); const page = await context.newPage(); page.setDefaultTimeout(60000);
    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await page.evaluateOnNewDocument("globalThis.__name = value => value");
    await page.evaluateOnNewDocument(() => {
      window.__qaPeers = []; window.__qaChannels = []; window.__dropPresence = false;
      const Peer = window.RTCPeerConnection;
      const track = channel => {
        window.__qaChannels.push(channel); const send = channel.send.bind(channel);
        channel.send = value => { if(window.__dropPresence && typeof value === "string" && /"type":"join(?:ed)?"/.test(value)) return; send(value); };
        return channel;
      };
      window.RTCPeerConnection = class extends Peer { constructor(...args) { super(...args); window.__qaPeers.push(this); this.addEventListener("datachannel",event=>track(event.channel)); } createDataChannel(...args) { return track(super.createDataChannel(...args)); } };
      if(navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => {
        const ctx = new AudioContext(); await ctx.resume(); const tone=ctx.createOscillator(), gain=ctx.createGain(), output=ctx.createMediaStreamDestination(); gain.gain.value=.02; tone.connect(gain).connect(output); tone.start(); return output.stream;
      };
    });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(baseUrl+"/login",{waitUntil:"domcontentloaded"}); await page.locator('[name="email"]').fill(user.email); await page.locator('[name="password"]').fill(password); await click(page,button("Sign in")); await page.waitForFunction(()=>location.pathname==="/home");
    await page.goto(baseUrl+"/chat",{waitUntil:"domcontentloaded"}); return page;
  };
  const sendGame = async (from,to,value) => { await from.locator('[aria-label="Temporary game message"]').fill(value); await click(from,'[aria-label="Send game message"]'); await text(to,value); await text(from,"Delivered"); };
  try {
    const owner=await setup(users[0]); await click(owner,button("Generate recovery code")); const code=await owner.$eval('p.select-all',el=>el.textContent); await click(owner,'input[type="checkbox"]'); await click(owner,button("Enable encrypted chat")); await owner.waitForSelector('[aria-label="Message your partner"]');
    const partner=await setup(users[1]); await partner.locator('[aria-label="Private recovery code"]').fill(code); await click(partner,button("Unlock on this device")); await partner.waitForSelector('[aria-label="Message your partner"]');
    await owner.setRequestInterception(true); owner.on("request",request=>{
      const route=new URL(request.url()).pathname;
      if(request.method()==="GET" && route==="/api/together" && failNormal>0) { failNormal--; normalFailures++; void request.respond({status:503,contentType:"application/json",body:'{"error":"QA temporary outage"}'}); }
      else if(request.method()==="GET" && route==="/api/together/games/chat" && failGame>0) {failGame--;gameFailures++;void request.respond({status:503,contentType:"application/json",body:'{"error":"QA temporary outage"}'});}
      else void request.continue();
    });
    await owner.evaluate(()=>{window.__syncAlerts=[];new MutationObserver(()=>{const value=[...document.querySelectorAll('[role="alert"]')].map(el=>el.textContent).join(' ');if(value)window.__syncAlerts.push(value);}).observe(document.body,{subtree:true,childList:true,characterData:true});});
    failNormal=2; await owner.bringToFront();
    for(let i=0;normalFailures<2&&i<300;i++) await pause(200); assert.equal(normalFailures,2);
    await pause(2000); assert.deepEqual(await owner.evaluate(()=>window.__syncAlerts),[]);
    await partner.locator('[aria-label="Message your partner"]').fill(`normal-after-retry-${runId}`); await click(partner,'[aria-label="Send message"]'); await owner.bringToFront(); await text(owner,`normal-after-retry-${runId}`);
    pass("normal encrypted chat retries brief HTTP failures without a reconnect alert or lost message");
    failNormal=1000; await owner.bringToFront(); await text(owner,"Updates are delayed. Retrying automatically"); assert.ok(await owner.$('[aria-label="Message your partner"]'));
    failNormal=0; await owner.waitForFunction(()=>!document.body.innerText.includes("Updates are delayed"));
    pass("sustained outages remain visible and clear automatically after recovery");
    await owner.goto(baseUrl+"/games",{waitUntil:"domcontentloaded"}); await click(owner,'[aria-label="Invite to Tic-tac-toe"]'); await text(owner,"Waiting for");
    const game = await prisma.gameMatch.findFirstOrThrow({where:{coupleId:couple.id},orderBy:{createdAt:"desc"}});
    await partner.goto(baseUrl+"/games/"+game.id,{waitUntil:"domcontentloaded"}); await click(partner,button("Accept game")); await owner.bringToFront(); await connected([owner,partner]);
    const peers=await owner.evaluate(()=>window.__qaPeers.length); const history=await prisma.chatMessage.count({where:{coupleId:couple.id}});
    await owner.evaluate(()=>{window.__chatPhases=[];new MutationObserver(()=>window.__chatPhases.push(document.querySelector('[data-game-chat]')?.dataset.chatPhase)).observe(document.querySelector('[data-game-chat]'),{attributes:true,attributeFilter:['data-chat-phase']});});
    failGame=1000; for(let i=0;gameFailures<3&&i<300;i++) await pause(200); assert.ok(gameFailures>=3);
    await sendGame(owner,partner,`during-signaling-outage-${runId}`); await sendGame(partner,owner,`peer-reply-${runId}`);
    assert.equal(await owner.evaluate(()=>window.__qaPeers.length),peers); assert.equal(await owner.$eval('[data-game-chat]',el=>el.dataset.chatPhase),"connected"); assert.deepEqual(await owner.evaluate(()=>window.__chatPhases),[]);
    failGame=0; pass("standalone game chat survives repeated signaling failures with the same peer and delivers both ways");
    await owner.evaluate(()=>{const pc=window.__qaPeers.at(-1);Object.defineProperty(pc,"connectionState",{configurable:true,get:()=>"disconnected"});pc.dispatchEvent(new Event("connectionstatechange"));setTimeout(()=>{delete pc.connectionState;pc.dispatchEvent(new Event("connectionstatechange"));},1200);});
    await pause(9500); assert.equal(await owner.evaluate(()=>window.__qaPeers.length),peers); await connected([owner,partner]);
    pass("a brief disconnected state recovers without rebuilding the peer");
    for(let attempt=0;attempt<2;attempt++) { await owner.reload({waitUntil:"domcontentloaded"}); await owner.bringToFront(); await connected([owner,partner]); await sendGame(owner,partner,`reloaded-${attempt}-${runId}`); }
    pass("reloading a player twice reconnects to the latest session instead of cycling old greetings");
    assert.equal(await prisma.chatMessage.count({where:{coupleId:couple.id}}),history);
    // Move through app links so an active call stays mounted when opening the game.
    await owner.goto(baseUrl+"/chat",{waitUntil:"domcontentloaded"}); await partner.goto(baseUrl+"/chat",{waitUntil:"domcontentloaded"});
    await click(owner,'[aria-label="Voice call"]'); await click(partner,'[aria-label="Pick up"]');
    for(const page of [owner,partner]) { await page.waitForFunction(()=>window.__qaPeers.at(-1)?.connectionState==="connected"); await click(page,'[aria-label="Minimize call"]'); await click(page,'[aria-label="Back to AMOR"]'); await page.waitForFunction(()=>location.pathname==="/home"); await click(page,'a[aria-label="Games"]'); await click(page,`a[href="/games/${game.id}"]`); }
    await connected([owner,partner]);
    for(const page of [owner,partner]) assert.equal(await page.$eval('[data-game-chat]',el=>el.dataset.chatTransport),"call");
    const callPeers=await owner.evaluate(()=>window.__qaPeers.length);
    await partner.evaluate(()=>{window.__dropPresence=true;}); failGame=1000;
    await pause(12000); await sendGame(owner,partner,`call-game-${runId}`); await sendGame(partner,owner,`call-reply-${runId}`);
    assert.equal(await owner.evaluate(()=>window.__qaPeers.length),callPeers); assert.equal(await owner.evaluate(()=>window.__qaPeers.at(-1).connectionState),"connected");
    await partner.evaluate(()=>{window.__dropPresence=false;}); failGame=0;
    pass("in-call game chat tolerates delayed presence and API failures without restarting the call or chat");
    await owner.screenshot({path:path.join(artifactDir,"chat-stability-mobile.png"),fullPage:true});
    assert.deepEqual(errors,[]); pass("no browser JavaScript errors"); return {checks};
  } catch(error) {
    for(const [i,context] of contexts.entries()) for(const page of await context.pages()) { console.log("STABILITY QA",(await page.evaluate(()=>document.body.innerText).catch(()=>"")).slice(-1400)); await page.screenshot({path:path.join(artifactDir,`stability-failure-${i}.png`),timeout:5000}).catch(()=>{}); }
    throw error;
  } finally { await Promise.all(contexts.map(context=>context.close())); await prisma.couple.deleteMany({where:{id:couple.id}}); await prisma.user.deleteMany({where:{id:{in:users.map(user=>user.id)}}}); }
}
