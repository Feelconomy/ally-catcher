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

  // 1) 기하: 활짝 벌린 팁이 인형 옆을 지나가고, 내려간 자리는 인형 중심보다 아래다
  await start();
  const geom=await page.evaluate(async()=>{
   const THREE=await import('three');const g=Play3D;
   const t=g.toys.reduce((a,b)=>a.body.position.y>b.body.position.y?a:b);
   const box=new THREE.Box3().setFromObject(t.mesh,true);
   const size=box.getSize(new THREE.Vector3()),mid=box.getCenter(new THREE.Vector3());
   const open=g.tipAt(.55);
   const bodyR=t.body.shapes.reduce((m,s)=>Math.max(m,s.radius||0),0);
   const half=Math.min(bodyR,Math.max(size.x,size.z)/2);
   const down=Math.max(.34,mid.y-size.y*.12-open.y);
   const hold=g.angleForTipRadius(Math.max(.05,half-.055));
   return {openR:open.r,bodyR,tipY:down+open.y,centerY:mid.y,floorY:box.min.y,
           holdR:g.tipAt(hold).r,down};
  });
  assert(geom.openR>geom.bodyR+.02,'활짝 벌린 팁이 몸통보다 넓어야 옆을 지나간다');
  assert(geom.tipY<geom.centerY,'팁이 인형 중심보다 아래로 내려가야 퍼올린다');
  assert(geom.holdR<geom.bodyR,'오므린 팁이 몸통 안쪽까지 들어와야 쥔 것처럼 보인다');
  assert(geom.down>=.34,'바닥을 뚫지 않는다');

  // 2) 동작: 획득 · 빗나감 · 못 쥠
  const run=(mode,huge)=>page.evaluate(async({mode,huge})=>{
   const g=Play3D;let t=null;
   if(mode==='miss'){g.position.x=-1.02;g.position.z=.66;}
   else{t=g.toys.reduce((a,b)=>a.body.position.y>b.body.position.y?a:b);
        g.position.x=t.body.position.x;g.position.z=t.body.position.z;
        if(huge)t.body.shapes.forEach(s=>{s.radius=.45;});}
   const rnd=Math.random;Math.random=()=>mode==='win'?0:.9;
   g.drop().finally(()=>{Math.random=rnd;});
   let minGrip=99,held=false;
   for(let i=0;i<320;i++){await new Promise(r=>setTimeout(r,80));
    if(typeof g.gripT==='number')minGrip=Math.min(minGrip,g.gripT);
    if(g.held)held=true;if(App.route!=='play')break;}
   return {route:App.route,minGrip,held};
  },{mode,huge});

  await start();const win=await run('win');
  assert.equal(win.route,'win');assert(win.held,'쥐면 들어 올린다');
  assert(win.minGrip>-.40,'인형을 쥘 때는 허공만큼 끝까지 오므리지 않는다');

  await start();const miss=await run('miss');
  assert.equal(miss.route,'lose');assert(!miss.held);
  assert(miss.minGrip<=-.41,'빗나가면 허공에서 끝까지 오므린다');

  await start();const huge=await run('win',true);
  assert.equal(huge.route,'lose');assert(!huge.held,'너무 굵으면 못 쥔다');
  assert(huge.minGrip<=-.41,'못 쥐면 허공에서 끝까지 오므린다');

  assert.deepEqual(errors,[]);
  console.log('PASS: scoops from below, squeezes inside the body, closes on air when it cannot grip');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
