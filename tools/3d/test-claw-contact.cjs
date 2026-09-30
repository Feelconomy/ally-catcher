/* 집게가 인형을 '퍼올리는지' 본다.
   전에는 표면에 닿는 순간 손가락을 멈춰서 겉면에 붙어 올라왔다. 지금은
   팁이 인형 중심보다 아래로 내려간 뒤 몸통 안쪽까지 모여야 한다.
   쥘 수 없을 만큼 굵으면 허공에서 끝까지 오므리고 빈손으로 올라와야 한다. */
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4177/#home');

  const start=async()=>{
   await page.evaluate(()=>{Store.state.guest=true;Store.state.tickets=99;Store.state.coachDone=true;
    Store.state.settings.skin='green3d';render('play',MACHINES[0].id);});
   await page.waitForFunction(()=>window.Play3D?.phase==='aim'&&Play3D.active);
  };

  // 1) 감싸되 뚫지 않는다 — 인형 다섯 마리로 잰다
  await start();
  const probe=await page.evaluate(async()=>{
   const THREE=await import('three');
   const {clawContacts}=await import('/js/claw-contact.js');
   const g=Play3D, ray=new THREE.Raycaster(), rows=[];
   for (const t of g.toys.slice().sort((a,b)=>b.body.position.y-a.body.position.y).slice(0,5)) {
    const box=new THREE.Box3().setFromObject(t.mesh,true);
    const size=box.getSize(new THREE.Vector3()), mid=box.getCenter(new THREE.Vector3());
    const o=g.tipAt(.55), down0=Math.max(.34, mid.y-size.y*.12-o.y);
    const pos=g.claw.position.clone(),quat=g.claw.quaternion.clone(),ang=g.fingerAngles.slice();
    g.claw.position.set(t.body.position.x,down0,t.body.position.z);
    g.claw.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),g.yaw);
    const c=clawContacts(g.claw,g.fingers,g.fingerAxes,t.mesh,.55,-.42);
    const down=down0+c.lift;
    g.claw.position.set(t.body.position.x,down,t.body.position.z);
    g.fingers.forEach((f,i)=>f.setRotationFromAxisAngle(g.fingerAxes[i],c.limits[i]));
    g.claw.updateMatrixWorld(true);
    const meshes=[]; t.mesh.traverse(m=>{if(m.isMesh)meshes.push(m);});
    let inside=0,total=0;
    g.fingers.forEach(f=>f.traverse(m=>{
     if(!m.isMesh)return; const p=m.geometry.attributes.position;
     for(let i=0;i<p.count;i+=7){
      const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);
      ray.set(v,new THREE.Vector3(1,0,0));
      total++; if(ray.intersectObjects(meshes,true).length%2===1)inside++;
     }}));
    g.claw.position.copy(pos);g.claw.quaternion.copy(quat);
    g.fingers.forEach((f,i)=>f.setRotationFromAxisAngle(g.fingerAxes[i],ang[i]));
    g.claw.updateMatrixWorld(true);
    rows.push({inside,total,below:(down+o.y)<mid.y,oldDown:Math.max(.30,box.max.y+.095),down});
   }
   return rows;
  });
  for (const r of probe) assert(r.inside/r.total < .05, '손가락이 인형을 뚫지 않는다');
  assert(probe.filter(r=>r.below).length >= 3, '대부분 팁이 인형 중심보다 아래까지 내려간다');
  assert(probe.every(r=>r.down <= r.oldDown), '머리 위에 떠 있던 옛 깊이보다 얕아지지 않는다');

  // 2) 동작: 쥐면 표면에서 멈추고, 못 쥐면 허공에서 끝까지 오므린다
  const run=(mode,huge)=>page.evaluate(async({mode,huge})=>{
   const g=Play3D;let t=null;
   if(mode==='miss'){g.position.x=-1.02;g.position.z=.66;}
   else{t=g.toys.reduce((a,b)=>a.body.position.y>b.body.position.y?a:b);
        g.position.x=t.body.position.x;g.position.z=t.body.position.z;
        if(huge)t.body.shapes.forEach(s=>{s.radius=.45;});}
   const rnd=Math.random;Math.random=()=>mode==='win'?0:.9;
   g.drop().finally(()=>{Math.random=rnd;});
   let held=false,stops=null;
   for(let i=0;i<320;i++){await new Promise(r=>setTimeout(r,80));
    if(g.contactLimits&&!stops)stops=g.contactLimits.slice();
    if(g.held)held=true;if(App.route!=='play')break;}
   return {route:App.route,held,stops};
  },{mode,huge});

  await start();const win=await run('win');
  assert.equal(win.route,'win');assert(win.held,'쥐면 들어 올린다');
  assert(win.stops&&win.stops.some(v=>v>-.41),'표면에 닿은 손가락은 거기서 멈춘다');

  await start();const miss=await run('miss');
  assert.equal(miss.route,'lose');assert(!miss.held);
  assert(!miss.stops,'빗나가면 멈출 표면이 없어 허공에서 끝까지 오므린다');

  await start();const huge=await run('win',true);
  assert.equal(huge.route,'lose');assert(!huge.held,'너무 굵으면 못 쥔다');
  assert(!huge.stops,'못 쥐면 허공에서 끝까지 오므린다');

  assert.deepEqual(errors,[]);
  console.log('PASS: wraps without clipping, reaches below the toy centre, closes on air when it cannot grip');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
