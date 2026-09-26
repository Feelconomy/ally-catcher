const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1200,height:850});
  await page.goto('http://127.0.0.1:4173/assets/3d/olly-preview.html');
  await page.waitForFunction(()=>window.modelReview);
  assert(await page.evaluate(()=>{
   const names=modelReview.model.children.map(o=>o.name.replaceAll('_',' '));
   return names.filter(n=>n.startsWith('Flush eye white')).length===2
    &&Math.abs(modelReview.model.userData.torso_elongation-1.14)<.001
    &&modelReview.model.children.filter(o=>o.userData.fused_fingers===3&&o.userData.fused_thumb===1).length===2
    &&names.filter(n=>n.startsWith('Continuous soft arm')).length===2
    &&names.filter(n=>n.startsWith('Continuous leg and padded foot')).length===2
    &&!names.some(n=>/Rounded mitten|Inset sole seam|Padded sole/.test(n));
  }),'rounded revision is loaded');
  for(const [width,height] of [[1200,850],[390,844]]){
   await page.setViewportSize({width,height});
   for(const view of ['front','side','angle']){
    await page.locator(`[data-view="${view}"]`).click();await page.waitForTimeout(300);
    assert(await page.evaluate(()=>{
     const r=modelReview.renderer,g=r.getContext(),p=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);
     g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,p);
     const colors=new Set();for(let i=0;i<p.length;i+=128)colors.add(`${p[i]},${p[i+1]},${p[i+2]}`);
     return colors.size>50&&r.info.render.triangles>10000&&document.documentElement.scrollWidth<=innerWidth;
    }));
    await page.screenshot({path:path.join(os.tmpdir(),`olly-review-${width}-${view}.png`)});
   }
  }
  assert.deepEqual(errors,[]);console.log('PASS: GLB geometry, nonblank pixels, front/side/angle, mobile/desktop, no page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
