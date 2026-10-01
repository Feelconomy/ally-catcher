import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/meshopt_decoder.module.js';
import { clawContacts } from './claw-contact.js?v=191';

/* 배경 글TF는 EXT_meshopt_compression 으로 줄여 두었다(84MB -> 15MB).
   디코더를 물린 로더를 하나 써서 모든 에셋을 같은 경로로 읽는다. */
const gltfLoader = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// Two full layers, leaving the front-left prize chute unobstructed.
const TOY_SLOTS = [];
for (const y of [.23, .81]) {
  for (const z of [-.61, -.12, .37]) {
    for (const x of [-.98, -.49, 0, .49, .98]) {
      if (z > .2 && x < -.35) continue;
      TOY_SLOTS.push([x, y, z]);
    }
  }
}
const TOY_COUNT = TOY_SLOTS.length;
const LAYOUT_VERSION = 3;
const toyType = id => toyShape(id);   // data.js — 관리자가 고른 모양을 먼저 본다

// Keep parsed source assets for repeat visits; instances get their own materials.
const modelCache = new Map();
async function loadModel(file) {
  if (!modelCache.has(file)) {
    const url = new URL('../assets/3d/' + file, import.meta.url).href;
    /* 모바일에서 한 번 끊긴 요청 하나 때문에 인형통 전체가 안 열리는 일이 있었다.
       끊김은 대개 일시적이라 잠깐 쉬고 한 번은 다시 받아 본다. */
    modelCache.set(file, gltfLoader().loadAsync(url)
      .catch(() => new Promise(r => setTimeout(r, 500)).then(() => gltfLoader().loadAsync(url)))
      .catch(error => { modelCache.delete(file); throw error; }));
  }
  const source = await modelCache.get(file);
  const scene = source.scene.clone(true);
  scene.traverse(o => {
    if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
  });
  return {scene};
}
import { OrbitControls } from '../vendor/OrbitControls.js';
import * as CANNON from '../vendor/cannon-es.js';

const CHUTE = { x: -.91, z: .53 };
const GROUP_TOY = 1, GROUP_CLAW = 2;   // 집게가 더미를 밀고 지나가도록 (아래 clawBody)
const REST_Y = 2.72;
/* 집게 손가락 힌지 각도(라디안). 손가락 그룹을 통째로 굵게 키우면 벌레가 부푸는
   것처럼 보여서, 집게 중심의 피벗에서 실제로 여닫도록 바꿨다.
   실측: +0.55 = 팁 반경 0.36(활짝) · 0 = 0.18(기본) · -0.12 = 0.13(움켜쥠) · -0.42 = 0.01(맞닿음) */
