import * as T from 'three';
import { buildWorld } from './world';
import { createActor } from './actors';
import { missions } from './story';
import { Sound } from './sound';
import { newRun, type Run, type Prefs } from './profile';
import { blocked, slide, clipSegment, dist, steer } from './physics';

type Character = ReturnType<typeof createActor>;
type World = ReturnType<typeof buildWorld>;
type Npc = {
  actor: Character;
  id: number;
  home: [number, number];
  hp: number;
  state: 'idle' | 'patrol' | 'alert' | 'retreat' | 'surrender';
  timer: number;
  fire: number;
  hit: number;
  pace: number;
};
type Hooks = {
  save: (r: Run) => void;
  finish: (r: Run) => void;
  fail: () => void;
  notify: (s: string) => void;
  line: (s: string) => void;
  hud: (g: Game) => void;
};
const clamp = T.MathUtils.clamp;
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const capacities = [12, 6];
export class Game {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(52, 1, 0.12, 450);
  world: World;
  hero: Character;
  run: Run;
  stageProp = new T.Group();
  optionalProp = new T.Group();
  pickups: T.Group[] = [];
  goalPerson?: Character;
  people: Character[] = [];
  enemies: Npc[] = [];
  held = new Set<string>();
  stride = 0;
  joy = { x: 0, y: 0 };
  pitch = 0.08;
  aim = false;
  crouch = false;
  fireHeld = false;
  touchSprint = false;
  active = false;
  intro = true;
  vertical = 0;
  alt = 0;
  standing = 0;
  climbing = false;
  cooldown = 0;
  reloadTime = 0;
  flash = 0;
  hurt = 0;
  gesture = 0;
  elapsed = 0;
  fps = 0;
  pressure = 0;
  hudClock = 0;
  lastAi = 0;
  frameSample = 0;
  frames = 0;
  slow = 0;
  near = '';
  nearIndex = -1;
  nextLine = 22;
  fpsSamples: number[] = [];
  private light: T.DirectionalLight;
  private cameraReady = false;
  private heroAngle = 0;
  private cinematic = 0;
  private fxPool: { mesh: T.Mesh; t: number; total: number; vel: T.Vector3 }[] = [];
  private fxCursor = 0;
  private disposable: (T.Material | T.BufferGeometry)[] = [];
  private opts: Prefs;
  private callback: Hooks;
  private sound: Sound;
  private marker = V();
  private escort?: Character;
  private trail: [number, number][] = [];
  private sceneBeat = false;
  private escortSpeed = 0;
  private software = false;
  private film?: ReturnType<typeof import('./effects').filmPass>;
  private filmVersion = 0;
  private crate?: T.Group;
  private shards: { mesh: T.Mesh; velocity: T.Vector3; age: number }[] = [];
  private crateEffect() {
    if (!this.run.index || this.run.index === 3 || this.run.broken.includes(0)) return;
    const geo = new T.BoxGeometry(1, 1, 1),
      wood = new T.MeshStandardMaterial({ color: 0x75563b, roughness: 0.96 });
    this.disposable.push(geo, wood);
    const crate = new T.Group(),
      place = this.freeSpot(4.1, -5.5);
    this.locate(crate, ...place);
    this.scene.add(crate);
    this.crate = crate;
    for (let i = 0; i < 14; i++) {
      const mesh = new T.Mesh(geo, wood);
      const end = i > 9;
      mesh.position.set(
        end ? (i % 2 ? 0.48 : -0.48) : 0,
        end ? 0.2 + Math.floor((i - 10) / 2) * 0.25 : 0.09 + Math.floor(i / 2) * 0.14,
        end ? 0 : i % 2 ? 0.35 : -0.35,
      );
      mesh.scale.set(end ? 0.085 : 1, end ? 0.17 : 0.11, end ? 0.76 : 0.075);
      mesh.castShadow = true;
      crate.add(mesh);
      this.shards.push({ mesh, velocity: V(), age: 0 });
    }
  }
  private breakCrate() {
    if (!this.crate) return;
    this.run.broken.push(0);
    this.crate.updateMatrixWorld();
    for (const s of this.shards) {
      this.scene.attach(s.mesh);
      s.velocity.set((Math.random() - 0.5) * 2, 1.6 + Math.random() * 2, (Math.random() - 0.5) * 2);
      s.age = 1.4;
    }
    this.scene.remove(this.crate);
    this.crate = undefined;
    this.sound.fx('rock', 0.25);
  }
  private contact!: T.InstancedMesh;
  private addEscort(actor?: Character) {
    this.escort = actor ?? createActor('civilian', this.run.index + 1);
    const a = this.escort;
    this.scene.add(a.group);
    if (!actor) this.locate(a.group, ...this.freeSpot(this.run.x + 0.6, this.run.z + 1.0));
    this.trail = [[this.run.x, this.run.z]];
  }
  private follow(dt: number) {
    if (!this.escort) return;
    const p = this.escort.group.position,
      r = this.run;
    const last = this.trail.at(-1);
    if (!last || dist(...last, r.x, r.z) > 0.55) this.trail.push([r.x, r.z]);
    if (this.trail.length > 100) this.trail.shift();
    if (dist(p.x, p.z, r.x, r.z) < 1.55) {
      this.escortSpeed = 0;
      return;
    }
    while (this.trail.length > 1 && dist(p.x, p.z, ...this.trail[0]) < 0.75) this.trail.shift();
    const t = this.trail[0] ?? [r.x, r.z],
      d = dist(p.x, p.z, ...t);
    if (d < 0.1) return;
    const [dx, dz] = steer(p.x, p.z, ...t, p.y, this.world.blockers, 1);
    this.escortSpeed = Math.min(6.5, 2.8 + dist(p.x, p.z, r.x, r.z) * 0.45);
    const [x, z] = slide(
      p.x,
      p.z,
      dx * Math.min(d, this.escortSpeed * dt),
      dz * Math.min(d, this.escortSpeed * dt),
      p.y,
      this.world.bounds,
      this.world.blockers,
    );
    this.locate(this.escort.group, x, z);
    this.escort.group.rotation.y = Math.atan2(-dx, -dz);
  }
  private actorShadows() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!,
      grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(35,28,22,.65)');
    grad.addColorStop(0.42, 'rgba(35,28,22,.42)');
    grad.addColorStop(1, 'rgba(35,28,22,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const map = new T.CanvasTexture(c),
      m = new T.MeshBasicMaterial({
        map,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      geo = new T.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.disposable.push(geo, m);
    this.contact = new T.InstancedMesh(geo, m, 18);
    this.contact.userData.map = map;
    this.contact.frustumCulled = false;
    this.contact.renderOrder = 2;
    this.scene.add(this.contact);
  }
  private shadeActors() {
    let i = 0;
    const transform = new T.Matrix4();
    for (const actor of [
      this.hero,
      ...this.people,
      ...this.enemies.map((n) => n.actor),
      this.escort,
      this.goalPerson,
    ]) {
      if (!actor) continue;
      const p = actor.group.getWorldPosition(V());
      transform.makeScale(1.1, 1, 1.7);
      transform.setPosition(p.x + 0.13, this.world.heightAt(p.x, p.z) + 0.075, p.z + 0.23);
      this.contact.setMatrixAt(i++, transform);
    }
    this.contact.count = i;
    this.contact.instanceMatrix.needsUpdate = true;
  }

  constructor(
    canvas: HTMLCanvasElement,
    index: number,
    previous: Run | null,
    prefs: Prefs,
    sound: Sound,
    hooks: Hooks,
  ) {
    this.opts = prefs;
    this.sound = sound;
    this.callback = hooks;
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: prefs.quality >= 2,
      powerPreference: 'high-performance',
      alpha: false,
    });
    const gl = this.renderer.getContext(),
      dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.software =
      !!dbg && /swiftshader|llvmpipe|software/i.test(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.setClearColor(0x95a6a4);
    this.world = buildWorld(index, prefs.quality);
    this.scene.add(this.world.group);
    const w = this.world;
    this.scene.background = new T.Color(w.sky);
    this.scene.fog = new T.FogExp2(w.fog, w.night ? 0.011 : 0.0058);
    this.scene.add(
      new T.HemisphereLight(
        w.night ? 0xadbee3 : 0xf8f0da,
        w.night ? 0x474451 : 0x82735f,
        w.night ? 1.6 : 2.1,
      ),
    );
    this.light = new T.DirectionalLight(w.sunlight, w.night ? 1.15 : 2.4);
    this.light.position.set(-34, 46, -42);
    this.light.castShadow = true;
    const sh = this.light.shadow;
    sh.camera.left = sh.camera.bottom = -26;
    sh.camera.right = sh.camera.top = 26;
    sh.camera.near = 1;
    sh.camera.far = 135;
    sh.bias = -0.00055;
    sh.normalBias = 0.035;
    this.scene.add(this.light, this.light.target);
    this.quality();
    this.run = previous ? structuredClone(previous) : newRun(index, ...w.spawn);
    this.hero = createActor('hero');
    this.scene.add(this.hero.group);
    if (blocked(this.run.x, w.heightAt(this.run.x, this.run.z), this.run.z, 0.34, w.blockers)) {
      [this.run.x, this.run.z] = w.spawn;
    }
    this.heroAngle = this.run.yaw;
    this.standing = w.heightAt(this.run.x, this.run.z);
    this.scene.add(this.stageProp, this.optionalProp);
    this.setGoal();
    this.optionalProp.add(w.keepsake);
    this.locate(this.optionalProp, ...w.optional);
    this.optionalProp.visible = !this.run.optional;
    for (let i = 0; i < 2; i++) {
      const base = i === 0 ? w.spawn : w.objectives[1];
      const pos = this.freeSpot(base[0] + 2.1, base[1] + 1.5);
      const p = new T.Group();
      this.addKit(p);
      this.locate(p, ...pos);
      p.visible = !this.run.supplies.includes(i);
      this.scene.add(p);
      this.pickups.push(p);
    }
    const count = index === 0 ? 0 : Math.min(w.encounters.length, 1 + Math.floor((index + 1) / 2));
    for (let i = 0; i < count; i++) {
      if (this.run.defeated.includes(i)) continue;
      const a = createActor('hostile', i);
      this.locate(a.group, ...w.encounters[i]);
      this.scene.add(a.group);
      this.enemies.push({
        actor: a,
        id: i,
        home: w.encounters[i],
        hp: 2 + (index > 5 ? 1 : 0),
        state: 'idle',
        timer: 2 + i * 0.7,
        fire: 0,
        hit: 0,
        pace: 0,
      });
    }
    const near = w.spawn;
    for (let i = 0; i < (index === 0 ? 2 : 1); i++) {
      const a = createActor('civilian', index + i + 1);
      let [x, z] = this.freeSpot(near[0] + (i ? 3 : -2.6), near[1] - 1.5);
      this.locate(a.group, x, z);
      a.group.rotation.y = i ? 2 : -1;
      this.scene.add(a.group);
      this.people.push(a);
    }
    const geo = new T.IcosahedronGeometry(0.07, 0),
      material = new T.MeshBasicMaterial({ color: 0xfcce82 });
    this.disposable.push(geo, material);
    for (let i = 0; i < 22; i++) {
      const mesh = new T.Mesh(geo, material);
      mesh.visible = false;
      this.scene.add(mesh);
      this.fxPool.push({ mesh, t: 0, total: 0, vel: V() });
    }
    if (missions[index].goals.slice(0, this.run.stage).some((g) => g.kind === 'rescue'))
      this.addEscort();
    this.crateEffect();
    this.actorShadows();
    this.resize();
    this.tick(0);
  }
  private locate(o: T.Object3D, x: number, z: number) {
    o.position.set(x, this.world.heightAt(x, z), z);
  }
  private freeSpot(x: number, z: number): [number, number] {
    for (let radius = 0; radius < 5; radius += 0.6)
      for (let a = 0; a < 6.28; a += 0.7) {
        const xx = x + Math.sin(a) * radius,
          zz = z + Math.cos(a) * radius;
        if (!blocked(xx, this.world.heightAt(xx, zz), zz, 0.42, this.world.blockers)) return [xx, zz];
      }
    return [...this.world.spawn];
  }
  private addKit(parent: T.Group) {
    const mat = new T.MeshStandardMaterial({ color: 0x648477, roughness: 0.83 }),
      trim = new T.MeshStandardMaterial({ color: 0x463a2b, roughness: 0.68 });
    this.disposable.push(mat, trim);
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, m: T.Material) => {
      const geo = new T.BoxGeometry(w, h, d);
      this.disposable.push(geo);
      const mesh = new T.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    };
    box(0, 0.19, 0, 0.58, 0.36, 0.38, mat);
    box(0, 0.38, 0, 0.48, 0.04, 0.31, trim);
    box(0, 0.2, -0.2, 0.25, 0.045, 0.02, trim);
    box(0, 0.2, -0.21, 0.05, 0.21, 0.02, trim);
  }
  private setGoal() {
    this.world.setStage(this.run.stage);
    if (this.goalPerson) {
      this.stageProp.remove(this.goalPerson.group);
      this.goalPerson.dispose();
      this.goalPerson = undefined;
    }
    this.stageProp.clear();
    const g = missions[this.run.index].goals[this.run.stage];
    this.locate(this.stageProp, ...this.world.objectives[this.run.stage]);
    if (['talk', 'rescue', 'shelter'].includes(g.kind)) {
      this.goalPerson = createActor('civilian', this.run.index + this.run.stage);
      this.goalPerson.group.rotation.y = Math.PI;
      this.stageProp.add(this.goalPerson.group);
    }
  }
  quality() {
    const q = this.opts.quality;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.software ? [0.52, 0.65, 0.85, 1][q] : 2, [0.86, 1.1, 1.55, 2][q]),
    );
    this.renderer.shadowMap.enabled = q > 0;
    this.light.shadow.mapSize.setScalar(q >= 3 ? 2048 : 1024);
    this.light.shadow.map?.dispose();
    this.light.shadow.map = null;
    this.renderer.toneMappingExposure = this.world.night ? 1.12 : 1.0;
    const version = ++this.filmVersion;
    this.film?.dispose();
    this.film = undefined;
    if (q >= 2 && !this.software)
      void import('./effects')
        .then(({ filmPass }) => {
          if (this.filmVersion === version) {
            this.film = filmPass(this.renderer, this.scene, this.camera, q);
            this.film.resize();
          }
        })
        .catch(() => {});
  }
  resize() {
    const width = innerWidth,
      height = innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.film?.resize();
  }
  look(dx: number, dy: number, touch = false) {
    if (!this.active) return;
    const s = (touch ? this.opts.touchSensitivity : this.opts.sensitivity) * 0.003;
    this.run.yaw -= dx * s;
    this.pitch = clamp(this.pitch + dy * s, -0.68, 0.95);
  }
  start() {
    this.intro = false;
    this.active = true;
    this.release();
    this.cameraReady = false;
    this.callback.save(this.run);
  }
  release() {
    this.held.clear();
    this.joy = { x: 0, y: 0 };
    this.aim = false;
    this.fireHeld = false;
    this.touchSprint = false;
  }
  action(name: string) {
    if (!this.active) return;
    const r = this.run;
    if (name === 'reload' && !this.reloadTime && r.ammo < capacities[r.tool] && r.reserve > 0) {
      this.reloadTime = 1.55;
      this.sound.fx('reload');
    }
    if (name === 'crouch') this.crouch = !this.crouch;
    if (name === 'jump' && this.alt <= 0.01) {
      this.vertical = 5.5;
      this.alt = 0.015;
      this.climbing = false;
      const nx = r.x - Math.sin(r.yaw) * 0.78,
        nz = r.z - Math.cos(r.yaw) * 0.78;
      const floor = this.world.heightAt(r.x, r.z);
      const step = this.world.blockers.find(
        (b) =>
          nx >= b.min.x - 0.1 &&
          nx <= b.max.x + 0.1 &&
          nz >= b.min.z - 0.1 &&
          nz <= b.max.z + 0.1 &&
          b.max.y > this.standing + 0.24 &&
          b.max.y - floor < 1.35,
      );
      if (step) {
        this.vertical = 6.25;
        this.climbing = true;
      }
    }
    if (name === 'heal' && r.kits && r.health < 100) {
      r.kits--;
      r.health = Math.min(100, r.health + 50);
      this.sound.fx('pick');
      this.callback.notify('استُخدمت حقيبة الإسعاف');
      this.callback.save(r);
    }
    if (name === 'weapon' && r.index > 0) {
      const old = r.ammo;
      r.tool = 1 - r.tool;
      r.reserve += old;
      r.ammo = Math.min(capacities[r.tool], r.reserve);
      r.reserve -= r.ammo;
      this.reloadTime = 0;
      this.callback.notify(r.tool ? 'مطلق النبض' : 'بندقية الحارس');
    }
    if (name === 'interact') this.interact();
  }
  private sense() {
    const r = this.run,
      d = (p: T.Object3D) => dist(r.x, r.z, p.position.x, p.position.z);
    this.near = '';
    this.nearIndex = -1;
    if (d(this.stageProp) < 2.7) {
      this.near = 'goal';
      return;
    }
    if (this.optionalProp.visible && d(this.optionalProp) < 2.5) {
      this.near = 'optional';
      return;
    }
    this.nearIndex = this.pickups.findIndex((p) => p.visible && d(p) < 2);
    if (this.nearIndex >= 0) this.near = 'kit';
  }
  private interact() {
    this.sense();
    const r = this.run,
      m = missions[r.index];
    this.gesture = 1;
    if (this.near === 'optional') {
      r.optional = true;
      this.optionalProp.visible = false;
      this.callback.line(m.memory);
      this.sound.fx('pick');
      this.callback.notify('عُثر على ذكرى عائلية');
      this.callback.save(r);
    }
    if (this.near === 'kit') {
      this.pickups[this.nearIndex].visible = false;
      r.supplies.push(this.nearIndex);
      r.kits = Math.min(9, r.kits + 1);
      r.reserve = Math.min(240, r.reserve + 18);
      this.sound.fx('pick');
      this.callback.notify('جُمعت مؤن وإسعافات');
      this.callback.save(r);
    }
    if (this.near === 'goal') {
      const g = m.goals[r.stage];
      if (
        this.escort &&
        dist(this.escort.group.position.x, this.escort.group.position.z, r.x, r.z) > 5
      ) {
        this.callback.notify('انتظر رفيقك عند الهدف');
        return;
      }
      if (g.kind === 'rescue' && this.goalPerson) {
        const escort = this.goalPerson;
        this.stageProp.updateMatrixWorld();
        this.scene.attach(escort.group);
        this.goalPerson = undefined;
        this.addEscort(escort);
        r.rescues++;
        this.callback.notify('تم إنقاذ المدنيين');
      } else if (g.kind === 'shelter' && !this.escort) {
        r.rescues++;
        this.callback.notify('تم إنقاذ المدنيين');
      }
      this.callback.line(g.line);
      this.sound.fx('rescue');
      r.stage++;
      if (r.stage === 3) {
        this.world.setStage(3);
        this.active = false;
        this.release();
        this.callback.finish(structuredClone(r));
        return;
      }
      this.setGoal();
      this.callback.save(r);
      this.callback.notify('نقطة حفظ جديدة');
    }
    this.sense();
  }
  private sparks(p: T.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const o = this.fxPool[this.fxCursor++ % this.fxPool.length];
      o.t = o.total = 0.18 + Math.random() * 0.23;
      o.mesh.position.copy(p);
      o.mesh.scale.setScalar(0.5 + Math.random());
      o.mesh.visible = true;
      o.vel.set((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3);
    }
  }
  private shoot() {
    if (this.run.index === 0 || this.reloadTime || this.cooldown) return;
    const r = this.run;
    if (!r.ammo) {
      this.action('reload');
      this.cooldown = 0.3;
      return;
    }
    this.cooldown = r.tool ? 0.65 : 0.23;
    this.flash = 0.15;
    r.ammo--;
    r.shots++;
    this.sound.fx('shot');
    if (this.opts.vibrate && matchMedia('(pointer:coarse)').matches) navigator.vibrate?.(20);
    const start = this.camera.position,
      dir = this.camera.getWorldDirection(V()),
      far = start.clone().addScaledVector(dir, 86);
    let best = 86 * clipSegment(start, far, this.world.blockers, 0);
    let target: Npc | undefined;
    const intersection = (group: T.Object3D) => {
      const pt = group.getWorldPosition(V()).add(V(0, 1.12, 0)),
        delta = pt.sub(start),
        d = delta.dot(dir);
      return d > 0 && delta.addScaledVector(dir, -d).length() < (r.tool ? 0.88 : 0.68) ? d : Infinity;
    };
    // Civilian silhouettes absorb the effect; only active hostile entities can take damage.
    for (const c of [
      ...this.people,
      ...(this.goalPerson ? [this.goalPerson] : []),
      ...(this.escort ? [this.escort] : []),
      ...this.enemies.filter((e) => e.state === 'surrender').map((e) => e.actor),
    ])
      best = Math.min(best, intersection(c.group));
    for (const n of this.enemies) {
      if (n.state === 'surrender') continue;
      const d = intersection(n.actor.group);
      if (d < best) {
        best = d;
        target = n;
      }
    }
    const hit = start.clone().addScaledVector(dir, best),
      muzzle = this.hero.group.position
        .clone()
        .add(V(-Math.sin(r.yaw) * 0.55, 1.29, -Math.cos(r.yaw) * 0.55));
    if (clipSegment(muzzle, hit, this.world.blockers, 0.02) < 0.97) target = undefined;
    if (this.crate) {
      const impact = new T.Raycaster(start, dir, 0, best).intersectObject(this.crate, true)[0];
      if (impact) {
        hit.copy(impact.point);
        target = undefined;
        this.breakCrate();
      }
    }
    this.sparks(muzzle, 3);
    this.sparks(hit, target ? 6 : 3);
    if (target) {
      target.hp -= r.tool ? 2 : 1;
      target.hit = 0.32;
      target.state = target.hp <= 0 ? 'surrender' : 'retreat';
      target.timer = 2.2;
      if (target.hp <= 0) {
        r.defeated.push(target.id);
        target.pace = 0;
        this.callback.notify('استسلم الخصم');
      }
    }
    for (const n of this.enemies)
      if (n.state === 'idle' || n.state === 'patrol') {
        n.state = 'alert';
        n.timer = 0.9;
      }
  }
  private ai(dt: number) {
    const r = this.run;
    for (const n of this.enemies) {
      const p = n.actor.group.position;
      if (n.state === 'surrender') continue;
      n.timer -= dt;
      const d = dist(p.x, p.z, r.x, r.z);
      const eye = V(p.x, p.y + 1.4, p.z),
        to = V(r.x, this.standing + (this.crouch ? 0.84 : 1.45), r.z);
      const visible =
        d < (this.crouch ? 12 : 19) + r.index * 0.45 &&
        clipSegment(eye, to, this.world.blockers, 0.025) > 0.98;
      if (n.state === 'retreat' && n.timer <= 0) {
        n.state = 'patrol';
        n.timer = 1.8;
      }
      if (n.state !== 'retreat' && visible && n.state !== 'alert') {
        n.state = 'alert';
        n.timer = [2.9, 2.1, 1.45][this.opts.difficulty];
      }
      if (n.state === 'alert' && !visible) {
        n.state = 'patrol';
        n.timer = 1.75;
      }
      if (n.state === 'idle' && n.timer <= 0) {
        n.state = 'patrol';
        n.timer = 3;
      }
      let tx = n.home[0] + Math.sin(this.elapsed * 0.22 + n.id) * 3,
        tz = n.home[1] + Math.cos(this.elapsed * 0.18 + n.id) * 2.7;
      n.pace = n.state === 'patrol' ? 0.74 : 0;
      if (n.state === 'retreat') {
        tx = p.x + (p.x - r.x);
        tz = p.z + (p.z - r.z);
        n.pace = 2.15;
      }
      if (n.state === 'alert') {
        tx = r.x;
        tz = r.z;
        n.pace = d > 9 ? 1.16 : 0;
        n.actor.group.rotation.y = Math.atan2(p.x - r.x, p.z - r.z);
        if (n.timer <= 0) {
          n.fire = 0.19;
          n.timer = [3.4, 2.8, 2.25][this.opts.difficulty] + Math.random();
          this.sound.fx('shot', clamp((p.x - r.x) / 15, -0.9, 0.9));
          const chance =
            [0.32, 0.47, 0.63][this.opts.difficulty] *
            (this.crouch ? 0.57 : 1) *
            (this.stride > 4 ? 0.65 : 1);
          if (Math.random() < chance) {
            r.health = Math.max(
              0,
              r.health - ([7, 10, 13][this.opts.difficulty] + Math.floor(r.index / 3)),
            );
            this.hurt = 0.35;
            this.sound.fx('hit');
            if (!r.health) {
              this.active = false;
              this.release();
              this.callback.fail();
              return;
            }
          }
        }
      }
      if (n.pace) {
        const [dx, dz] = steer(p.x, p.z, tx, tz, p.y, this.world.blockers, n.id % 2 ? 1 : -1);
        const [x, z] = slide(
          p.x,
          p.z,
          dx * n.pace * dt,
          dz * n.pace * dt,
          p.y,
          this.world.bounds,
          this.world.blockers,
        );
        this.locate(n.actor.group, x, z);
        if (n.state !== 'alert') n.actor.group.rotation.y = Math.atan2(-dx, -dz);
      }
    }
  }
  private updatePlayer(dt: number) {
    const r = this.run,
      k = this.opts.keys,
      h = this.held,
      w = this.world;
    let x = +h.has(k.right) - +h.has(k.left) + this.joy.x,
      z = +h.has(k.up) - +h.has(k.down) - this.joy.y;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    const sprint = (h.has(k.sprint) || this.touchSprint) && !this.crouch && !this.aim;
    this.stride = (sprint ? 6.35 : this.crouch ? 1.65 : this.aim ? 2.1 : 3.65) * Math.min(1, len);
    const sin = Math.sin(r.yaw),
      cos = Math.cos(r.yaw),
      speed = sprint ? 6.35 : this.crouch ? 1.65 : this.aim ? 2.1 : 3.65;
    const dx = (x * cos - z * sin) * speed * dt,
      dz = (-x * sin - z * cos) * speed * dt;
    if (len > 0.02 || this.climbing) {
      [r.x, r.z] = slide(
        r.x,
        r.z,
        dx - (this.climbing ? sin * 1.9 * dt : 0),
        dz - (this.climbing ? cos * 1.9 * dt : 0),
        this.standing,
        w.bounds,
        w.blockers,
      );
    }
    const ground = w.heightAt(r.x, r.z);
    let surface = ground;
    for (const b of w.blockers)
      if (
        b.max.y <= this.standing + 0.15 &&
        b.max.y > surface &&
        r.x > b.min.x - 0.02 &&
        r.x < b.max.x + 0.02 &&
        r.z > b.min.z - 0.02 &&
        r.z < b.max.z + 0.02
      )
        surface = b.max.y;
    if (this.alt || this.vertical || this.standing > surface + 0.1) {
      this.vertical -= 13.6 * dt;
      this.standing += this.vertical * dt;
      this.alt = Math.max(0, this.standing - surface);
      if (this.standing <= surface) {
        this.standing = surface;
        this.vertical = 0;
        this.alt = 0;
        this.climbing = false;
      }
    } else this.standing = surface;
    const target =
      this.aim || this.fireHeld ? r.yaw : len > 0.02 ? Math.atan2(-dx, -dz) : this.heroAngle;
    this.heroAngle +=
      Math.atan2(Math.sin(target - this.heroAngle), Math.cos(target - this.heroAngle)) *
      (1 - Math.exp(-13 * dt));
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.gesture = Math.max(0, this.gesture - dt);
    if (this.reloadTime) {
      this.reloadTime = Math.max(0, this.reloadTime - dt);
      if (!this.reloadTime) {
        const qty = Math.min(capacities[r.tool] - r.ammo, r.reserve);
        r.ammo += qty;
        r.reserve -= qty;
      }
    }
    if (this.fireHeld) this.shoot();
    this.pressure += this.stride * dt;
    if (this.pressure > 2.05 && !this.alt) {
      this.sound.fx(r.index === 3 ? 'rock' : 'step');
      this.pressure = 0;
    }
    this.follow(dt);
    if (!this.sceneBeat && [1, 4, 6].includes(r.index) && r.stage > 0 && r.z < 5) {
      this.sceneBeat = true;
      const collapse = V(7, this.world.heightAt(7, -20) + 3, -20);
      this.sparks(collapse, 16);
      this.sound.fx('boom', 0.55);
      for (const n of this.enemies)
        if (n.state === 'patrol' || n.state === 'idle') {
          n.state = 'retreat';
          n.timer = 1.2;
        }
    }
    this.lastAi += dt;
    if (this.lastAi >= 0.1) {
      this.ai(this.lastAi);
      this.lastAi = 0;
    }
    this.sense();
    if (r.stage > 0 && r.seconds > this.nextLine) {
      this.callback.line(missions[r.index].dialogue[1]);
      this.nextLine = Infinity;
    }
  }
  private setCamera(dt: number) {
    const r = this.run;
    const anchor = V(r.x, this.standing + (this.crouch ? 1.12 : 1.67), r.z);
    const y = r.yaw + (this.intro ? 0.22 * Math.cos(this.cinematic * 0.28) : 0),
      back = this.aim ? 2.08 : this.intro ? 5.0 : 3.65,
      side = this.aim ? 0.52 : 0.64;
    const fwd = V(
      -Math.sin(y) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      -Math.cos(y) * Math.cos(this.pitch),
    );
    const offset = V(Math.cos(y) * side, 0, -Math.sin(y) * side);
    const wanted = anchor.clone().addScaledVector(fwd, -back).add(offset);
    wanted.y += this.aim ? 0.06 : 0.39;
    const camera = this.camera,
      dtMix = 1 - Math.exp(-14 * dt);
    const candidate = this.cameraReady ? camera.position.clone().lerp(wanted, dtMix) : wanted;
    const length = clipSegment(anchor, candidate, this.world.blockers, 0.23);
    camera.position.copy(anchor).lerp(candidate, length);
    camera.position.y = Math.max(
      camera.position.y,
      this.world.heightAt(camera.position.x, camera.position.z) + 0.24,
    );
    camera.lookAt(anchor.clone().add(offset).addScaledVector(fwd, 15));
    this.cameraReady = true;
    const fov = this.aim ? 39 : 55;
    if (Math.abs(camera.fov - fov) > 0.03) {
      camera.fov += (fov - camera.fov) * dtMix;
      camera.updateProjectionMatrix();
    }
  }
  tick(delta: number) {
    const dt = Math.max(0, Math.min(0.2, delta));
    this.elapsed += dt;
    this.cinematic += dt;
    if (this.active) {
      this.run.seconds += delta;
      const steps = Math.max(1, Math.ceil(dt / 0.04));
      for (let i = 0; i < steps && this.active; i++) this.updatePlayer(dt / steps);
    }
    if (this.run.stage >= 3) return;
    const p = this.hero.group.position,
      r = this.run;
    p.set(r.x, this.standing, r.z);
    this.hero.group.rotation.y = this.heroAngle;
    this.hero.update(dt, {
      speed: this.active ? this.stride : 0,
      peaceful: this.run.index === 0,
      sprint: this.stride > 4,
      crouch: this.crouch,
      aim: this.aim,
      fire: this.flash * 6,
      reload: this.reloadTime ? Math.sin((this.reloadTime / 1.55) * Math.PI) : 0,
      hit: this.hurt * 2,
      interact: this.gesture,
      jump: Math.min(1, this.alt),
      climb: this.climbing,
    });
    this.escort?.update(dt, { speed: this.escortSpeed });
    this.goalPerson?.update(dt, { speed: 0, interact: this.gesture });
    for (const a of this.people) a.update(dt, { speed: 0 });
    for (const n of this.enemies) {
      n.fire = Math.max(0, n.fire - dt);
      n.hit = Math.max(0, n.hit - dt);
      n.actor.update(dt, {
        speed: this.active ? n.pace : 0,
        aim: n.state === 'alert',
        fire: n.fire * 5,
        hit: n.hit * 3,
        surrender: n.state === 'surrender',
      });
    }
    for (const fx of this.fxPool)
      if (fx.t > 0) {
        fx.t -= dt;
        fx.vel.y -= 5 * dt;
        fx.mesh.position.addScaledVector(fx.vel, dt);
        fx.mesh.visible = fx.t > 0;
      }
    this.light.target.position.set(r.x, 0, r.z);
    this.light.position.set(r.x - 34 + Math.sin(this.elapsed / 90) * 2, 46, r.z - 42);
    for (const s of this.shards)
      if (s.age > 0) {
        s.age -= dt;
        s.velocity.y -= 7 * dt;
        s.mesh.position.addScaledVector(s.velocity, dt);
        s.mesh.rotation.x += dt * 1.8;
        const ground = this.world.heightAt(s.mesh.position.x, s.mesh.position.z) + 0.055;
        if (s.mesh.position.y < ground) {
          s.mesh.position.y = ground;
          s.velocity.set(0, 0, 0);
          s.age = 0;
        }
      }
    this.setCamera(dt);
    this.shadeActors();
    this.world.update(this.elapsed, dt);
    if (this.film) this.film.render();
    else this.renderer.render(this.scene, this.camera);
    this.frames++;
    this.frameSample += delta;
    if (this.frameSample >= 1) {
      this.fps = this.frames / this.frameSample;
      this.frames = 0;
      this.frameSample = 0;
      if (this.active) {
        this.fpsSamples.push(this.fps);
        if (this.fpsSamples.length > 90) this.fpsSamples.shift();
        this.slow = this.fps < 26 ? this.slow + 1 : 0;
        if (this.slow >= 2 && this.renderer.getPixelRatio() > (this.software ? 0.34 : 0.55) + 0.015) {
          this.renderer.setPixelRatio(
            Math.max(this.software ? 0.34 : 0.55, this.renderer.getPixelRatio() * 0.84),
          );
          this.film?.resize();
          this.slow = 0;
        }
      }
    }
    this.hudClock += dt;
    if (this.hudClock > 0.065 && this.active) {
      this.hudClock = 0;
      this.callback.hud(this);
    }
  }
  goalScreen() {
    const [x, z] = this.world.landmarks[this.run.stage];
    this.marker.set(x, this.world.heightAt(x, z) + (this.goalPerson ? 2.45 : 1.85), z);
    this.marker.project(this.camera);
    return this.marker;
  }
  dispose() {
    this.filmVersion++;
    this.film?.dispose();
    this.release();
    this.active = false;
    this.hero.dispose();
    this.escort?.dispose();
    this.goalPerson?.dispose();
    this.contact.userData.map.dispose();
    this.contact.dispose();
    this.people.forEach((a) => a.dispose());
    this.enemies.forEach((n) => n.actor.dispose());
    this.world.dispose();
    this.disposable.forEach((a) => a.dispose());
    this.light.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
