import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/meshopt_decoder.module.js';

/* 배경 글TF는 EXT_meshopt_compression 으로 줄여 두었다(84MB -> 15MB).
   디코더를 물린 로더를 하나 써서 모든 에셋을 같은 경로로 읽는다. */
const gltfLoader = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
import { OrbitControls } from '../vendor/OrbitControls.js';
import * as CANNON from '../vendor/cannon-es.js';

const CHUTE = { x: -.91, z: .53 };
const GROUP_TOY = 1, GROUP_CLAW = 2;   // 집게가 더미를 밀고 지나가도록 (아래 clawBody)
const REST_Y = 2.72;
const clamp = THREE.MathUtils.clamp;
const ease = t => t * t * (3 - 2 * t);

export const Play3D = {
  session: 0,
  active: false,
  async start(machine) {
    this.stop();
    const session = this.session;
    this.active = true; this.machine = machine; this.phase = 'loading';
    this.time = PLAY_SECONDS; this.input = new THREE.Vector2(); this.velocity = new THREE.Vector2();
    this.position = new THREE.Vector3(.25, REST_Y, 0); this.held = null; this.lastTarget = null;
    /* 집게는 줄에 매달려 있으니 캐리지를 따라 뻣뻣하게 붙어 다니지 않는다.
       캐리지 가속도로 밀린 만큼 뒤로 처졌다가 좌우로 흔들리는 진자를 둔다.
       흔들림은 눈에만 보이고 조준 판정은 캐리지 위치(this.position)로 해서,
       보기엔 흐물흐물해도 겨냥은 예측 가능하게 남긴다. */
    this.swing = new THREE.Vector2(); this.swingVel = new THREE.Vector2(); this.yaw = 0;
    this.clawPos = this.position.clone(); this.prevPos = this.position.clone();
    this.gripT = 0;
    screenEl().innerHTML = `<section class="green3d">
      <div class="green3d-stage" id="stage3d">
        <div class="green3d-top"><button class="iconbtn" id="exit3d" aria-label="나가기">${icon('chevronLeft3',20)}</button><div class="green3d-topright"><span class="green3d-wallet" role="status" aria-label="보유 티켓 ${Store.state.tickets}장">${icon('ticketFill',16)}<span id="walletN3d">${Store.state.tickets}</span></span><span class="green3d-status" id="status3d" role="status">준비 중</span></div></div>
        <div class="green3d-views" aria-label="카메라 시점"><button data-view="front" aria-pressed="false">정면</button><button data-view="angle" aria-pressed="true">입체</button><button data-view="top" aria-pressed="false">위</button></div>
      </div>
      <div class="green3d-deck"><div class="green3d-console">
        <div class="green3d-stick" id="stick3d" role="group" aria-label="집게 이동 조이스틱" tabindex="0"><span class="green3d-knob" id="knob3d"></span></div>
        <div class="green3d-readout"><span class="green3d-label">남은 시간</span><strong class="green3d-clock" id="clock3d">00:20</strong><div class="green3d-meter"><i id="time3d" style="width:100%"></i></div></div>
        <button class="green3d-drop" id="drop3d" disabled aria-label="집게 내리기">${icon('caretDown',24)}<span>드롭</span></button>
      </div><div class="green3d-target"><img id="targetImg3d" alt="" hidden><span id="target3d">준비 중</span><b id="odds3d"></b></div></div>
    </section>`;
    this.root = document.getElementById('stage3d');
    document.getElementById('exit3d').onclick = () => this.exit();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .95;
    this.root.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#a9def4');
    this.scene.fog = new THREE.Fog('#c8e9ed', 24, 70);
    // Bright surroundings keep coated surfaces reflective instead of black.
    const studio = new THREE.Scene(); studio.background = new THREE.Color('#eaf6ff');
    const softbox = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), new THREE.MeshBasicMaterial({color: new THREE.Color(3, 2.8, 2.5), side: THREE.DoubleSide}));
    softbox.position.set(-4, 7, 5); softbox.lookAt(0, 0, 0); studio.add(softbox);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(studio, .12);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = .45;
    pmrem.dispose(); this.disposeObject(studio);
    this.camera = new THREE.PerspectiveCamera(37, 1, .05, 100);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true; this.orbit.enablePan = false;
    this.orbit.minDistance = 4.7; this.orbit.maxDistance = 10;
    this.orbit.minPolarAngle = .3; this.orbit.maxPolarAngle = Math.PI / 2;
    this.orbit.minAzimuthAngle = -.7; this.orbit.maxAzimuthAngle = .7;
    this.scene.add(new THREE.HemisphereLight(0xf4fbff, 0xd4e8bc, 1.5));
    const key = new THREE.DirectionalLight(0xfff3dd, 2.2); key.position.set(-3, 6, 5);
    /* 그림자 범위가 캐비닛보다 훨씬 넓어 그림자맵 한 칸이 굵었고, 그래서 인형·집게
       표면에 자기 그림자가 얼룩덜룩 찍혔다(어두운 때처럼 보이던 것). 범위를 캐비닛에
       맞춰 좁히고 해상도를 올린 뒤, 곡면에 맞는 normalBias 로 남은 얼룩을 지운다. */
    key.castShadow = true; key.shadow.mapSize.set(4096,4096);
    Object.assign(key.shadow.camera, {left:-1.7,right:1.7,top:3.6,bottom:-.3,near:.5,far:12});
    key.shadow.bias = -.0004; key.shadow.normalBias = .035; this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xe5fff3, 1.5); fill.position.set(-3, 2, 1); this.scene.add(fill);
    /* 캐비닛 천장의 Ceiling_lamp 는 발광 재질이라 '켜진 것처럼' 보이기만 하고 빛을
       내지는 않았다. 그래서 집게가 있는 윗부분이 어두웠다. 램프 자리에 실제 광원을
       둔다. */
    for (const x of [-.7, .7]) {
      const lamp = new THREE.PointLight(0xfff0c8, 2, 6, 2);
      lamp.position.set(x, 3.2, 0); this.scene.add(lamp);
    }
    const loaded = await gltfLoader().loadAsync(new URL('../assets/3d/mint-machine.glb', import.meta.url).href);
    if (!this.active || session !== this.session) { this.disposeObject(loaded.scene); return; }
    this.pack = loaded.scene;
    const ollyPack = await gltfLoader().loadAsync(new URL('../assets/3d/olly-reference.glb?v=5', import.meta.url).href);
    if (!this.active || session !== this.session) { this.disposeObject(ollyPack.scene); return; }
    const olly = ollyPack.scene.getObjectByName('OllyReference');
    if (!olly) { this.disposeObject(ollyPack.scene); throw new Error('Missing approved Olly model'); }
    // Fit the approved model to the existing grip/collision origin, without changing it during play.
    const bounds = new THREE.Box3().setFromObject(olly);
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = .64 / bounds.getSize(new THREE.Vector3()).y;
    olly.scale.setScalar(scale);
    olly.position.set(-center.x * scale, -.22 - bounds.min.y * scale, -center.z * scale);
    const approvedOlly = new THREE.Group(); approvedOlly.name = 'ApprovedOlly';
    approvedOlly.add(olly); this.pack.add(approvedOlly);
    this.disposeObject(ollyPack.scene);
    // 호랑이 오리 — 3면도에서 뽑아 천 재질까지 입힌 모델. 올리와 같은 방식으로
    // 집게 원점에 맞춰 넣는다 (재질은 이미 맞춰 놨으니 아래에서 덮어쓰지 않는다).
    const tigerPack = await gltfLoader().loadAsync(new URL('../assets/3d/tiger-plush.glb?v=1', import.meta.url).href);
    if (!this.active || session !== this.session) { this.disposeObject(tigerPack.scene); return; }
    const tiger = tigerPack.scene;
    const tBounds = new THREE.Box3().setFromObject(tiger);
    const tCenter = tBounds.getCenter(new THREE.Vector3());
    const tScale = .64 / tBounds.getSize(new THREE.Vector3()).y;
    tiger.scale.setScalar(tScale);
    tiger.position.set(-tCenter.x * tScale, -.22 - tBounds.min.y * tScale, -tCenter.z * tScale);
    const plushTiger = new THREE.Group(); plushTiger.name = 'PlushTiger';
    plushTiger.add(tiger); this.pack.add(plushTiger);
    // Tripo 로 뽑은 모델은 정면이 -X 라 캐비닛 정면(+Z)과 90도 어긋난다.
    // 여기서 한 번 돌려 두면 아래 무작위 회전이 정면 기준으로 얹힌다.
    plushTiger.rotation.y = -Math.PI / 2;
    // 꽃분이 — 같은 파이프라인으로 뽑은 분홍 돼지
    const pigPack = await gltfLoader().loadAsync(new URL('../assets/3d/pig-plush.glb?v=1', import.meta.url).href);
    if (!this.active || session !== this.session) { this.disposeObject(pigPack.scene); return; }
    const pig = pigPack.scene;
    const pBounds = new THREE.Box3().setFromObject(pig);
    const pCenter = pBounds.getCenter(new THREE.Vector3());
    const pScale = .64 / pBounds.getSize(new THREE.Vector3()).y;
    pig.scale.setScalar(pScale);
    pig.position.set(-pCenter.x * pScale, -.22 - pBounds.min.y * pScale, -pCenter.z * pScale);
    const plushPig = new THREE.Group(); plushPig.name = 'PlushPig';
    plushPig.add(pig); this.pack.add(plushPig);
    plushPig.rotation.y = -Math.PI / 2;
    const names = ['Cabinet','Chute','Gantry','Carriage','Claw','Joystick','DropButton','ToyBear','ToyBunny','ToyDuck','ToyOlly','ToyTiger'];
    this.assets = Object.fromEntries(names.map(name => {
      const object = loaded.scene.getObjectByName(name);
      if (!object) throw new Error('Missing 3D asset: ' + name);
      return [name,object];
    }));
    this.assets.ToyOlly = approvedOlly;
    this.assets.ToyTiger = plushTiger;
    this.assets.ToyPig = plushPig;
    for (const name of names.filter(n => !n.startsWith('Toy'))) this.scene.add(this.assets[name]);
    this.scene.traverse(o => {
      if (!o.isMesh) return;
      const finishes = {'Mint enamel':'#b5edce', 'Pale mint trim':'#fff0b5', 'Mint floor':'#ecf7dc', 'Green joystick':'#69d9b1', 'Blush':'#f6b6c9'};
      if (finishes[o.material.name]) {
        o.material.color.set(finishes[o.material.name]);
        o.material.metalness = .05; o.material.roughness = .27;
      }
      o.castShadow = !o.material.transparent; o.receiveShadow = true;
      if (o.material.name === 'Clear acrylic') {
        o.material.transparent = true; o.material.opacity = .10; o.material.depthWrite = false;
        o.material.side = THREE.DoubleSide; o.castShadow = false;
      }
    });
    const meadowPack = await gltfLoader().loadAsync(new URL('../assets/3d/higgsfield-meadow-detailed.glb', import.meta.url).href);
    if (!this.active || session !== this.session) { this.disposeObject(meadowPack.scene); return; }
    const meadow = meadowPack.scene; meadow.name = 'Meadow';
    const sceneExtras = [];
    const meadowMaterials = new Set();
    meadow.traverse(o => {
      if (o.isLight || o.isCamera) sceneExtras.push(o);
      if (o.isMesh) {
        meadowMaterials.add(o.material);
        o.receiveShadow = o.name.startsWith('Meadow');
        o.castShadow = false;
        if (/Wildflowers|Detailed.flowers|Fine.grass/.test(o.name)) o.material.side = THREE.DoubleSide;
      }
    });
    meadowMaterials.forEach(m => {
      m.envMapIntensity = .2;
      if (/Grass|Meadow|Leaf/.test(m.name)) m.color.multiplyScalar(.65);
      for (const value of Object.values(m)) if (value?.isTexture) value.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    });
    sceneExtras.forEach(o => o.removeFromParent());
    this.scene.add(meadow);
    this.claw = this.assets.Claw;
    this.fingers = [0,1,2].map(i => this.claw.getObjectByName('Finger'+i));
    this.cable = new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,1,10),new THREE.MeshStandardMaterial({color:0x677e73,metalness:.65,roughness:.4}));
    this.scene.add(this.cable);
    this.shadow = new THREE.Mesh(new THREE.RingGeometry(.17,.19,40),new THREE.MeshBasicMaterial({color:0x278f61,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));
    this.shadow.rotation.x = -Math.PI/2; this.scene.add(this.shadow);
    this.buildPhysics(); this.stockToys();
    if (!this.restoredLayout) for (let i=0;i<150;i++) this.world.step(1/60);
    this.saveToyLayout();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.root);
    this.view('angle'); this.resize(); this.bind();
    this.phase = 'aim'; this.status('READY'); document.getElementById('drop3d').disabled = false;
    this.previous = performance.now();
    this.frame = requestAnimationFrame(now => this.update(now));
  },

  buildPhysics() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0,-9.82,0) });
    // 인형끼리 덜 붙고 조금 더 통통 튀게 — 더미가 굳어 보이지 않도록
    this.world.defaultContactMaterial.friction = .42;
    this.world.defaultContactMaterial.restitution = .22;
    this.world.allowSleep = true;
    this.world.solver.iterations = 12;
    const wall = (x,y,z,w,h,d) => {
      const body=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(w/2,h/2,d/2)),position:new CANNON.Vec3(x,y,z)});
      this.world.addBody(body);
    };
    wall(0,-.08,0,2.65,.16,1.95);
    wall(-1.29,1.7,0,.10,3.5,1.95);wall(1.29,1.7,0,.10,3.5,1.95);
    wall(0,1.7,-.95,2.65,3.5,.10);wall(0,1.7,.96,2.65,3.5,.10);
    wall(-.60,.36,.53,.025,.72,.62); wall(-1.22,.36,.53,.025,.72,.62);
    wall(-.91,.36,.23,.64,.72,.025); wall(-.91,.36,.83,.64,.72,.025);

    /* 집게에도 몸통을 붙인다. 내려갈 때 옆 인형을 밀어내 더미가 실제로 흐트러진다.
       물려는 인형만 잠깐 이 충돌에서 빼서(drop 참고) 밀어내지 않고 집을 수 있게 한다. */
    this.clawBody = new CANNON.Body({ mass:0, type:CANNON.Body.KINEMATIC,
      collisionFilterGroup: GROUP_CLAW, collisionFilterMask: GROUP_TOY });
    this.clawBody.addShape(new CANNON.Sphere(.16), new CANNON.Vec3(0,-.12,0));
    this.world.addBody(this.clawBody);
  },

  stockToys() {
    const stock = Store.machineStock(this.machine,12).dolls.slice(0,12);
    const layout = Store.machineLayout(this.machine, 'green3d', stock, () => stock.map(dollId => ({dollId})));
    this.restoredLayout = layout.every(d => d.position);
    this.toys = layout.map((saved,i) => {
      const id = saved.dollId;
      const type = id === 'olly' ? 'ToyOlly' : id === 'tiger' ? 'ToyTiger' : id === 'pig' ? 'ToyPig' : /bunny|rabbit|spring|hanbok|ski|santa/.test(id) ? 'ToyBunny' : /duck|summer|snorkel/.test(id) ? 'ToyDuck' : 'ToyBear';
      const mesh = this.assets[type].clone(true);
      mesh.position.set(0,0,0);
      mesh.traverse(o => {
        if (!o.isMesh) return;
        o.material = o.material.clone(); o.material.metalness = 0;
        // 올리·호랑이는 재질을 이미 맞춰 둔 모델이라 거칠기를 덮어쓰지 않는다
        // (덮어쓰면 눈의 무광 처리까지 날아간다)
        if (type !== 'ToyOlly' && type !== 'ToyTiger' && type !== 'ToyPig') o.material.roughness = .9;
        o.castShadow = true; o.receiveShadow = true;
        if (/cat|penguin/.test(id) && /Honey plush/.test(o.material.name)) o.material.color.set('#a2b8c8');
      });
      const body = new CANNON.Body({ mass: .2, linearDamping:.26, angularDamping:.5, sleepSpeedLimit:.05, sleepTimeLimit:.9,
        collisionFilterGroup: GROUP_TOY, collisionFilterMask: GROUP_TOY | GROUP_CLAW });
      body.addShape(new CANNON.Sphere(.205),new CANNON.Vec3(0,-.015,0));
      body.addShape(new CANNON.Sphere(.17),new CANNON.Vec3(0,.21,0));
      const col=i%4,row=Math.floor(i/4);
      body.position.set(-.86+col*.53,.4+Math.floor(row/2)*.60,-.56+(row%2)*.53);
      if (body.position.x<-.55 && body.position.z>.1) body.position.x=-.28;
      // ±18도로는 전부 같은 방향을 봐서 진열대처럼 보였다. 앞은 보되 제각각이도록
      // 벌린다. 더 벌리거나 자리를 흔들면 서로 밀려 넘어져 얼굴이 안 보인다.
      body.quaternion.setFromEuler(0,(Math.random()-.5)*1.6,0);
      if (saved.position) {
        body.position.set(...saved.position); body.quaternion.set(...saved.quaternion); body.sleep();
      }
      this.world.addBody(body); this.scene.add(mesh);
      return { id,mesh,body };
    });
  },

  bind() {
    this.events = new AbortController(); const signal=this.events.signal;
    const stick=document.getElementById('stick3d'); let pointer=null;
    const keys=new Set();
    this.release = () => { pointer=null; keys.clear(); this.input.set(0,0); this.paintStick(); };
    const track=ev => {
      if (ev.pointerId!==pointer || this.phase!=='aim') return;
      const r=stick.getBoundingClientRect(),max=r.width*.34;
      this.input.set((ev.clientX-r.left-r.width/2)/max,(ev.clientY-r.top-r.height/2)/max);
      if (this.input.length()>1) this.input.normalize();
      if (this.input.length()<.12) this.input.set(0,0);
      this.paintStick();
    };
    stick.addEventListener('pointerdown',ev=>{
      if(this.phase!=='aim'||pointer!==null)return;
      ev.preventDefault();pointer=ev.pointerId;stick.setPointerCapture(pointer);track(ev);haptic(8);
    },{signal});
    stick.addEventListener('pointermove',track,{signal});
    for(const type of ['pointerup','pointercancel','lostpointercapture']) stick.addEventListener(type,ev=>{if(ev.pointerId===pointer)this.release();},{signal});
    const direction = () => {
      this.input.set(Number(keys.has('ArrowRight')||keys.has('d'))-Number(keys.has('ArrowLeft')||keys.has('a')),Number(keys.has('ArrowDown')||keys.has('s'))-Number(keys.has('ArrowUp')||keys.has('w')));
      if(this.input.length()>1)this.input.normalize();this.paintStick();
    };
    window.addEventListener('keydown',ev=>{
      if(this.phase!=='aim'||ev.target.closest('input,textarea,select')||document.querySelector('#overlays .scrim'))return;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d'].includes(ev.key)){ev.preventDefault();keys.add(ev.key);direction();}
      if((ev.key===' '||ev.key==='Enter')&&!ev.repeat&&!ev.target.closest('button')){ev.preventDefault();this.drop();}
    },{signal});
    window.addEventListener('keyup',ev=>{keys.delete(ev.key);direction();},{signal});
    window.addEventListener('blur',this.release,{signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.release();},{signal});
    document.getElementById('drop3d').onclick=()=>this.drop();
    this.root.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=()=>this.view(btn.dataset.view));
    this.renderer.domElement.addEventListener('webglcontextlost',ev=>{
      ev.preventDefault();this.release();this.phase='error';this.status('화면 연결이 끊겼어요');
      document.getElementById('drop3d').disabled=true;
    },{signal});
  },

  paintStick() {
    const knob=document.getElementById('knob3d');
    if(knob)knob.style.transform=`translate(${this.input.x*22}px,${this.input.y*22}px)`;
    const handle=this.assets?.Joystick.getObjectByName('JoystickHandle');
    if(handle){handle.rotation.z=-this.input.x*.30;handle.rotation.x=this.input.y*.30;}
  },

  view(name) {
    this.viewName=name;
    const positions={front:[0,2.15,7.2],angle:[2.3,2.85,7.1],top:[0,6.8,5]};
    this.camera.position.fromArray(positions[name]);
    this.orbit.target.set(0,1.45,0);this.orbit.update();
    this.root.querySelectorAll('[data-view]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.view===name)));
    this.resize();
  },

  resize() {
    if(!this.active || !this.renderer)return;
    const {width,height}=this.root.getBoundingClientRect();if(!width||!height)return;
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;
    this.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.max(2.05,1.8/this.camera.aspect)/7.5));
    this.camera.updateProjectionMatrix();
  },

  nearest() {
    let best=null;
    for(const toy of this.toys){
      const p=toy.body.position;
      const distance=Math.hypot(p.x-this.position.x,p.z-this.position.z);
      if(!best || (distance<.29 && best.distance<.29 ? p.y>best.toy.body.position.y : distance<best.distance))best={toy,distance};
    }
    return best;
  },
  odds(near=this.nearest()) {return near&&near.distance<.32 ? Math.round(Store.odds(this.machine)*(.25+.75*(1-near.distance/.32))) : 0;},
  status(text) {const el=document.getElementById('status3d');if(el)el.textContent=text;},

  update(now) {
    if(!this.active)return;
    const dt=clamp((now-this.previous)/1000,0,.05);this.previous=now;
    if(this.phase==='aim') {
      this.time=Math.max(0,this.time-dt);
      // 레버를 밀면 곧바로 최고 속도가 되지 않고 천천히 실렸다가 천천히 멎는다
      const target=this.input.clone().multiplyScalar(1.18);
      this.velocity.lerp(target,1-Math.exp(-dt*6.5));
      const nx=this.position.x+this.velocity.x*dt, nz=this.position.z+this.velocity.y*dt;
      this.position.x=clamp(nx,-1.02,1.02); this.position.z=clamp(nz,-.66,.67);
      if(nx!==this.position.x)this.velocity.x*=-.3;   // 끝에 닿으면 살짝 되튄다
      if(nz!==this.position.z)this.velocity.y*=-.3;
      if(this.time<=0){App.lastAttempt={dollId:null,accuracy:0,kind:'timeout'};this.finish(false);return;}
      const near=this.nearest();
      const id=near&&near.distance<.32?near.toy.id:null;
      if(id!==this.lastTarget){
        this.lastTarget=id;document.getElementById('target3d').textContent=id?DOLLS[id].name:'조준 대기';
        const img=document.getElementById('targetImg3d');img.hidden=!id;if(id)img.src=dollArt(id);
      }
      document.getElementById('odds3d').textContent=id?this.odds(near)+'%':'';
      document.getElementById('clock3d').textContent=mmss(this.time);
      document.getElementById('clock3d').classList.toggle('warn',this.time<=5);
      document.getElementById('time3d').style.width=(this.time/PLAY_SECONDS*100)+'%';
    }
    if(this.tween){
      this.tween.elapsed+=dt;const t=clamp(this.tween.elapsed/this.tween.duration,0,1);
      this.position.lerpVectors(this.tween.from,this.tween.to,ease(t));
      if(t===1){const done=this.tween.resolve;this.tween=null;done(true);}
    }
    /* 진자: 집게는 줄에 매달려 캐리지에 끌려온다. 움직이는 동안은 속도에 비례해
       뒤로 처지고, 멈추면 스프링이 끌어당겨 두어 번 흔들리다 선다. 캐리지의 실제
       이동량으로 계산하므로 레버 조작뿐 아니라 내리기·옮기기에서도 같이 흔들린다. */
    const carVelX=(this.position.x-this.prevPos.x)/Math.max(dt,1e-4);
    const carVelZ=(this.position.z-this.prevPos.z)/Math.max(dt,1e-4);
    this.prevPos.copy(this.position);
    const K=40, D=6, DRAG=6;                     // 스프링 · 감쇠 · 끌림
    this.swingVel.x+=(-K*this.swing.x-D*this.swingVel.x-clamp(carVelX,-2.5,2.5)*DRAG)*dt;
    this.swingVel.y+=(-K*this.swing.y-D*this.swingVel.y-clamp(carVelZ,-2.5,2.5)*DRAG)*dt;
    this.swing.x=clamp(this.swing.x+this.swingVel.x*dt,-.28,.28);
    this.swing.y=clamp(this.swing.y+this.swingVel.y*dt,-.28,.28);
    /* 집게 돌리기 — 레버를 민 쪽을 향해 집게가 천천히 돌아간다. 멈추면 그 방향을
       그대로 유지한다 (실제 기계에서 집게를 돌려놓는 것처럼). */
    const speed = Math.hypot(carVelX, carVelZ);
    if (speed > .12) {
      let d = Math.atan2(carVelX, carVelZ) - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * (1 - Math.exp(-dt * 4));
    }
    // 매달린 지점(캐리지)에서 줄 길이만큼 기울어진 자리가 집게의 실제 위치
    const pivotY=3.03, hang=Math.max(.2,pivotY-this.position.y);
    this.clawPos.set(
      this.position.x+Math.sin(this.swing.x)*hang,
      pivotY-Math.cos(this.swing.x)*Math.cos(this.swing.y)*hang,
      this.position.z+Math.sin(this.swing.y)*hang);

    if(this.held){
      /* 매달린 인형은 집게와 한 몸이다. 잡힌 순간의 자세와 잡힌 지점을 그대로 두고,
         줄이 흔들리는 회전만 그 위에 얹는다. */
      // 줄 기울기 + 잡은 뒤 집게가 돌아간 만큼. 인형도 집게를 따라 같이 돌아간다.
      const sq=new THREE.Quaternion().setFromEuler(new THREE.Euler(-this.swing.y,0,this.swing.x))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),this.yaw-this.heldYaw));
      const off=this.heldOffset.clone().applyQuaternion(sq);
      const b=this.held.body;
      b.position.set(this.clawPos.x+off.x,this.clawPos.y+off.y,this.clawPos.z+off.z);
      b.velocity.setZero();b.angularVelocity.setZero();
      const q=sq.clone().multiply(this.heldQuat);
      b.quaternion.set(q.x,q.y,q.z,q.w);
    }

    this.clawBody.position.set(this.clawPos.x,this.clawPos.y,this.clawPos.z);
    this.world.step(1/60,dt,3);
    for(const toy of this.toys){toy.mesh.position.copy(toy.body.position);toy.mesh.quaternion.copy(toy.body.quaternion);}
    this.claw.position.copy(this.clawPos);
    // 줄이 기운 방향으로 눕히고, 그 위에 돌아간 각도를 얹는다
    const tilt=new THREE.Quaternion().setFromEuler(new THREE.Euler(-this.swing.y,0,this.swing.x));
    const spin=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),this.yaw);
    this.claw.quaternion.copy(tilt.clone().multiply(spin));
    this.assets.Carriage.position.set(this.position.x,3.06,this.position.z);
    this.assets.Gantry.position.z=this.position.z;
    // 줄은 캐리지와 집게를 잇는다 — 흔들리면 같이 비스듬해진다
    const top=new THREE.Vector3(this.position.x,pivotY,this.position.z);
    const bottom=this.clawPos.clone().addScaledVector(new THREE.Vector3(Math.sin(this.swing.x),-Math.cos(this.swing.x),Math.sin(this.swing.y)).normalize(),-.12);
    const span=new THREE.Vector3().subVectors(bottom,top);
    this.cable.scale.y=Math.max(.08,span.length());
    this.cable.position.copy(top).addScaledVector(span,.5);
    this.cable.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),span.clone().normalize());
    this.shadow.position.set(this.clawPos.x,.015,this.clawPos.z);this.shadow.visible=this.phase==='aim';
    this.orbit.update();this.renderer.render(this.scene,this.camera);
    this.frame=requestAnimationFrame(t=>this.update(t));
  },

  travel(to,duration) {
    return new Promise(resolve=>{this.tween={from:this.position.clone(),to:new THREE.Vector3(...to),elapsed:0,duration,resolve};});
  },
  pause(ms) {
    return new Promise(resolve=>{this.delayResolve=resolve;this.delay=setTimeout(()=>{this.delayResolve=null;resolve(this.active);},ms);});
  },
  /** 손가락 오므리기 — 탁 닫히지 않고 0.22초에 걸쳐 스르르 오므린다. */
  grip(closed) {
    clearInterval(this.gripTimer);
    const to=closed?.63:1, from=this.gripT||(closed?1:.63);
    const t0=performance.now();
    this.gripTimer=setInterval(()=>{
      const t=clamp((performance.now()-t0)/220,0,1), v=from+(to-from)*ease(t);
      this.gripT=v;
      for(const finger of this.fingers)finger.scale.set(v,1,v);
      if(t===1)clearInterval(this.gripTimer);
    },16);
  },
  releaseToy() {
    if(!this.held)return;
    this.held.body.type=CANNON.Body.DYNAMIC;this.held.body.mass=.22;this.held.body.updateMassProperties();
    this.held.body.collisionResponse=true;this.held.body.collisionFilterMask=GROUP_TOY|GROUP_CLAW;
    this.held.body.wakeUp();this.held.body.velocity.set(0,-.15,0);
    this.held=null;this.grip(false);
  },

  async drop() {
    if(this.phase!=='aim')return;
    const session=this.session;const alive=()=>this.active&&this.session===session;
    const near=this.nearest(),chance=this.odds(near);
    this.phase='dropping';this.release();this.velocity.set(0,0);
    document.getElementById('drop3d').disabled=true;this.status('DROPPING');haptic(20);
    const target=near&&near.distance<.29?near.toy:null;
    // 물려는 인형만 집게 몸통을 통과시킨다 — 안 그러면 집기 전에 밀려난다
    if(target)target.body.collisionFilterMask=GROUP_TOY;
    const won=!!target&&Math.random()*100<chance;
    const slipped=!!target&&!won&&Math.random()>.3;
    App.lastAttempt={dollId:target?.id||null,accuracy:near?Math.round(Math.max(0,1-near.distance/.32)*100):0,kind:'miss'};
    const down=target?target.body.position.y+.42:.52;
    await this.travel([this.position.x,down,this.position.z],1.05);if(!alive())return;
    this.grip(true);await this.pause(280);if(!alive())return;
    if(target&&(won||slipped)){
      this.held=target;target.body.type=CANNON.Body.KINEMATIC;target.body.mass=0;target.body.updateMassProperties();
      target.body.collisionResponse=false;target.body.wakeUp();
      /* 인형을 똑바로 세우지 않는다. 누워 있으면 누운 채로, 집게가 닿은 그 지점을
         잡고 들어 올린다 — 배를 물었는데 머리를 문 것처럼 보이지 않도록. */
      const q=target.body.quaternion, p=target.body.position;
      this.heldQuat=new THREE.Quaternion(q.x,q.y,q.z,q.w); this.heldYaw=this.yaw;
      this.heldOffset=new THREE.Vector3(
        clamp(p.x-this.clawPos.x,-.13,.13), p.y-this.clawPos.y, clamp(p.z-this.clawPos.z,-.13,.13));
    }
    this.phase='lifting';this.status('LIFTING');
    await this.travel([this.position.x,REST_Y,this.position.z],1.2);if(!alive())return;
    if(!this.held){
      if(target)target.body.collisionFilterMask=GROUP_TOY|GROUP_CLAW;
      this.grip(false);await this.pause(350);if(alive())this.finish(false,target?.id);return;}
    if(slipped){
      this.releaseToy();App.lastAttempt.kind='slip';this.status('DROPPED');haptic(25);
      await this.pause(1050);if(alive())this.finish(false,target.id);return;
    }
    this.phase='carrying';this.status('CARRYING');
    await this.travel([CHUTE.x,REST_Y,CHUTE.z],1.25);if(!alive())return;
    this.phase='releasing';this.status('PRIZE OUT');this.releaseToy();haptic(35);
    await this.pause(1400);if(!alive())return;
    const p=target.body.position;
    this.finish(Math.abs(p.x-CHUTE.x)<.32&&Math.abs(p.z-CHUTE.z)<.32&&p.y<.75,target.id,target);
  },

  finish(won,id=null,toy=null) {
    if(!this.active)return;
    this.wonToy = won ? toy : null;
    const machine=this.machine;this.stop();
    App.levelUpTo=Store.recordPlay(machine,won,won?id:null);
    go(won?'win':'lose',id||'');
  },
  exit() {
    this.release?.();
    dialog(`<h3>인형뽑기를 나갈까요?</h3><p>이번 판에 사용한 티켓은 돌려받을 수 없어요.</p><div class="actions"><button class="btn btn--primary" data-close>계속 플레이</button><button class="btn btn--neutral" data-act="leave">나가기</button></div>`,(node,close)=>bind(node,{leave:()=>{close();this.stop();go('home');}}));
  },
  disposeObject(root) {
    const geometries=new Set(),materials=new Set(),textures=new Set();
    root?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
    materials.forEach(m=>{for(const value of Object.values(m))if(value?.isTexture)textures.add(value);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  },
  saveToyLayout() {
    if (this.toys) {
      const prior = Store.state.layouts?.[this.machine.id + ':green3d'] || [];
      Store.saveLayout(this.machine, 'green3d', this.toys.filter(t => t !== this.wonToy).map(t => {
        const i = this.toys.indexOf(t);
        if (t === this.held && prior[i]) return prior[i];
        return {dollId:t.id,position:[t.body.position.x,t.body.position.y,t.body.position.z],quaternion:[t.body.quaternion.x,t.body.quaternion.y,t.body.quaternion.z,t.body.quaternion.w]};
      }));
    }
  },
  stop() {
    if (this.active && this.phase !== 'loading') this.saveToyLayout();
    this.toys=null;this.wonToy=null;
    this.active=false;this.session++;
    cancelAnimationFrame(this.frame);clearTimeout(this.delay);clearInterval(this.gripTimer);
    this.delayResolve?.(false);this.delayResolve=null;
    this.tween?.resolve(false);this.tween=null;
    this.events?.abort();this.resizeObserver?.disconnect();this.orbit?.dispose();
    this.disposeObject(this.scene);this.disposeObject(this.pack);
    this.environment?.dispose();this.environment=null;
    this.renderer?.dispose();this.renderer?.forceContextLoss();
    this.scene=null;this.pack=null;this.renderer=null;this.assets=null;this.held=null;
  }
};