const GRIP_REST = 0, GRIP_OPEN = .55, GRIP_SHUT = -.42;
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
        <div class="green3d-top"><button class="iconbtn" id="exit3d" aria-label="나가기">${icon('chevronLeft3',20)}</button><span class="green3d-wallet" role="status" aria-label="보유 티켓 ${Store.state.tickets}장">${icon('ticketFill',16)}<span id="walletN3d">${Store.state.tickets}</span></span></div>
        <div class="green3d-views" aria-label="카메라 시점"><button data-view="front" aria-pressed="false">정면</button><button data-view="angle" aria-pressed="true">입체</button><button data-view="top" aria-pressed="false">위</button></div>
      </div>
      <div class="green3d-deck"><div class="green3d-console">
        <div class="green3d-stick" id="stick3d" role="group" aria-label="집게 이동 조이스틱" tabindex="0"><span class="green3d-knob" id="knob3d"></span></div>
        <div class="green3d-readout"><span class="green3d-label">남은 시간</span><strong class="green3d-clock" id="clock3d">00:20</strong><div class="green3d-meter"><i id="time3d" style="width:100%"></i></div></div>
        <button class="green3d-drop" id="drop3d" disabled aria-label="집게 내리기">${icon('caretDown',24)}<span>드롭</span></button>
      </div><div class="green3d-target"><img id="targetImg3d" alt="" hidden><span id="target3d">준비 중</span><b id="odds3d"></b><button class="green3d-reset" id="reset3d" type="button">재배치</button></div></div>
      ${green3DLoading()}
    </section>`;
    this.root = document.getElementById('stage3d');
    document.getElementById('exit3d').onclick = () => this.exit();
    document.getElementById('reset3d').onclick = () => this.rearrange();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    /* 픽셀비율을 그대로 쓰면 dpr 3 인 폰에서 채우는 픽셀이 9배가 된다. 2 로 막으면
       또렷함은 거의 그대로면서 부담이 확 준다 (측정: dpr2 70fps -> dpr1 109fps). */
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
    const specs = [
      ['ToyOlly', 'olly-plush.glb?v=3', null, -Math.PI / 2],
      ['ToyTiger', 'tiger-plush.glb?v=3', null, -Math.PI / 2],
      ['ToyPig', 'pig-plush.glb?v=3', null, -Math.PI / 2],
      ['ToyRabbit', 'rabbit-plush.glb?v=3', null, -Math.PI / 2],
      ['ToyDali', 'dali-plush.glb?v=3', null, -Math.PI / 2],
      ['ToyBearPig', 'bearpig-plush.glb?v=1', null, -Math.PI / 2],
      ['ToyHanbokPig', 'hanbokpig-plush.glb?v=1', null, -Math.PI / 2],
      ['ToyHanbokOlly', 'hanbokolly-plush.glb?v=1', null, -Math.PI / 2],
      ['ToyHanbokDali', 'hanbokdali-plush.glb?v=1', null, -Math.PI / 2],
      ['ToyAcorn', 'acorn-plush.glb?v=1', null, -Math.PI / 2],
      ['ToyAutumn', 'autumn-plush.glb?v=1', null, -Math.PI / 2],
      ['ToySummerWoni', 'summerwoni-plush.glb?v=1', null, -Math.PI / 2],
      ['ToyKori', 'kori-plush.glb?v=1', null, -Math.PI / 2],
      ['ToySki', 'ski-plush.glb?v=1', null, -Math.PI / 2],
      ['ToySanta', 'santa-plush.glb?v=1', null, -Math.PI / 2],
      ['ToySnorkel', 'snorkel-plush.glb?v=1', null, -Math.PI / 2],
      ['ToySummer', 'summer-plush.glb?v=1', null, -Math.PI / 2],
      ['ToyFrogDali', 'frogdali-plush.glb?v=1', null, -Math.PI / 2],
      ['ToyWoni', 'woni-plush.glb?v=1', null, -Math.PI / 2],
      ['ToyHanbokKori', 'hanbokkori-plush.glb?v=1', null, -Math.PI / 2],
    ].filter(([type]) => [...machine.pool, ...(Store.state.stock[machine.id] || [])].some(id => toyType(id) === type));
    let completed = 0;
    const files = ['mint-machine.glb', ...specs.map(s => s[1])];
    // Download and decode independent assets concurrently, instead of five serial waits.
    const results = await Promise.allSettled(files.map(async file => {
      const pack = await loadModel(file);
      if (this.active && session === this.session) {
        const label = document.getElementById('loading3dText');
        if (label) label.textContent = `인형과 기계 준비 중 · ${++completed}/${files.length}`;
      }
      return pack;
    }));
    if (!this.active || session !== this.session) {
      for (const r of results) if (r.status === 'fulfilled') this.disposeObject(r.value.scene);
      return;
    }
    /* 필수는 기계(mint-machine)뿐이다. 인형 모델 하나를 못 받았다고 통을 못 열면
       안 되니, 빠진 인형은 기계에 들어 있는 기본 인형으로 대신한다(배경과 같은 정책). */
    if (results[0].status === 'rejected') throw results[0].reason;
    const [loaded, ...plushPacks] = results.map(r => r.status === 'fulfilled' ? r.value : null);
    this.pack = loaded.scene;
    const names = ['Cabinet','Chute','Gantry','Carriage','Claw','Joystick','DropButton','ToyBear','ToyBunny','ToyDuck','ToyOlly','ToyTiger'];
    this.assets = Object.fromEntries(names.map(name => {
      const object = loaded.scene.getObjectByName(name);
      if (!object) throw new Error('Missing 3D asset: ' + name);
      return [name, object];
    }));
    specs.forEach(([type, , rootName, yaw], i) => {
      const pack = plushPacks[i];
      if (!pack) return;                       // 못 받은 인형은 건너뛴다
      const model = rootName ? pack.scene.getObjectByName(rootName) : pack.scene;
      if (!model) throw new Error('Missing model: ' + type);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = .64 / bounds.getSize(new THREE.Vector3()).y;
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -.22 - bounds.min.y * scale, -center.z * scale);
      // The physics quaternion belongs to the outer group. Keep axis correction inside it.
      const facing = new THREE.Group(); facing.name = 'ModelFacing'; facing.rotation.y = yaw;
      facing.add(model);
      const toy = new THREE.Group(); toy.name = type; toy.add(facing);
      this.pack.add(toy); this.assets[type] = toy;
      if (rootName) this.disposeObject(pack.scene);
    });
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
    /* 배경은 기계보다 훨씬 무겁다(9MB · 삼각형 100만). 이걸 기다렸다 화면을
       띄우면 시작이 한참 늦어지므로, 기계·인형만 먼저 세우고 배경은 뒤에서
       받아 끼운다. 도중에 나가면 받은 걸 버린다. */
    this.claw = this.assets.Claw;
    this.fingers = [0,1,2].map(i => this.claw.getObjectByName('Finger'+i));
    this.fingerAngles = [GRIP_REST,GRIP_REST,GRIP_REST]; this.contactLimits = null;
    /* 손가락마다 뻗은 방향이 120도씩 다르다. 그 반경 방향에 수직인 수평축이
       여닫는 힌지축이다 — 이 축으로 돌려야 바깥으로 활짝 펴진다. */
    this.fingerAxes = this.fingers.map(f => {
      let sx = 0, sz = 0;
      for (const c of f.children) { sx += c.position.x; sz += c.position.z; }
      const len = Math.hypot(sx, sz) || 1;
      return new THREE.Vector3(-sz / len, 0, sx / len);
    });
    this.cable = new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,1,10),new THREE.MeshStandardMaterial({color:0x677e73,metalness:.65,roughness:.4}));
    this.scene.add(this.cable);
    this.shadow = new THREE.Mesh(new THREE.RingGeometry(.17,.19,40),new THREE.MeshBasicMaterial({color:0x278f61,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));
    this.shadow.rotation.x = -Math.PI/2; this.scene.add(this.shadow);
    this.buildPhysics(); this.stockToys();
    /* 굴리지 않는다. TOY_SLOTS 가 이미 서로 닿는 정확한 높이라 자리를 잡을 필요가
       없고, 조금만 굴려도(40스텝) 더미가 평평해진다. 바로 재워 모양을 유지하고,
       집게가 건드리면 그때 깨어나 제대로 무너진다. */
    if (!this.restoredLayout) for (const toy of this.toys) toy.body.sleep();
    this.saveToyLayout();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.root);
    this.view('angle'); this.resize(); this.bind();
    for (const toy of this.toys) { toy.mesh.position.copy(toy.body.position); toy.mesh.quaternion.copy(toy.body.quaternion); }
    document.getElementById('loading3dText').textContent = '조명과 화면 준비 중';
    await this.renderer.compileAsync(this.scene, this.camera);
    if (!this.active || session !== this.session) return;
    this.renderer.render(this.scene, this.camera);
    document.getElementById('loading3d')?.remove();
    this.phase = 'aim'; this.status('뽑을 준비 완료'); document.getElementById('drop3d').disabled = false;
    this.previous = performance.now();
    this.frame = requestAnimationFrame(now => this.update(now));
    this.meadowTimer = setTimeout(() => this.loadMeadow(session), 250);
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
    const versions = Store.state.layout3dVersions ||= {};
    if (versions[this.machine.id] !== LAYOUT_VERSION) {
      const stock = Store.state.stock[this.machine.id];
      const pool = this.machine.pool.filter(id => DOLLS[id] && !DOLLS[id].hidden);
      // Add the increased capacity once, without putting already-won prizes back.
      if (!versions[this.machine.id] && stock?.length && pool.length) {
        for (let i = 0; i < TOY_COUNT - 12; i++) stock.push(pool[i % pool.length]);
      }
      if (Store.state.layouts) delete Store.state.layouts[this.machine.id + ':green3d'];
      versions[this.machine.id] = LAYOUT_VERSION;
      Store.save();
    }
    const stock = Store.machineStock(this.machine,TOY_COUNT).dolls.slice(0,TOY_COUNT);
    const layout = Store.machineLayout(this.machine, 'green3d', stock, () => stock.map(dollId => ({dollId})));
    this.restoredLayout = layout.every(d => d.position);
    let slot = 0; this.skippedToys = 0;
    this.toys = layout.map(saved => {
      const id = saved.dollId;
      const type = toyType(id);
      /* 모델을 못 받은 인형은 다른 인형 모습으로 세워 두지 않고 아예 뺀다 —
         엉뚱한 모습으로 서 있으면 뽑고 나서 다른 게 나온 것처럼 보인다. */
      if (!this.assets[type]) { this.skippedToys++; return null; }
      const i = slot++;
      const mesh = this.assets[type].clone(true);
      mesh.position.set(0,0,0);
      mesh.traverse(o => {
        if (!o.isMesh) return;
        o.material = o.material.clone(); o.material.metalness = 0;
        // 올리·호랑이는 재질을 이미 맞춰 둔 모델이라 거칠기를 덮어쓰지 않는다
        // (덮어쓰면 눈의 무광 처리까지 날아간다)
        if (!TOY_SHAPES[type] || type === 'ToyBear' || type === 'ToyBunny' || type === 'ToyDuck') o.material.roughness = .9;
        o.castShadow = true; o.receiveShadow = true;
        if (/cat|penguin/.test(id) && /Honey plush/.test(o.material.name)) o.material.color.set('#a2b8c8');
      });
      const body = new CANNON.Body({ mass: .2, linearDamping:.26, angularDamping:.5, sleepSpeedLimit:.05, sleepTimeLimit:.9,
        collisionFilterGroup: GROUP_TOY, collisionFilterMask: GROUP_TOY | GROUP_CLAW });
      body.addShape(new CANNON.Sphere(.205),new CANNON.Vec3(0,-.015,0));
      body.addShape(new CANNON.Sphere(.17),new CANNON.Vec3(0,.21,0));
      const s = TOY_SLOTS[i] || TOY_SLOTS[i % TOY_SLOTS.length];
      const yaw = [-.95, .45, -.25, 1.05, .05, -.60, .70][i % 7] + (Math.random() - .5) * .18;
      const pitch = [.12, -.32, .95, -.16, .08, -.64, .22][i % 7];
      const roll = [-1.18, .24, -.32, .84, -.20, .12, 1.30][i % 7];
      body.quaternion.setFromEuler(pitch, yaw, roll, 'YZX');
      mesh.quaternion.copy(body.quaternion);
      const box = new THREE.Box3().setFromObject(mesh);
      let x = s[0] + (Math.random() - .5) * .12;
      let z = s[2] + (Math.random() - .5) * .12;
      x = clamp(x, -1.22 - box.min.x, 1.22 - box.max.x);
      z = clamp(z, -.88 - box.min.z, .89 - box.max.z);
      if (x + box.min.x < -.60 && z + box.max.z > .23) z = .20 - box.max.z;
      // Rotated feet and ears must stay above the floor and inside the glass.
      const y = Math.max(.035 - box.min.y, s[1] + (Math.random() - .5) * .10);
      body.position.set(x, y, z);
      if (saved.position) {
        body.position.set(...saved.position); body.quaternion.set(...saved.quaternion); body.sleep();
      }
      this.world.addBody(body); this.scene.add(mesh);
      return { id,mesh,body };
    }).filter(Boolean);
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
  /* 상태 배지는 없앴다 — 조작 덱의 대상·확률 표시로 충분하고 상단이 복잡했다.
     호출부는 그대로 두고 여기서만 받아 넘긴다. */
  status() {},

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
      if(this.time<=0)this.drop();
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
    if(this.phase==='dropping'){this.swing.set(0,0);this.swingVel.set(0,0);}
    /* 집게 돌리기 — 레버를 민 쪽을 향해 집게가 천천히 돌아간다. 멈추면 그 방향을
       그대로 유지한다 (실제 기계에서 집게를 돌려놓는 것처럼). */
    const speed = Math.hypot(carVelX, carVelZ);
    if (speed > .12 && this.phase === 'aim') {   // 조준 중 레버로 돌릴 때만
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
  /* 놓거나 떨어뜨린 인형이 다 구르고 멈출 때까지 기다린다. 전에는 고정 시간만
     세고 결과를 냈더니, 인형이 아직 떨어지는 중인데 실패 화면이 떠서 "제대로
     보여주지도 않고 실패시킨다"는 느낌을 줬다. */
  async settle(toy, maxMs = 2800) {
    const t0 = performance.now();
    while (this.active && performance.now() - t0 < maxMs) {
      if (!await this.pause(90)) return false;
      if (performance.now() - t0 < 300) continue;      // 놓자마자 멈춘 것으로 보지 않게
      if (toy.body.sleepState === CANNON.Body.SLEEPING || toy.body.velocity.length() < .09) break;
    }
    return this.active;
  },
  /** 집게 입 벌리기/오므리기. v 는 벌어짐(1 = 모델 기본, 클수록 활짝).
      끝날 때까지 기다릴 수 있게 약속을 돌려준다 — 다 내려간 뒤에 움켜쥐는
      순서를 만들려면 애니메이션이 끝나는 시점을 알아야 한다. */
  grip(v, ms = 220) {
    clearInterval(this.gripTimer);
    const to = v, from = this.gripT ?? GRIP_REST;
    const fromAngles=this.fingerAngles.slice();
    const t0 = performance.now();
    this.gripTimer = setInterval(() => {
      const t = clamp((performance.now() - t0) / ms, 0, 1);
      this.gripT = from + (to - from) * ease(t);
      this.fingers.forEach((f, i) => {
        const requested=fromAngles[i]+(v-fromAngles[i])*ease(t);
        this.fingerAngles[i]=v<fromAngles[i]?Math.max(requested,this.contactLimits?.[i]??v):requested;
        f.setRotationFromAxisAngle(this.fingerAxes[i],this.fingerAngles[i]);
      });
      if (t === 1) clearInterval(this.gripTimer);
    }, 16);
    return this.pause(ms);
  },
  releaseToy() {
    if(!this.held)return;
    this.held.body.type=CANNON.Body.DYNAMIC;this.held.body.mass=.22;this.held.body.updateMassProperties();
    // The visual fingers open, but the coarse claw collider does not; let the released prize clear it.
    this.held.body.collisionResponse=true;this.held.body.collisionFilterMask=GROUP_TOY;
    this.held.body.wakeUp();this.held.body.velocity.set(0,-.15,0);
    this.held=null;this.contactLimits=null;this.grip(GRIP_OPEN);
  },

  async drop() {
    if(this.phase!=='aim')return;
    const session=this.session;const alive=()=>this.active&&this.session===session;
    const near=this.nearest(),chance=this.odds(near);
    this.phase='dropping';this.release();this.velocity.set(0,0);
    document.getElementById('drop3d').disabled=true;this.status('집게가 내려가요');haptic(20);
    const target=near&&near.distance<.29?near.toy:null;
    // 물려는 인형만 집게 몸통을 통과시킨다 — 안 그러면 집기 전에 밀려난다
    if(target){
      target.body.collisionFilterMask=GROUP_TOY;
      target.body.type=CANNON.Body.KINEMATIC;target.body.updateMassProperties();
      target.body.velocity.setZero();target.body.angularVelocity.setZero();
    }
    const won=!!target&&Math.random()*100<chance;
    const slipped=!!target&&!won&&Math.random()>.3;
    App.lastAttempt={dollId:target?.id||null,accuracy:near?Math.round(Math.max(0,1-near.distance/.32)*100):0,kind:'miss'};
    // Keep the original housing above the toy; only the native hinges may rotate.
    const targetBounds = target ? new THREE.Box3().setFromObject(target.mesh,true) : null;
    let down = targetBounds ? Math.max(.30,targetBounds.max.y+.095) : .46;
    if(target){
      const position=this.claw.position.clone(),quaternion=this.claw.quaternion.clone();
      this.claw.position.set(this.position.x,down,this.position.z);
      this.claw.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),this.yaw);
      const contacts=clawContacts(this.claw,this.fingers,this.fingerAxes,target.mesh,GRIP_OPEN,GRIP_SHUT);
      down+=contacts.lift;this.contactLimits=contacts.limits;
      this.claw.position.copy(position);this.claw.quaternion.copy(quaternion);this.claw.updateMatrixWorld(true);
    }
    // 먼저 입을 활짝 벌린 뒤 내려간다 — 벌린 채로 내려가야 인형을 감싸는 것처럼 보인다
    await this.grip(GRIP_OPEN,260);if(!alive())return;
    await this.travel([this.position.x,down,this.position.z],1.05);if(!alive())return;
    await this.pause(140);if(!alive())return;                    // 바닥에서 한 박자 멈춘다
    this.status('움켜쥐는 중');
    // 인형이 있으면 표면에 닿을 만큼만, 빈손이면 끝까지 오므린다
    await this.grip(GRIP_SHUT,560);if(!alive())return;
    await this.pause(160);if(!alive())return;
    if(target&&(won||slipped)){
      this.held=target;target.body.type=CANNON.Body.KINEMATIC;target.body.mass=0;target.body.updateMassProperties();
      target.body.collisionResponse=false;target.body.wakeUp();
      /* 인형을 똑바로 세우지 않는다. 누워 있으면 누운 채로, 집게가 닿은 그 지점을
         잡고 들어 올린다 — 배를 물었는데 머리를 문 것처럼 보이지 않도록. */
      const q=target.body.quaternion, p=target.body.position;
      this.heldQuat=new THREE.Quaternion(q.x,q.y,q.z,q.w); this.heldYaw=this.yaw;
      this.heldOffset=new THREE.Vector3(
        p.x-this.clawPos.x, p.y-this.clawPos.y, p.z-this.clawPos.z);
    }
    if(target&&!this.held){
      await this.grip(GRIP_OPEN,220);if(!alive())return;
      target.body.type=CANNON.Body.DYNAMIC;target.body.updateMassProperties();target.body.wakeUp();
    }
    this.phase='lifting';this.status('들어 올리는 중');
    await this.travel([this.position.x,REST_Y,this.position.z],1.2);if(!alive())return;
    if(!this.held){
      if(target)target.body.collisionFilterMask=GROUP_TOY|GROUP_CLAW;
      this.grip(GRIP_REST,260);this.status('아쉽게 놓쳤어요');
      await this.pause(760);if(!alive())return;this.finish(false,target?.id);return;}
    if(slipped){
      this.releaseToy();App.lastAttempt.kind='slip';this.status('앗, 놓쳤어요');haptic(25);
      if(!await this.settle(target))return;
      await this.pause(420);if(!alive())return;
      this.finish(false,target.id);return;
    }
    this.phase='carrying';this.status('배출구로 옮기는 중');
    // Align the prize center with the chute, then let travel sway settle.
    const centerOffset = new THREE.Vector3(0,.09,0).applyQuaternion(this.heldQuat).add(this.heldOffset);
    await this.travel([CHUTE.x-centerOffset.x,REST_Y,CHUTE.z-centerOffset.z],1.25);if(!alive())return;
    await this.travel([this.position.x,this.position.y,this.position.z],.9);if(!alive())return;
    this.phase='releasing';this.status('인형을 내려놔요');this.releaseToy();haptic(35);
    if(!await this.settle(target))return;
    await this.pause(360);if(!alive())return;           // 자리 잡은 모습을 한 박자 보여준다
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
    // 못 내보낸 인형이 있으면 저장하지 않는다 — 저장하면 그 인형이 영영 빠진다
    if (this.toys && !this.skippedToys) {
      const prior = Store.state.layouts?.[this.machine.id + ':green3d'] || [];
      Store.saveLayout(this.machine, 'green3d', this.toys.filter(t => t !== this.wonToy).map(t => {
        const i = this.toys.indexOf(t);
        if (t === this.held && prior[i]) return prior[i];
        return {dollId:t.id,position:[t.body.position.x,t.body.position.y,t.body.position.z],quaternion:[t.body.quaternion.x,t.body.quaternion.y,t.body.quaternion.z,t.body.quaternion.w]};
      }));
    }
  },
  /* 인형을 새로 채우고 배치를 처음 상태로 되돌린다. 집게에 밀려 한쪽으로
     쏠리거나 남은 수가 줄었을 때 쓴다. 티켓은 쓰지 않는다. */
  rearrange() {
    if (!this.toys || this.phase !== 'aim' || this.held) return;
    for (const toy of this.toys) {
      this.world.removeBody(toy.body);
      this.scene.remove(toy.mesh);
      // 지오메트리는 원본 에셋과 공유하므로 두고, 인형마다 복제한 재질만 버린다
      toy.mesh.traverse(o => { if (o.isMesh) o.material.dispose(); });
    }
    this.toys = null; this.wonToy = null;
    Store.refillMachine(this.machine, TOY_COUNT);   // 재고를 채우고 저장된 배치를 지운다
    this.stockToys();
    for (const toy of this.toys) toy.body.sleep();
    this.saveToyLayout();
    this.status('다시 채웠어요');
    haptic(20);
  },

  async loadMeadow(session) {
    let pack;
    try { pack = await loadModel('higgsfield-meadow-detailed.glb'); }
    catch { return; }                                   // 배경이 없어도 게임은 돌아간다
    if (!this.active || session !== this.session) { this.disposeObject(pack.scene); return; }
    const meadow = pack.scene; meadow.name = 'Meadow';
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
  },

  stop() {
    if (this.active && this.phase !== 'loading') this.saveToyLayout();
    this.toys=null;this.wonToy=null;
    this.active=false;this.session++;
    cancelAnimationFrame(this.frame);clearTimeout(this.delay);clearInterval(this.gripTimer);
    clearTimeout(this.meadowTimer);
    this.delayResolve?.(false);this.delayResolve=null;
    this.tween?.resolve(false);this.tween=null;
    this.events?.abort();this.resizeObserver?.disconnect();this.orbit?.dispose();
    this.disposeObject(this.scene);this.disposeObject(this.pack);
    this.environment?.dispose();this.environment=null;
    this.renderer?.dispose();this.renderer?.forceContextLoss();
    this.scene=null;this.pack=null;this.renderer=null;this.assets=null;this.held=null;
  }
};
