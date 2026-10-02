import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/meshopt_decoder.module.js';

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
import { initRapier, PhysicsWorld, GROUP, members } from './claw/world.js?v=212';
import { ClawAssembly, CLAW } from './claw/claw.js?v=212';
import { GrabAnalyzer } from './claw/analyzer.js?v=212';
import { ClawController, STATE } from './claw/controller.js?v=212';

const CHUTE = { x: -.91, z: .53 };
/* 실험실(lab/claw.html)에서 맞춘 물리를 그대로 쓴다. 게임 쪽 좌표가 더 커서
   집게 치수와 힘을 CLAW_SCALE 배로 늘린다 (인형 지름 실험실 0.25 → 게임 0.41). */
const CLAW_SCALE = 1.7;
const TOY_FILTER = members(GROUP.TOY, GROUP.TOY | GROUP.CLAW | GROUP.WALL | GROUP.CHUTE);
const REST_Y = 2.72;
/** 메시의 꼭짓점을 모아 볼록 껍질용 점 배열(Float32Array)로. 점이 많으면 솎는다. */
function hullPoints(root, max = 160) {
  const pts = [];
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const v = new THREE.Vector3();
  root.traverse(o => {
    const pos = o.isMesh && o.geometry && o.geometry.attributes.position;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / max));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      pts.push(v.x, v.y, v.z);
    }
  });
  return pts.length >= 12 ? new Float32Array(pts) : null;
}

/** 기계마다 관리자가 정한 집게 힘 (없으면 기본값). */
function machineGrip(machine) {
  const v = machine && machine.grip;
  return Number.isFinite(v) && v > 0 ? v : CLAW.gripStiffness;
}

const clamp = THREE.MathUtils.clamp;
const ease = t => t * t * (3 - 2 * t);

