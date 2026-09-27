const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  await page.goto('http://127.0.0.1:4176/#home');
  for(const mode of ['classic','arcade','green3d']) {
   await page.evaluate(mode=>{App.guest=true;Store.state.coachDone=true;Store.state.settings.skin=mode;render('play',MACHINES[0].id);},mode);
   if(mode==='green3d') {
    await page.waitForFunction(()=>window.Play3D?.active&&Play3D.phase==='aim');
    await page.evaluate(()=>{
     const g=Play3D,t=g.toys.reduce((a,b)=>a.body.position.y>b.body.position.y?a:b);
     g.position.x=t.body.position.x;g.position.z=t.body.position.z;
     const random=Math.random;Math.random=()=>0;g.drop().finally(()=>Math.random=random);
    });
    await page.waitForFunction(()=>Play3D.phase==='dropping'&&Play3D.gripT<-.22);
    assert(await page.evaluate(()=>Play3D.fingerSpread.every(n=>n>=.08)&&Play3D.fingers.every(f=>f.scale.y>=1.25)));
   } else {
    await page.evaluate(()=>{
     Play.x=Play.dolls[0].x;
     const random=Math.random;Math.random=()=>0;Play.drop().finally(()=>Math.random=random);
    });
    await page.waitForFunction(()=>document.querySelector('#rig[data-grip]'));
    assert(await page.evaluate(()=>getComputedStyle(document.querySelector('#claw .t-back')).visibility==='hidden'&&getComputedStyle(document.querySelector('#rearClaw .t-back')).visibility==='visible'));
    if(mode==='arcade')assert(await page.evaluate(()=>Math.abs(document.getElementById('chute').clientWidth/document.getElementById('cabinet').clientWidth-.30)<.01));
   }
   await page.screenshot({path:path.join(os.tmpdir(),`ally-grasp-${mode}.png`)});
   await page.waitForFunction(()=>App.route!=='play',null,{timeout:30000});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: deeper 2D grips, wider glass chute, fitted 3D fingers, completed rounds');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
