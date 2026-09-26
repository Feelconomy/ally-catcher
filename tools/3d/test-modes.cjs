const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  await page.goto('http://127.0.0.1:4173/');
  for(const width of [320,390,1200]){
   await page.setViewportSize({width,height:850});
   await page.evaluate(()=>{App.guest=true;render('machine',MACHINES[0].id);});
   assert.deepEqual(await page.locator('[data-act="mode"]').allTextContents(),['기본','그린','그린 3D']);
   assert(await page.evaluate(()=>Array.from(document.querySelectorAll('.md-seg button')).every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));
   await page.screenshot({path:path.join(os.tmpdir(),`ally-modes-${width}.png`)});
  }
  for(const [id,selector] of [['classic','.screen.classic'],['arcade','.screen.arcade'],['green3d','.green3d']]){
   await page.evaluate(()=>render('machine',MACHINES[0].id));
   await page.locator(`[data-act="mode"][data-s="${id}"]`).click();
   assert.equal(await page.evaluate(()=>Store.state.settings.skin),id);
   assert.equal(await page.locator('.md-seg [aria-pressed="true"]').count(),1);
   await page.evaluate(()=>render('play',MACHINES[0].id));
   if(id==='green3d')await page.waitForFunction(()=>window.Play3D?.phase==='aim');
   assert.equal(await page.locator(selector).count(),1);
  }
  await page.evaluate(()=>{render('home');Store.state.settings.skin=null;Store.state.admin.skin='green3d';render('play',MACHINES[0].id);});
  await page.waitForFunction(()=>Play3D.phase==='aim');
  await page.evaluate(()=>{render('home');Store.state.admin.skin='arcade';render('play',MACHINES[0].id);});
  assert.equal(await page.locator('.screen.arcade').count(),1);
  assert.equal(await page.evaluate(()=>Play3D.active),false);
  assert.deepEqual(errors,[]);console.log('PASS: three mode buttons, responsive layout, selection, 2D/3D routing, admin fallback and cleanup');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