export const Play3D = {
  session: 0,
  active: false,
  async start(machine) {
    this.stop();
    const session = this.session;
    this.active = true; this.machine = machine; this.phase = 'loading';
    this.time = PLAY_SECONDS; this.timedOut = false; this.input = new THREE.Vector2(); this.velocity = new THREE.Vector2();
    this.position = new THREE.Vector3(.25, REST_Y, 0); this.held = null; this.lastTarget = null;
    /* 집게는 줄에 매달려 있으니 캐리지를 따라 뻣뻣하게 붙어 다니지 않는다.
       캐리지 가속도로 밀린 만큼 뒤로 처졌다가 좌우로 흔들리는 진자를 둔다.
       흔들림은 눈에만 보이고 조준 판정은 캐리지 위치(this.position)로 해서,
       보기엔 흐물흐물해도 겨냥은 예측 가능하게 남긴다. */
    this.swing = new THREE.Vector2(); this.swingVel = new THREE.Vector2(); this.yaw = 0;
    this.clawPos = this.position.clone(); this.prevPos = this.position.clone();
    this.gripT = 0;
    /* 준비 화면이 이미 떠 있으면 떼지 않고(애니메이션이 처음부터 다시 돌지 않게)
       그 뒤에 인형통을 깔고, 준비 화면은 위에 덮어 둔다. */
    const keep = document.getElementById('loading3d');
    const html = `<section class="green3d">
      <div class="green3d-stage" id="stage3d">
        <div class="green3d-top"><button class="iconbtn" id="exit3d" aria-label="나가기">${icon('chevronLeft3',20)}</button><span class="green3d-wallet" role="status" aria-label="보유 티켓 ${Store.state.tickets}장">${icon('ticketFill',16)}<span id="walletN3d">${Store.state.tickets}</span></span></div>
        <div class="green3d-views" aria-label="카메라 시점"><button data-view="front" aria-pressed="false">정면</button><button data-view="angle" aria-pressed="true">입체</button><button data-view="top" aria-pressed="false">위</button></div>
      </div>
      <div class="green3d-deck"><div class="green3d-console">
        <div class="green3d-stick" id="stick3d" role="group" aria-label="집게 이동 조이스틱" tabindex="0"><span class="green3d-knob" id="knob3d"></span></div>
        <div class="green3d-readout"><span class="green3d-label">남은 시간</span><strong class="green3d-clock" id="clock3d">00:20</strong><div class="green3d-meter"><i id="time3d" style="width:100%"></i></div></div>
        <button class="green3d-drop" id="drop3d" disabled aria-label="집게 내리기">${icon('caretDown',24)}<span>드롭</span></button>
      </div><div class="green3d-target"><img id="targetImg3d" alt="" hidden><span id="target3d">준비 중</span><b id="odds3d"></b><button class="green3d-reset" id="reset3d" type="button">재배치</button></div></div>
      ${keep ? '' : green3DLoading()}
    </section>`;
    if (keep) {
      for (const n of [...screenEl().children]) if (n !== keep) n.remove();
      keep.insertAdjacentHTML('beforebegin', html);
      keep.classList.add('l3-over');
    } else screenEl().innerHTML = html;
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
      ['ToySpring', 'spring-plush.glb?v=1', null, -Math.PI / 2],
    ].filter(([type]) => [...machine.pool, ...(Store.state.stock[machine.id] || [])].some(id => toyType(id) === type));
    let completed = 0;
    const files = ['mint-machine.glb', ...specs.map(s => s[1])];
    // Download and decode independent assets concurrently, instead of five serial waits.
    const results = await Promise.allSettled(files.map(async file => {
      const pack = await loadModel(file);
      if (this.active && session === this.session) {
        const label = document.getElementById('loading3dText');
        if (label) label.textContent = `인형과 기계 준비 중 · ${++completed}/${files.length}`;
        document.getElementById('loading3dBar')?.style.setProperty('width', `${10 + 80 * completed / files.length}%`);
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
    /* GLB 안의 집게 모형은 쓰지 않는다 — Rapier 로 만든 집게가 곧 보이는 집게다. */
    if (this.assets.Claw) this.assets.Claw.visible = false;
    this.cable = new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,1,10),new THREE.MeshStandardMaterial({color:0x677e73,metalness:.65,roughness:.4}));
    this.scene.add(this.cable);
    this.shadow = new THREE.Mesh(new THREE.RingGeometry(.17,.19,40),new THREE.MeshBasicMaterial({color:0x278f61,transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false}));
    this.shadow.rotation.x = -Math.PI/2; this.scene.add(this.shadow);
    await initRapier();                       // wasm 준비 (두 번째부터는 즉시 반환)
    if (!this.active || session !== this.session) return;
    this.buildPhysics(); this.stockToys();
    /* 굴리지 않는다. TOY_SLOTS 가 이미 서로 닿는 정확한 높이라 자리를 잡을 필요가
       없고, 조금만 굴려도(40스텝) 더미가 평평해진다. 바로 재워 모양을 유지하고,
       집게가 건드리면 그때 깨어나 제대로 무너진다. */
    if (!this.restoredLayout) this.pw.stepTimes(240);   // 더미가 자리를 잡게 한 뒤 시작
    this.saveToyLayout();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.root);
    this.view('angle'); this.resize(); this.bind();
    for (const toy of this.toys) {
      const p = toy.body.translation(), q = toy.body.rotation();
      toy.mesh.position.set(p.x, p.y, p.z); toy.mesh.quaternion.set(q.x, q.y, q.z, q.w);
    }
    this.claw.sync();
    const label = document.getElementById('loading3dText');
    if (label) label.textContent = '조명과 화면 준비 중';
    document.getElementById('loading3dBar')?.style.setProperty('width', '96%');
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
    const pw = new PhysicsWorld({ x: 0, y: -9.81, z: 0 });
    this.pw = pw;
    const R = pw.R;
    const wall = (x, y, z, w, h, d) => {
      const body = pw.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, y, z));
      pw.world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
        .setFriction(.5).setRestitution(0)
        .setCollisionGroups(members(GROUP.WALL, GROUP.TOY | GROUP.CLAW))
        .setContactSkin(.001), body);
    };
    wall(0,-.08,0,2.65,.16,1.95);
    wall(-1.29,1.7,0,.10,3.5,1.95); wall(1.29,1.7,0,.10,3.5,1.95);
    wall(0,1.7,-.95,2.65,3.5,.10); wall(0,1.7,.96,2.65,3.5,.10);
    wall(-.60,.36,.53,.025,.72,.62); wall(-1.22,.36,.53,.025,.72,.62);
    wall(-.91,.36,.23,.64,.72,.025); wall(-.91,.36,.83,.64,.72,.025);

    // 배출구 센서 — 인형이 실제로 여기 떨어져야 성공이다
    const chuteBody = pw.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(CHUTE.x, .10, CHUTE.z));
    this.chuteCol = pw.world.createCollider(
      R.ColliderDesc.cylinder(.10, .30).setSensor(true)
        .setCollisionGroups(members(GROUP.CHUTE, GROUP.TOY)), chuteBody);

    /* 집게: 실험실과 같은 구조. 발 세 개가 실제 collider 이고, 닫는 힘은
       모터 토크라 인형에 막히면 중간에 멈춘다. 힘은 기계마다 관리자가 정한다. */
    this.claw = new ClawAssembly(pw, this.scene, { x: 0, y: 3.03, z: 0 }, {
      cableLength: .30, scale: CLAW_SCALE, color: 0xf0c23a,
      grip: machineGrip(this.machine),
    });
    this.analyzer = new GrabAnalyzer(pw, this.claw, []);
    this.controller = new ClawController(this.claw, this.analyzer, {
      restLength: .30, maxLength: 2.35,
      chute: { x: CHUTE.x, z: CHUTE.z }, home: { x: 0, z: 0 },
      downSpeed: .42 * CLAW_SCALE, upSpeed: .48 * CLAW_SCALE, transportTime: 2.2,
      onState: (st) => this.onClawState(st),
    });
    pw.onStep[0] = (dt) => this.controller.tick(dt);
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
      /* 인형 모양대로 잡히게 하려면 공 두 개로는 안 된다. 실제 메시의 점들로
         볼록 껍질을 떠서 collider 로 쓴다 — 실루엣이 그대로라 집게 발이
         보이는 자리에서 걸린다. */
      const R = this.pw.R;
      const body = this.pw.world.createRigidBody(
        R.RigidBodyDesc.dynamic().setCcdEnabled(true).setSoftCcdPrediction(.06)
          .setLinearDamping(.26).setAngularDamping(.5));
      const hull = hullPoints(mesh);
      const shape = hull ? R.ColliderDesc.convexHull(hull) : R.ColliderDesc.ball(.2);
      this.pw.world.createCollider(shape
        .setMass(.2).setFriction(.95).setRestitution(.03)
        .setFrictionCombineRule(R.CoefficientCombineRule.Average)
        .setCollisionGroups(TOY_FILTER).setContactSkin(.0008), body);
      const s = TOY_SLOTS[i] || TOY_SLOTS[i % TOY_SLOTS.length];
      const yaw = [-.95, .45, -.25, 1.05, .05, -.60, .70][i % 7] + (Math.random() - .5) * .18;
      const pitch = [.12, -.32, .95, -.16, .08, -.64, .22][i % 7];
      const roll = [-1.18, .24, -.32, .84, -.20, .12, 1.30][i % 7];
      const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YZX'));
      body.setRotation({ x: q0.x, y: q0.y, z: q0.z, w: q0.w }, false);
      mesh.quaternion.copy(q0);
      const box = new THREE.Box3().setFromObject(mesh);
      let x = s[0] + (Math.random() - .5) * .12;
      let z = s[2] + (Math.random() - .5) * .12;
      x = clamp(x, -1.22 - box.min.x, 1.22 - box.max.x);
      z = clamp(z, -.88 - box.min.z, .89 - box.max.z);
      if (x + box.min.x < -.60 && z + box.max.z > .23) z = .20 - box.max.z;
      // Rotated feet and ears must stay above the floor and inside the glass.
      const y = Math.max(.035 - box.min.y, s[1] + (Math.random() - .5) * .10);
      body.setTranslation({ x, y, z }, false);
      if (saved.position) {
        body.setTranslation({ x: saved.position[0], y: saved.position[1], z: saved.position[2] }, false);
        const [qx, qy, qz, qw] = saved.quaternion;
        body.setRotation({ x: qx, y: qy, z: qz, w: qw }, false);
      }
      this.scene.add(mesh);
      const toy = { id, mesh, body, colliders: [] };
      for (let c = 0; c < body.numColliders(); c++) {
        const col = body.collider(c);
        col.userData = { toy, part: 'body' };
        toy.colliders.push(col);
      }
      toy.hasCollider = (c) => toy.colliders.includes(c);
      return toy;
    }).filter(Boolean);
    this.analyzer.toys = this.toys;
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
    /* 더 가깝고 더 비스듬하게 — 인형통 안이 크게 보이도록. */
    const positions={front:[0,1.95,5.3],angle:[3.0,2.95,5.0],top:[0,5.6,3.4]};
    this.camera.position.fromArray(positions[name]);
    this.orbit.target.set(0,1.15,0);this.orbit.update();
    this.root.querySelectorAll('[data-view]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.view===name)));
    this.resize();
  },

  resize() {
    if(!this.active || !this.renderer)return;
    const {width,height}=this.root.getBoundingClientRect();if(!width||!height)return;
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;
    this.camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.max(1.78,1.56/this.camera.aspect)/5.6));
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
      if(this.time<=0){this.timedOut=true;this.drop();}   // 시간이 끝나 저절로 내려간 판
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
    /* 물리는 Rapier 가 고정 간격으로 돈다. 집게 상태 기계도 그 안에서 같이
       돌아간다(buildPhysics 의 onStep). 여기서는 결과를 보여주기만 한다. */
    if (this.phase === 'aim') this.claw.moveCarriage(this.position.x, this.position.z);
    this.pw.advance(dt);
    this.analyzer.update();
    this.claw.sync();
    for (const toy of this.toys) {
      const t = toy.body.translation(), r = toy.body.rotation();
      toy.mesh.position.set(t.x, t.y, t.z);
      toy.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    this.checkChute();

    // 캐리지·줄·그림자는 집게 실제 위치를 따라간다
    const cl = this.claw.body.translation();
    const car = this.claw.origin;
    this.assets.Carriage.position.set(car.x, 3.06, car.z);
    this.assets.Gantry.position.z = car.z;
    const top = new THREE.Vector3(car.x, 3.03, car.z);
    const span = new THREE.Vector3(cl.x - top.x, cl.y - top.y, cl.z - top.z);
    this.cable.scale.y = Math.max(.08, span.length());
    this.cable.position.copy(top).addScaledVector(span, .5);
    this.cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), span.clone().normalize());
    this.shadow.position.set(cl.x, .015, cl.z);
    this.shadow.visible = this.phase === 'aim';

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
  drop() {
    if (this.phase !== 'aim') return;
    this.phase = 'dropping';
    this.release(); this.velocity.set(0, 0);
    document.getElementById('drop3d').disabled = true;
    this.caught = null;
    App.lastAttempt = { dollId: null, accuracy: 0, kind: this.timedOut ? 'timeout' : 'empty' };
    this.controller.drop();
    haptic(20);
  },

  /** 상태 기계가 단계를 바꿀 때마다 안내 문구를 맞춘다. */
  onClawState(st) {
    const text = {
      [STATE.DESCENDING]: '집게가 내려가요',
      [STATE.BOTTOM_REACHED]: '바닥에 닿았어요',
      [STATE.CLOSING]: '움켜쥐는 중',
      [STATE.GRIP_SETTLE]: '꽉 잡는 중',
      [STATE.LIFTING]: '들어 올리는 중',
      [STATE.TRANSPORT]: '배출구로 옮기는 중',
      [STATE.RELEASE]: '인형을 내려놔요',
      [STATE.RETURN]: '돌아가는 중',
    }[st];
    if (text) this.status(text);
    if (st === STATE.LIFTING) {
      // 무엇을 물고 올라오는지 이때 기록해 둔다 (실패 화면이 그 인형을 보여준다)
      const held = this.analyzer.heldToy;
      if (held) App.lastAttempt = { dollId: held.id, accuracy: 100, kind: 'slip' };
    }
    if (st === STATE.RETURN) {
      // 한 판 끝. 배출구에 들어간 게 있으면 성공.
      const toy = this.caught;
      setTimeout(() => {
        if (!this.active) return;
        this.finish(!!toy, toy ? toy.id : (App.lastAttempt && App.lastAttempt.dollId), toy);
      }, 700);
    }
  },

  /** 배출구 센서에 인형이 들어왔는지 본다. */
  checkChute() {
    if (this.caught || !this.chuteCol) return;
    this.pw.world.intersectionPairsWith(this.chuteCol, (other) => {
      const toy = other.userData && other.userData.toy;
      if (toy && !this.caught) this.caught = toy;
    });
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
      Store.saveLayout(this.machine, 'green3d', this.toys.filter(t => t !== this.wonToy).map(t => {
        const p = t.body.translation(), q = t.body.rotation();
        return { dollId: t.id, position: [p.x, p.y, p.z], quaternion: [q.x, q.y, q.z, q.w] };
      }));
    }
  },
  /* 인형을 새로 채우고 배치를 처음 상태로 되돌린다. 집게에 밀려 한쪽으로
     쏠리거나 남은 수가 줄었을 때 쓴다. 티켓은 쓰지 않는다. */
  rearrange() {
    if (!this.toys || this.phase !== 'aim') return;
    for (const toy of this.toys) {
      this.pw.world.removeRigidBody(toy.body);
      this.scene.remove(toy.mesh);
      // 지오메트리는 원본 에셋과 공유하므로 두고, 인형마다 복제한 재질만 버린다
      toy.mesh.traverse(o => { if (o.isMesh) o.material.dispose(); });
    }
    this.toys = null; this.wonToy = null;
    Store.refillMachine(this.machine, TOY_COUNT);   // 재고를 채우고 저장된 배치를 지운다
    this.stockToys();
    this.analyzer.toys = this.toys;
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
    try { this.pw?.free(); } catch (_) {}
    this.pw=null; this.claw=null; this.analyzer=null; this.controller=null; this.chuteCol=null;
    this.scene=null;this.pack=null;this.renderer=null;this.assets=null;this.held=null;
  }
};
