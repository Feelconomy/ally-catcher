/* 3D 집게가 실제 인형뽑기처럼 움직이는지 본다.
   - 집게는 인형을 모른 채 내려가 바로 밑 인형에 몸통이 얹힐 때까지 내려간다
   - 옆 인형은 집게발이 밀어낸다 (손가락이 인형을 뚫지 않는다)
   - 오므린 뒤 '인형을 살짝 내려 봤을 때 발에 걸리는' 인형만 딸려 올라온다
   - 아무것도 안 걸리면 허공에서 끝까지 오므리고 빈손으로 올라온다 */
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4177/#home');
  const start=()=>page.evaluate(async()=>{
   for (const k of ['savePlayer','saveCatalog','pushAdmin','flush','recordPrize']) if (window.Sync?.[k]) Sync[k]=async()=>{};
   Store.state.guest=true;Store.state.tickets=99;Store.state.coachDone=true;Store.state.settings.skin='green3d';
   delete Store.state.stock[MACHINES[0].id];
   for(const k in (Store.state.layouts||{})) if(k.startsWith(MACHINES[0].id+':')) delete Store.state.layouts[k];
   render('play',MACHINES[0].id);
  }).then(()=>page.waitForFunction(()=>window.Play3D?.phase==='aim'&&Play3D.active));

  // 한 판: 잡힌 순간의 자세를 재고(뚫림 · 받침) 결과 화면까지 간다
  const grab=(mode,pick,offset)=>page.evaluate(async({mode,pick,offset})=>{
   const THREE=await import('three'); const g=Play3D;
   if(mode==='miss'){g.position.x=-1.0;g.position.z=.7;}
   else{const t=g.toys.slice().sort((a,b)=>b.body.position.y-a.body.position.y)[pick];
        g.position.x=t.body.position.x+offset;g.position.z=t.body.position.z;}
   const rnd=Math.random;Math.random=()=>mode==='win'?0:.99;
   let pose=null; const orig=g.caughtToy;
   g.caughtToy=function(nb){ const r=orig.call(this,nb);
    /* 손가락 정점이 근처 인형(원본 메시) 안에 들어갔나. 인형마다 따로, 세 방향 광선이
       모두 '안'이라고 할 때만 센다 — 한 방향 홀짝은 겹친 부품 때문에 부풀려진다. */
    const ray=new THREE.Raycaster(); let inside=0,total=0;
    const all=this.toys.filter(x=>Math.hypot(x.body.position.x-this.clawPos.x,x.body.position.z-this.clawPos.z)<1.1)
      .map(x=>{const ms=[];x.mesh.updateMatrixWorld(true);x.mesh.traverse(o=>{if(o.isMesh)ms.push(o);});return ms;});
    const odd=(v,d,ms)=>{ray.set(v,d);return ray.intersectObjects(ms,false).length%2===1;};
    const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
    this.claw.updateMatrixWorld(true);
    this.fingers.forEach(f=>f.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position;
     for(let i=0;i<p.count;i+=7){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);
      total++;if(all.some(ms=>odd(v,X,ms)&&odd(v,Y,ms)&&odd(v,Z,ms)))inside++;}}));
    pose={caught:r?.id||null,by:this.caughtBy,angles:this.fingerAngles.slice(),pierce:inside/total};
    this.caughtToy=orig; return r; };
   g.drop().finally(()=>{Math.random=rnd;});
   for(let i=0;i<500;i++){await new Promise(r=>setTimeout(r,60));if(App.route!=='play')break;}
   return {route:App.route,kind:App.lastAttempt?.kind,pose};
  },{mode,pick,offset:offset||0});

  // 1) 정조준하면 대부분 받쳐서 들어 올린다 · 뚫지 않는다
  let caught=0;
  for(const pick of [0,1,2,3]){
   await start(); const r=await grab('win',pick);
   assert(r.pose,'잡힘 판정까지 갔다');
   assert(r.pose.pierce<.05,`손가락이 인형을 뚫지 않는다 (${(r.pose.pierce*100).toFixed(0)}%)`);
   if(r.pose.caught){caught++;assert.equal(r.route,'win');}
  }
  // 배치가 판마다 달라 정조준해도 가끔 빈손이다(측정: 정조준 약 78%)
  assert(caught>=2,`정조준하면 대부분 잡힌다 (${caught}/4)`);

  // 2) 잡혔지만 집게 힘이 모자라면 올라가다 놓친다
  await start(); const slip=await grab('slip',0);
  if(slip.pose.caught){assert.equal(slip.route,'lose');assert.equal(slip.kind,'slip');}

  // 3) 아무것도 없는 데로 내리면 허공에서 끝까지 오므리고 빈손
  await start(); const miss=await grab('miss');
  assert.equal(miss.route,'lose');assert.equal(miss.kind,'miss');
  assert(!miss.pose.caught&&miss.pose.angles.every(a=>a<=-.41),'빈손일 땐 끝까지 오므린다');

  assert.deepEqual(errors,[]);
  console.log(`PASS: lands on the toy under the claw, pushes neighbours aside, lifts only what rests on the fingers (${caught}/4 aimed), closes on air otherwise`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
