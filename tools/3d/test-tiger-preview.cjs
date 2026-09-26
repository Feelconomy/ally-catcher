const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/assets/3d/tiger-preview.html');
  await page.waitForFunction(()=>window.modelReview);
  assert(await page.evaluate(()=>modelReview.model.name==='TigerDuckReference'&&modelReview.model.userData.reference_views==='front,side,back'));
  for(const [width,height] of [[1200,850],[390,844]]){
   await page.setViewportSize({width,height});
   for(const view of ['front','side','back','angle']){
    await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(400);
    assert(await page.evaluate(()=>{
     const r=modelReview.renderer,g=r.getContext(),p=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);
     g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,p);
     const colors=new Set();for(let i=0;i<p.length;i+=128)colors.add(`${p[i]},${p[i+1]},${p[i+2]}`);
     return colors.size>50&&r.info.render.triangles>10000&&document.documentElement.scrollWidth<=innerWidth&&document.getElementById('reference').naturalWidth>0;
    }));
    assert((await page.locator('#reference').getAttribute('src')).includes(view==='angle'?'front':view));
    await page.screenshot({path:path.join(os.tmpdir(),`tiger-review-${width}-${view}.png`)});
   }
  }
  assert.deepEqual(errors,[]);console.log('PASS: tiger model, four views, matched reference images, mobile/desktop canvas pixels, no page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
