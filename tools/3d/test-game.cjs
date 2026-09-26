/* Run with a local server and PLAYWRIGHT_PATH pointing to an installed Playwright. */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

(async () => {
 const browser = await chromium.launch({ channel:'chrome', headless:true, args:['--enable-unsafe-swiftshader'] });
 try {
  const page = await browser.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173/#home');
  const start = async () => {
   await page.evaluate(()=>{App.guest=true;Store.state.settings.skin='green3d';render('play',MACHINES[0].id);});
   await page.waitForFunction(()=>window.Play3D?.phase==='aim'&&Play3D.active);
  };
  for(const [width,height] of [[390,844],[320,568],[1440,1000]]) {
   await page.setViewportSize({width,height});await start();await page.waitForTimeout(350);
   assert(await page.evaluate(()=>{
    const g=Play3D,gl=g.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
    const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const colors=new Set();for(let i=0;i<pixels.length;i+=128)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
    return colors.size>50&&g.renderer.info.render.triangles>10000&&g.time<=PLAY_SECONDS&&document.getElementById('drop3d').getBoundingClientRect().bottom<=innerHeight;
   }));
   await page.screenshot({path:path.join(os.tmpdir(),`ally3d-${width}.png`)});
  }
  await page.setViewportSize({width:390,height:844});await start();
  await page.evaluate(()=>{
   window.originalStock=Store.machineStock;
   Store.machineStock=()=>({dolls:Array(12).fill('olly')});
  });
  await start();
  await page.evaluate(()=>{Store.machineStock=window.originalStock;delete window.originalStock;});
  assert(await page.evaluate(()=>Play3D.toys.every(t=>t.id==='olly'&&t.mesh.getObjectByName('OllyReference')?.userData.torso_elongation===1.14)));
  await page.screenshot({path:path.join(os.tmpdir(),'ally3d-approved-olly.png')});
  await page.evaluate(()=>{
   const g=Play3D,toy=g.toys.reduce((a,b)=>a.body.position.y>b.body.position.y?a:b);
   g.position.x=toy.body.position.x;g.position.z=toy.body.position.z;
   window.ollyScaleSamples=[];
   const model=toy.mesh.getObjectByName('OllyReference');
   const timer=setInterval(()=>ollyScaleSamples.push(model.scale.toArray()),30);
   const random=Math.random;Math.random=()=>0;
   g.drop().finally(()=>{Math.random=random;clearInterval(timer);});
  });
  await page.waitForFunction(()=>App.route==='win',null,{timeout:20000});
  assert(await page.evaluate(()=>ollyScaleSamples.length>10&&ollyScaleSamples.every(s=>s.every((v,i)=>v===ollyScaleSamples[0][i]))),'Olly keeps its size through grasp and drop');
  await start();
  const initial=await page.evaluate(()=>[Play3D.position.x,Play3D.position.z]);
  await page.keyboard.down('ArrowLeft');await page.keyboard.down('ArrowUp');await page.waitForTimeout(350);
  await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowUp');await page.waitForTimeout(500);
  const moved=await page.evaluate(()=>[Play3D.position.x,Play3D.position.z]);assert(moved[0]<initial[0]-.05&&moved[1]<initial[1]-.05);
  const stick=await page.locator('#stick3d').boundingBox();await page.mouse.move(stick.x+stick.width-2,stick.y+stick.height/2);
  await page.mouse.down();await page.waitForTimeout(250);await page.mouse.up();
  assert.equal(await page.evaluate(()=>Play3D.input.length()),0);
  await page.getByRole('button',{name:'위',exact:true}).click();
  assert.equal(await page.evaluate(()=>Play3D.viewName),'top');
  for(const mode of ['win','slip','miss']) {
   await start();
   await page.evaluate(mode=>{
    const g=Play3D;
    if(mode==='miss'){g.position.x=-1.02;g.position.z=.66;}
    else {const toy=g.toys.reduce((a,b)=>a.body.position.y>b.body.position.y?a:b);g.position.x=toy.body.position.x;g.position.z=toy.body.position.z;}
    const originalRandom=Math.random;Math.random=()=>mode==='win'?0:.9;
    g.drop().finally(()=>{Math.random=originalRandom;});
   },mode);
   await page.waitForFunction(()=>App.route!=='play',null,{timeout:20000});
   assert.equal(await page.evaluate(()=>App.route),mode==='win'?'win':'lose',mode);
  }
  await start();await page.evaluate(()=>{Play3D.drop();go('home');});await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(()=>App.route),'home');
  assert.equal(await page.evaluate(()=>Play3D.active),false);
  await start();await page.evaluate(()=>{Play3D.time=.02;});
  await page.waitForFunction(()=>App.route==='lose');
  await page.evaluate(()=>{Store.state.settings.skin='classic';render('play',MACHINES[0].id);});
  assert.equal(await page.locator('.screen.classic').count(),1);
  await page.evaluate(()=>{Store.state.settings.skin='arcade';render('play',MACHINES[0].id);});
  assert.equal(await page.locator('.screen.arcade').count(),1);
  assert.equal(await page.locator('.green3d').count(),0);
  assert.equal(await page.evaluate(()=>Play3D.active),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: desktop/mobile pixels, loaded GLB, four-axis movement, pointer release, camera, win/slip/miss, cancellation, timeout, classic mode');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
