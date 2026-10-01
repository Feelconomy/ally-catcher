const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4177/#home');
  await page.evaluate(()=>{Store.state.guest=true;Store.state.settings.skin='green3d';render('play',MACHINES[0].id);});
  await page.waitForFunction(()=>window.Play3D?.phase==='aim');
  const result=await page.evaluate(async()=>{
   const THREE=await import('/vendor/three.module.js');
   const {clawContacts}=await import('/js/claw-contact.js');
   const g=Play3D;g.time=20;
   const position=g.claw.position.clone(),quaternion=g.claw.quaternion.clone();
   g.claw.position.set(0,1,0);g.claw.quaternion.identity();
   const results=[];
   for(const radius of [.12,.24]){
    const toy=new THREE.Mesh(new THREE.SphereGeometry(radius,32,24),new THREE.MeshBasicMaterial());
    toy.position.set(.035,.70,0);
    const contacts=clawContacts(g.claw,g.fingers,g.fingerAxes,toy,.55,-.42);
    g.claw.position.y=1+contacts.lift;
    g.fingers.forEach((f,i)=>f.setRotationFromAxisAngle(g.fingerAxes[i],contacts.limits[i]));
    g.claw.updateMatrixWorld(true);
    let inside=0;
    const gaps=g.fingers.map(()=>Infinity);
    g.fingers.forEach((f,fi)=>f.traverse(o=>{
     if(!o.isMesh)return;
     for(let i=0;i<o.geometry.attributes.position.count;i++){
      const p=new THREE.Vector3().fromBufferAttribute(o.geometry.attributes.position,i).applyMatrix4(o.matrixWorld);
      if(p.distanceTo(toy.position)<radius-.001)inside++;
     }
     const positions=o.geometry.attributes.position,index=o.geometry.index;
     for(let i=0;i<(index?.count??positions.count);i+=3){
      const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(o.matrixWorld));
      const nearest=new THREE.Triangle(...points).closestPointToPoint(toy.position,new THREE.Vector3());
      gaps[fi]=Math.min(gaps[fi],nearest.distanceTo(toy.position)-radius);
     }
    }));
    results.push({...contacts,radius,inside,gaps});
    g.claw.position.y=1;g.fingers.forEach(f=>f.quaternion.identity());
    toy.geometry.dispose();toy.material.dispose();
   }
   const empty=clawContacts(g.claw,g.fingers,g.fingerAxes,new THREE.Group(),.55,-.42);
   const base=new THREE.Mesh(new THREE.SphereGeometry(.12,32,24),new THREE.MeshBasicMaterial());
   base.position.set(.035,.7,0);
   const alone=clawContacts(g.claw,g.fingers,g.fingerAxes,base,.55,-.42);
   const ear=new THREE.Mesh(new THREE.SphereGeometry(.009,16,12),base.material);
   ear.position.set(.35,.05,.05);base.add(ear);
   const withEar=clawContacts(g.claw,g.fingers,g.fingerAxes,base,.55,-.42);
   if(Math.abs(alone.limits[0]-withEar.limits[0])>1e-5)throw new Error('Off-plane ear stopped a finger that cannot touch it');
   base.geometry.dispose();ear.geometry.dispose();base.material.dispose();
   g.claw.position.copy(position);g.claw.quaternion.copy(quaternion);g.claw.updateMatrixWorld(true);
   window.clawSnapshot=()=>g.fingers.map(f=>{
    const meshes=[];f.traverse(o=>{if(o.isMesh)meshes.push([o.uuid,o.geometry.uuid,o.geometry.attributes.position.array.join(',')]);});
    return {position:f.position.toArray(),scale:f.scale.toArray(),visible:f.visible,meshes};
   });
   window.beforeClaw=clawSnapshot();
   return {results,empty};
  });
  console.log(JSON.stringify(result));
  assert(result.results.every(r=>r.inside===0));
  assert(result.results.every(r=>r.gaps.every((gap,i)=>r.limits[i]===-.42||Math.abs(gap)<.003)),'stopped fingers touch within .003 world units');
  assert(result.results[1].limits.some(v=>v>-.20),'large toy stops closing');
  assert(new Set(result.results[1].limits).size>1,'independent finger stops');
  assert(result.empty.limits.every(v=>v===-.42),'empty claw closes normally');
  await page.evaluate(()=>{
   const g=Play3D,t=g.toys.find(t=>t.id==='pig')||g.toys[0];
   t.body.position.set(0,1.4,0);t.body.quaternion.setFromEuler(.3,1.2,.8);t.body.sleep();
   t.mesh.position.copy(t.body.position);t.mesh.quaternion.copy(t.body.quaternion);
   g.position.x=t.body.position.x;g.position.z=t.body.position.z;
   const random=Math.random;Math.random=()=>0;g.drop().finally(()=>Math.random=random);
  });
  await page.waitForFunction(()=>Play3D.phase==='carrying');
  assert(await page.evaluate(()=>JSON.stringify(beforeClaw)===JSON.stringify(clawSnapshot())),'original GLB geometry, scale, positions and visibility unchanged');
  assert(await page.evaluate(()=>Play3D.fingerAngles.every((v,i)=>v>=Play3D.contactLimits[i]-1e-6)));
  await page.screenshot({path:path.join(os.tmpdir(),'ally-original-claw-contact.png')});
  await page.waitForFunction(()=>App.route!=='play',null,{timeout:30000});
  assert.deepEqual(errors,[]);
  console.log('PASS: original GLB unchanged, independent contact stops, no sphere penetration, empty close, completed round');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
