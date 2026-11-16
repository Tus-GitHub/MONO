import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";

export async function runNetworkHandoff({ browser, baseUrl, prisma, runId, artifactDir }) {
  const contexts = [], errors = [], password = randomBytes(20).toString("hex"), passwordHash = await bcrypt.hash(password, 12);
  let checks = 0;
  const sessions=[];
  const pass = label => { checks++; console.log(`PASS network-handoff: ${label}`); };
  const users = await Promise.all(["owner", "partner"].map(role => prisma.user.create({data:{email:`e2e-${runId}-${role}@example.invalid`,name:`${role} ${runId}`,passwordHash,emailVerified:new Date(),profileCompletedAt:new Date()}})));
  const couple = await prisma.couple.create({data:{name:"Network QA",createdById:users[0].id,inviteCode:randomBytes(15).toString("hex"),setupCompletedAt:new Date(),status:"ACTIVE",members:{create:users.map((user,i)=>({userId:user.id,role:i?"PARTNER":"OWNER",status:"ACTIVE"}))}}});
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
    const control = async page => { const session=await page.createCDPSession(); sessions.push(session); await session.send("Network.enable"); return session; };
    const a=await control(owner), b=await control(partner);
    const conditions=async (session, mode) => {
      const offline=mode==="offline", slow=mode==="slow", mobile=mode==="mobile";
      const latency=slow?400:mobile?150:0, downloadThroughput=slow?64000:mobile?128000:-1, uploadThroughput=slow?16000:mobile?32000:-1;
      await session.send("Network.emulateNetworkConditionsByRule",{offline,matchedNetworkConditions:[{urlPattern:"",latency,downloadThroughput,uploadThroughput,packetLoss:offline?100:slow?5:0,packetQueueLength:offline?1:0}]});
      await session.send("Network.overrideNetworkState",{offline,latency,downloadThroughput,uploadThroughput,connectionType:offline?"none":mobile||slow?"cellular3g":"wifi"});
    };
    const sendNormal=async(from,to,value)=>{await from.locator('[aria-label="Message your partner"]').fill(value);await click(from,'[aria-label="Send message"]');await to.bringToFront();await text(to,value);};
    await conditions(a,"slow");await conditions(b,"slow");
    await sendNormal(owner,partner,`slow-owner-${runId}`);await sendNormal(partner,owner,`slow-partner-${runId}`);
    pass("encrypted text delivers both ways at 400 ms latency, 512 kbps down and 128 kbps up");
    const stored=await prisma.chatMessage.count({where:{coupleId:couple.id}});
    await conditions(a,"offline");await owner.locator('[aria-label="Message your partner"]').fill(`retained-${runId}`);await click(owner,'[aria-label="Send message"]');
    await owner.waitForFunction(value=>document.querySelector('[aria-label="Message your partner"]').value===value,{},`retained-${runId}`);
    await partner.locator('[aria-label="Message your partner"]').fill(`catch-up-${runId}`);await click(partner,'[aria-label="Send message"]');await pause(6000);
    await conditions(a,"mobile");await owner.bringToFront();await text(owner,`catch-up-${runId}`);await click(owner,'[aria-label="Send message"]');await text(partner,`retained-${runId}`);
    assert.equal(await prisma.chatMessage.count({where:{coupleId:couple.id}}),stored+2);
    pass("normal chat catches up after offline-to-mobile restoration and retains an unsent draft for one nonduplicating retry");
    await conditions(a,"wifi");await conditions(b,"wifi");
    await owner.goto(baseUrl+"/games",{waitUntil:"domcontentloaded"}); await click(owner,'[aria-label="Invite to Tic-tac-toe"]'); await text(owner,"Waiting for");
    const game = await prisma.gameMatch.findFirstOrThrow({where:{coupleId:couple.id},orderBy:{createdAt:"desc"}});
    await partner.goto(baseUrl+"/games/"+game.id,{waitUntil:"domcontentloaded"}); await click(partner,button("Accept game")); await owner.bringToFront(); await connected([owner,partner]);
    const history=await prisma.chatMessage.count({where:{coupleId:couple.id}});
    await conditions(a,"slow");await conditions(b,"slow");await sendGame(owner,partner,`slow-game-${runId}`);await sendGame(partner,owner,`slow-game-reply-${runId}`);
    await conditions(a,"offline");
    await owner.locator('[aria-label="Temporary game message"]').fill(`queued-game-${runId}`);await click(owner,'[aria-label="Send game message"]');
    await pause(20000);await conditions(a,"mobile");await conditions(b,"mobile");await owner.bringToFront();await connected([owner,partner]);await text(partner,`queued-game-${runId}`);await text(owner,"Delivered");
    assert.equal(await partner.$$eval('[role="log"] p', (nodes,value)=>nodes.filter(el=>el.textContent===value).length,`queued-game-${runId}`),1);
    assert.equal(await prisma.chatMessage.count({where:{coupleId:couple.id}}),history);
    pass("standalone game chat recovers a 20-second loss and delivers its pending message exactly once without database storage");
    await conditions(a,"wifi");await conditions(b,"wifi");
    // Move through app links so an active call stays mounted when opening the game.
    await owner.goto(baseUrl+"/chat",{waitUntil:"domcontentloaded"}); await partner.goto(baseUrl+"/chat",{waitUntil:"domcontentloaded"});
    await click(owner,'[aria-label="Voice call"]'); await click(partner,'[aria-label="Pick up"]');
    for(const page of [owner,partner]) { await page.waitForFunction(()=>window.__qaPeers.at(-1)?.connectionState==="connected"); await click(page,'[aria-label="Minimize call"]'); await click(page,'[aria-label="Back to MONO"]'); await page.waitForFunction(()=>location.pathname==="/home"); await click(page,'a[aria-label="Games"]'); await click(page,`a[href="/games/${game.id}"]`); }
    await connected([owner,partner]);
    for(const page of [owner,partner]) assert.equal(await page.$eval('[data-game-chat]',el=>el.dataset.chatTransport),"call");
    const call=await prisma.coupleCall.findFirstOrThrow({where:{coupleId:couple.id},orderBy:{createdAt:"desc"}});
    const sample=page=>page.evaluate(async()=>{const pc=window.__qaPeers.at(-1),stats=[...(await pc.getStats()).values()];return {count:window.__qaPeers.length,state:pc.connectionState,ufrag:pc.localDescription?.sdp.match(/a=ice-ufrag:([^\r\n]+)/)?.[1],mic:pc.getSenders().find(s=>s.track?.kind==="audio")?.track.id,packets:stats.filter(s=>s.type==="inbound-rtp"&&s.kind==="audio").reduce((a,s)=>a+(s.packetsReceived??0),0),energy:stats.filter(s=>s.type==="inbound-rtp"&&s.kind==="audio").reduce((a,s)=>a+(s.totalAudioEnergy??0),0)};});
    const initial=[await sample(owner),await sample(partner)];
    for(const [index,changed,remote,network] of [[0,owner,partner,a],[1,partner,owner,b]]) {
      const before=await sample(owner);
      await conditions(network,"offline");
      await changed.locator('[aria-label="Temporary game message"]').fill(`in-call-queued-${index}-${runId}`);await click(changed,'[aria-label="Send game message"]');
      await pause(4000);const stalled=await sample(remote);await pause(3000);const held=await sample(remote);
      assert.ok(held.packets-stalled.packets<5,`WebRTC loss not applied: ${held.packets-stalled.packets} received packets`);
      await pause(13000);await conditions(network,"mobile");await changed.bringToFront();
      await owner.waitForFunction(old=>{const pc=window.__qaPeers.at(-1);return pc.connectionState==="connected"&&pc.signalingState==="stable"&&pc.localDescription?.sdp.match(/a=ice-ufrag:([^\r\n]+)/)?.[1]!==old;},{timeout:80000},before.ufrag);
      await connected([owner,partner]);await text(remote,`in-call-queued-${index}-${runId}`);await text(changed,"Delivered");
      for(const [i,page] of [owner,partner].entries()) {
        const previous=await sample(page);await page.waitForFunction(async energy=>{const pc=window.__qaPeers.at(-1);return [...(await pc.getStats()).values()].some(s=>s.type==="inbound-rtp"&&s.kind==="audio"&&s.totalAudioEnergy>energy);},{timeout:20000},previous.energy);
        const after=await sample(page);assert.equal(after.count,initial[i].count);assert.equal(after.mic,initial[i].mic);assert.equal(after.state,"connected");
        assert.equal(await page.evaluate(()=>window.__qaPeers.at(-1).getSenders().filter(s=>s.track?.kind==="audio").every(s=>s.track.enabled&&s.track.readyState==="live")),true);
      }
      assert.equal((await prisma.coupleCall.findUniqueOrThrow({where:{id:call.id}})).status,"ACCEPTED");assert.equal(await prisma.coupleCall.count({where:{coupleId:couple.id}}),1);
      pass(`${index?"receiver":"caller"} network restoration renegotiates ICE on the same call, resumes two-way audio and delivers queued game text`);
      await conditions(network,"wifi");await pause(11000);
    }
    await owner.screenshot({path:path.join(artifactDir,"network-handoff-mobile.png"),fullPage:true});
    assert.deepEqual(errors,[]); pass("no browser JavaScript errors"); return {checks};
  } catch(error) {
    for(const [i,context] of contexts.entries()) for(const page of await context.pages()) { console.log("NETWORK QA",(await page.evaluate(()=>document.body.innerText).catch(()=>"")).slice(-1400)); await page.screenshot({path:path.join(artifactDir,`network-failure-${i}.png`),timeout:5000}).catch(()=>{}); }
    throw error;
  } finally { await Promise.all(sessions.map(session=>session.detach().catch(()=>{}))); await Promise.all(contexts.map(context=>context.close())); await prisma.couple.deleteMany({where:{id:couple.id}}); await prisma.user.deleteMany({where:{id:{in:users.map(user=>user.id)}}}); }
}
