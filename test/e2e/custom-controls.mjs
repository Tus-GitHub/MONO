import assert from 'node:assert/strict';

export async function runCustomControls({page, baseUrl, artifactDir}) {
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'light'}]);
  await page.goto(`${baseUrl}/style`,{waitUntil:'networkidle2',timeout:120000});
  await page.waitForSelector('form[aria-label="Custom controls"]');
  const form='form[aria-label="Custom controls"]';
  const first=async selector => (await page.$$(selector))[0];
  const click=async selector => {await page.waitForSelector(selector);const el=await first(selector); assert.ok(el,selector); await el.click();};
  const button=async text => {const el=await page.evaluateHandle(t=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===t && b.getClientRects().length),text); await el.asElement().click();};
  const option=async text=>{await page.waitForSelector('[role="option"]');const el=await page.evaluateHandle(t=>Array.from(document.querySelectorAll('[role="option"]')).find(b=>b.textContent.trim()===t),text);await el.asElement().evaluate(e=>e.scrollIntoView({block:"nearest",behavior:"instant"}));await new Promise(r=>setTimeout(r,250));await el.asElement().click();await page.waitForFunction(()=>!document.querySelector('[role="listbox"]'));};
  await button('Save example');
  await page.waitForSelector(`${form} [role="alert"]`);
  assert.equal(await page.$eval(`${form} output`,e=>e.textContent),'');
  await click('button[role="combobox"][aria-label="Demo category"]');
  assert.equal(await page.$eval('[role="option"][data-disabled]',e=>e.getAttribute('aria-disabled')),'true');
  await option('Café');
  assert.equal(await page.$eval(`${form} select[name="category"]`,e=>e.value),'cafe');
  await click('button[aria-label="Demo date"]');
  await click('button[role="combobox"][aria-label="Year"]'); await option('2027');
  await click('button[role="combobox"][aria-label="Month"]'); await option('February');
  await click('[data-date="2027-02-14"]');
  assert.equal(await page.$eval(`${form} input[name="date"]`,e=>e.value),'2027-02-14');
  await page.waitForFunction(()=>document.querySelector('button[aria-label="Demo date"]').textContent.includes('Feb 14, 2027')); 
  await click('button[aria-label="Demo time"]');
  await click('button[role="combobox"][aria-label="Hour"]'); await option('20');
  await click('button[role="combobox"][aria-label="Minute"]'); await option('30');
  await button('Set time');
  await page.waitForFunction(()=>document.querySelector('button[aria-label="Demo time"]').textContent.includes('20:30')); 
  await button('Save example');
  assert.deepEqual(JSON.parse(await page.$eval(`${form} output`,e=>e.textContent)),{category:'cafe',date:'2027-02-14',time:'20:30'});
  await button('Reset');
  await page.waitForFunction(()=>document.querySelector('input[name="date"]').value==='');
  await page.waitForFunction(()=>document.querySelector('button[aria-label="Demo date"]').textContent.includes('Choose a date'));
  assert.equal(await page.$eval('button[aria-label="Demo time"]',e=>e.textContent.includes('19:00')),true);
  await click('button[role="combobox"][aria-label="Demo category"]');
  await page.waitForSelector('[role="option"]');await page.keyboard.press('a');await new Promise(r=>setTimeout(r,100));await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('select[name="category"]').value==='arcade');
  await click('button[aria-label="Demo date"]');
  await page.waitForSelector('[role="gridcell"][tabindex="0"]');
  const focusedDate=await page.$eval('[role="gridcell"][tabindex="0"]',e=>e.dataset.date);
  await (await first('[role="gridcell"][tabindex="0"]')).focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  const expected=new Date(`${focusedDate}T12:00:00Z`);expected.setUTCDate(expected.getUTCDate()+1);
  assert.equal(await page.$eval('input[name="date"]',e=>e.value),expected.toISOString().slice(0,10));
  for (const width of [320,390,768,1440]) {
    await page.setViewport({width,height:850,isMobile:width<768,hasTouch:width<768,deviceScaleFactor:1});
    await click('button[aria-label="Demo date"]');
    await page.waitForSelector('.mono-date-menu');
    await new Promise(r=>setTimeout(r,250));
    const bounds=await page.$eval('.mono-date-menu',e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,overflow:e.scrollWidth-e.clientWidth};});
    assert.ok(bounds.left>=0&&bounds.right<=bounds.width+1&&bounds.overflow<=1,JSON.stringify({width,...bounds}));
    await page.screenshot({path:`${artifactDir}/calendar-${width}.png`});
    await page.keyboard.press('Escape');await new Promise(r=>setTimeout(r,300));
  }
  await page.setViewport({width:390,height:850,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await click('button[role="combobox"][aria-label="Demo category"]');
  await new Promise(r=>setTimeout(r,250));await page.screenshot({path:`${artifactDir}/select-dark.png`}); await page.keyboard.press('Escape');await new Promise(r=>setTimeout(r,300));
  await button('Open modal');
  await page.waitForSelector('[role="dialog"]');await new Promise(r=>setTimeout(r,300));
  await click('[role="dialog"] button[aria-label="Demo category"]');
  await page.keyboard.press('Escape');await new Promise(r=>setTimeout(r,300));
  assert.ok(await page.$('[role="dialog"]'),'Escape must keep parent dialog open');
  await click('[role="dialog"] button[aria-label="Demo date"]');
  await click('.mono-date-menu button[aria-label="Month"]');await option('March');
  assert.ok(await page.$('.mono-date-menu'),'Nested select must keep calendar open');
  await page.keyboard.press('Escape');await new Promise(r=>setTimeout(r,300));
  assert.ok(await page.$('[role="dialog"]'),'Escape must keep parent dialog open after calendar closes');
  await page.keyboard.press('Escape');await new Promise(r=>setTimeout(r,300));
  await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
  assert.deepEqual(errors,[]);
  return {passed:['required validation','select values','date and time form submission','form reset','keyboard typeahead and calendar navigation','320/390/768/1440 menu bounds','dark theme','nested dialog focus and Escape'],pageErrors:errors};
}


export async function runControlsSuite({browser, baseUrl, artifactDir}) {
  const page=await browser.newPage();
  try { const result=await runCustomControls({page,baseUrl,artifactDir});return {...result,checks:result.passed.length}; }
  finally { await page.close(); }
}
