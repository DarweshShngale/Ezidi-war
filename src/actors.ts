// Original articulated character art. Dimensions are in metres; local forward is -Z.
import * as THREE from 'three';

type CharacterKind = 'hero' | 'civilian' | 'hostile';
type Point = [number, number, number];
type Ring = [number, number, number, number?];
type Finish = 'cotton' | 'skin' | 'hair' | 'scarf' | 'leather' | 'canvas' | 'metal' | 'smooth';
const finishes: Finish[] = ['cotton', 'skin', 'hair', 'scarf', 'leather', 'canvas', 'metal', 'smooth'];
const tau = Math.PI * 2;

export interface ActorState {
  speed: number;
  sprint?: boolean;
  peaceful?: boolean;
  crouch?: boolean;
  aim?: boolean;
  fire?: number;
  reload?: number;
  hit?: number;
  interact?: number;
  jump?: number;
  surrender?: boolean;
  climb?: boolean;
}

let atlas: THREE.DataTexture | undefined;
let surface: THREE.MeshStandardMaterial | undefined;
let users = 0;

// A shared eight-swatch atlas supplies the weave, stipple, leather grain and scarf embroidery.
function wardrobe() {
  if (surface) return surface;
  const tile = 128, width = tile * 4, height = tile * 2;
  const pixels = new Uint8Array(width * height * 4);
  let seed = 104717;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 4294967296;
    const u = x % tile, v = y % tile;
    const slot = Math.floor(x / tile) + Math.floor(y / tile) * 4;
    const weave = Math.cos(u * Math.PI) * Math.cos(v * Math.PI);
    const grain = Math.sin(u * .21 + Math.sin(v * .14) * 2);
    let c = 242 + noise * 12, r = c, g = c, b = c;
    switch (slot) {
      case 0: c = 226 + weave * 10 + noise * 14 + 5 * Math.sin(v * 3.1); break;
      case 1: c = 244 + noise * 9 + 2 * grain; break;
      case 2: c = 207 + 22 * Math.sin(u * 2.9 + Math.sin(v * .084) * 1.4) + noise * 22; break;
      case 3: {
        const diamond = Math.min((u + v) % 32, (u - v + tile * 3) % 32);
        const stripe = u % 48 < 4 || v % 48 < 4;
        const thread = noise * 12 + weave * 5;
        const paleThread = diamond < 5 || stripe || Math.abs((u % 32)-16) + Math.abs((v % 32)-16) < 5;
        r = (paleThread ? 235 : 154) + thread;
        g = (paleThread ? 212 : 41) + thread;
        b = (paleThread ? 184 : 38) + thread;
        break;
      }
      case 4: c = 218 + grain * 8 + noise * 24; break;
      case 5: c = 217 + weave * 9 + (v % 4 < 2 ? 13 : 0) + noise * 17; break;
      case 6: c = 233 + noise * 14 + 4 * grain; break;
      case 7: c = 255; break;
    }
    if (slot !== 3) r = g = b = c;
    const i = (y * width + x) * 4;
    pixels[i] = Math.min(255, r); pixels[i + 1] = Math.min(255, g);
    pixels[i + 2] = Math.min(255, b); pixels[i + 3] = 255;
  }
  atlas = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.magFilter = THREE.LinearFilter;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  atlas.needsUpdate = true;
  surface = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: .86 });
  return surface;
}

class Sculpt {
  bones: THREE.Bone[] = [];
  positions: number[] = [];
  colors: number[] = [];
  uv: number[] = [];
  joints: number[] = [];
  triangles: number[] = [];
  bone(name: string, parent: THREE.Bone | null, x: number, y: number, z: number) {
    const b = new THREE.Bone();
    b.name = name; b.position.set(x, y, z); parent?.add(b);
    b.updateWorldMatrix(true, false); this.bones.push(b);
    return b;
  }
  // A shaped ring surface supports asymmetric silhouettes, seams and sculpted folds.
  shell(b: THREE.Bone, p: Point, rings: Ring[], color: string, finish: Finish, segments = 20,
        shape?: (a: number, f: number, point: Point) => void) {
    const start = this.positions.length / 3;
    const origin = b.getWorldPosition(new THREE.Vector3());
    const tint = new THREE.Color(color);
    const index = this.bones.indexOf(b);
    const slot = finishes.indexOf(finish), tileX = slot % 4, tileY = Math.floor(slot / 4);
    for (let j = 0; j < rings.length; j++) {
      const [y, rx, rz, dz = 0] = rings[j];
      const f = j / (rings.length - 1);
      for (let k = 0; k <= segments; k++) {
        const a = tau * k / segments;
        const point: Point = [rx * Math.sin(a), y, rz * Math.cos(a) + dz];
        shape?.(a, f, point);
        this.positions.push(point[0] + p[0] + origin.x, point[1] + p[1] + origin.y, point[2] + p[2] + origin.z);
        const shade = .89 + .09 * Math.min(1, f * 3) + .025 * Math.cos(a - .7);
        this.colors.push(tint.r * shade, tint.g * shade, tint.b * shade);
        this.uv.push((tileX + .012 + .976 * k / segments) / 4, (tileY + .012 + .976 * f) / 2);
        this.joints.push(index, 0, 0, 0);
        if (j < rings.length - 1 && k < segments) {
          const v = start + j * (segments + 1) + k;
          const n = v + segments + 1;
          this.triangles.push(v, v + 1, n, v + 1, n + 1, n);
        }
      }
    }
  }
  oval(b: THREE.Bone, p: Point, scale: Point, color: string, finish: Finish = 'smooth', segments = 14) {
    const rings: Ring[] = Array.from({length: 9}, (_, i) => {
      const a = -Math.PI / 2 + i * Math.PI / 8;
      return [Math.sin(a) * scale[1], Math.max(.0001, Math.cos(a)) * scale[0], Math.max(.0001, Math.cos(a)) * scale[2]];
    });
    this.shell(b, p, rings, color, finish, segments);
  }
  box(b: THREE.Bone, p: Point, size: Point, color: string, finish: Finish = 'canvas') {
    const [w,h,d] = size;
    this.shell(b, p, [[-h/2,.0001,.0001],[-h/2,w*.91,d*.91],[-h*.4,w,d],[h*.39,w,d],[h/2,w*.9,d*.9],[h/2,.0001,.0001]], color, finish, 16,
      (_a, _f, pt) => {
        pt[0] = Math.sign(pt[0]) * Math.pow(Math.abs(pt[0]) / w, .48) * w/2;
        pt[2] = Math.sign(pt[2]) * Math.pow(Math.abs(pt[2]) / d, .48) * d/2;
      });
  }
  // Convert a polyline to a narrow tube for straps, piping and stitches.
  cord(b: THREE.Bone, path: Point[], radius: number, color: string, finish: Finish = 'cotton') {
    const geom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(...p))),
        Math.max(6, path.length * 2), radius, 5, false);
    const pos = geom.getAttribute('position'), uv = geom.getAttribute('uv');
    const origin = b.getWorldPosition(new THREE.Vector3()), tint = new THREE.Color(color);
    const base = this.positions.length/3, slot = finishes.indexOf(finish), boneIndex = this.bones.indexOf(b);
    for (let j = 0; j < pos.count; j++) {
      this.positions.push(pos.getX(j)+origin.x, pos.getY(j)+origin.y, pos.getZ(j)+origin.z);
      this.colors.push(tint.r, tint.g, tint.b);
      this.uv.push((slot%4+.012+.976*uv.getX(j))/4,(Math.floor(slot/4)+.012+.976*uv.getY(j))/2);
      this.joints.push(boneIndex,0,0,0);
    }
    const idx = geom.getIndex()!;
    for (let j = 0; j < idx.count; j++) this.triangles.push(base + idx.getX(j));
    geom.dispose();
  }
  finish() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.joints, 4));
    const weights = new Float32Array(this.joints.length);
    for (let i = 0; i < weights.length; i += 4) weights[i] = 1;
    g.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4)); g.setIndex(this.triangles);
    g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
}

// Slightly irregular cloth rings catch light across elbows, knees and cloth gathers.
function clothFolds(a: number, f: number, point: Point) {
  const wav = 1 + .043 * Math.sin(a * 5 + f * 2.5) + .019 * Math.sin(9*a-f);
  point[0] *= wav; point[2] *= wav;
  point[1] += .007 * Math.sin(a * 2 + f * 7) * Math.sin(f*Math.PI);
}

function face(art: Sculpt, head: THREE.Bone, skin: string, hair: string, bearded: boolean, wrap: boolean) {
  const shape: Ring[] = [[.003,.02,.027,-.024],[.018,.044,.056,-.022],[.038,.067,.069,-.014],
    [.066,.083,.082,-.005],[.101,.09,.087],[.137,.089,.088,.003],[.169,.088,.088,.008],
    [.199,.081,.083,.011],[.222,.063,.071,.012],[.236,.031,.04,.01],[.24,.002,.003,.01]];
  art.shell(head,[0,0,0],shape,skin,'skin',32);
  for (const s of [-1,1]) {
    art.oval(head,[s*.087,.106,.003],[.016,.025,.013],skin,'skin',12);
    art.oval(head,[s*.096,.105,-.002],[.008,.014,.008],'#b4755c','skin',10);
    art.oval(head,[s*.039,.121,-.075],[.022,.009,.009],'#c9b4a1','skin');
    art.oval(head,[s*.036,.121,-.082],[.008,.007,.005],'#352920','smooth');
    art.cord(head,[[s*.017,.136,-.086],[s*.036,.142,-.082],[s*.057,.139,-.069]],.0046,hair,'hair');
    art.cord(head,[[s*.018,.122,-.085],[s*.037,.128,-.086],[s*.058,.123,-.073]],.0021,'#865745','skin');
  }
  art.shell(head,[0,0,-.077],[[.077,.014,.01,-.01],[.087,.019,.016,-.012],[.097,.015,.021,-.01],[.12,.009,.013],[.134,.009,.006]],skin,'skin',16);
  art.oval(head,[0,.062,-.085],[.024,.005,.006],'#a56b5d','skin');
  // Conform the hair and beard to the face even at a sloping hairline.
  function followSkull(a: number, y: number, margin: number, point: Point) {
    const i = Math.max(1, shape.findIndex(ring => ring[0] >= y));
    const lo = shape[i-1], hi = shape[i];
    const t = THREE.MathUtils.clamp((y-lo[0])/(hi[0]-lo[0]),0,1);
    const rx = THREE.MathUtils.lerp(lo[1],hi[1],t) + margin;
    const rz = THREE.MathUtils.lerp(lo[2],hi[2],t) + margin;
    point[0] = Math.sin(a)*rx;
    point[1] = y;
    point[2] = Math.cos(a)*rz + THREE.MathUtils.lerp(lo[3]||0,hi[3]||0,t);
  }
  const layers: Ring[] = Array.from({length:9},(_,i)=>[i/8,1,1]);
  art.shell(head,[0,0,0],layers,hair,'hair',36,(a,f,pt) => {
    const front = (1-Math.cos(a))/2;
    const taper = .012*Math.abs(Math.sin(a)) - .009*Math.cos(2*a-.4);
    const line = .050 + .118 * front**1.3 + taper + .003*Math.sin(7*a);
    const level = THREE.MathUtils.lerp(line,.239,f);
    followSkull(a,level,.0022 + .004*Math.sin(f*Math.PI),pt);
    pt[1] += f*f*.01;
  });
  // Swept locks follow the crown in irregular curved ribbons; their relief reads in a rear view.
  if (!wrap) {
    for (let i=0; i<19; i++) {
      const a = i/19*tau + .12, path: Point[]=[];
      const front = (1-Math.cos(a))/2, bottom=.068+front*.114;
      for (let k=0;k<7;k++) {
        const u=k/6;
        const point: Point=[0,0,0];
        const y=THREE.MathUtils.lerp(.226+.005*Math.sin(i*4),bottom+.007*Math.sin(i*2.3),u);
        followSkull(a+(.47+.1*Math.sin(i))*Math.pow(1-u,2),y,.005,point);
        point[1] += .006*(1-u);
        path.push(point);
      }
      art.cord(head,path,i%3===0?.0038:.0022,i%3===0?'#4d4036':'#3e352e','hair');
    }
  }
  if (bearded) {
    art.shell(head,[0,0,0],layers,hair,'hair',34,(a,f,pt) => {
      const side = Math.abs(Math.sin(a)), back=Math.max(0,Math.cos(a));
      const edge = .054 + side**2.8*.074 - .046*back;
      const level = THREE.MathUtils.lerp(.004,edge,f);
      followSkull(a,level,.0024 - .012*back,pt);
      pt[1] -= .003*(1-f);
    });
    for (const s of [-1,1]) art.cord(head,[[s*.002,.077,-.093],[s*.014,.075,-.091],[s*.027,.068,-.084]],.0048,hair,'hair');
  }
  if (wrap) {
    art.shell(head,[0,0,.012],[[.056,.091,.082],[.126,.1,.099],[.181,.1,.1],[.219,.089,.092],
      [.242,.059,.067],[.249,.003,.002]],'#bdb9a7','cotton',28,(a,f,pt) => {
        pt[1] += (1-f)**2*.122*Math.max(0,-Math.cos(a));
        pt[2] += .013*(1-f);
      });
  }
}

function neckScarf(art: Sculpt, spine: THREE.Bone, hero: boolean, second: boolean) {
  const shade = hero ? '#ffead4' : second ? '#7f948f' : '#929182';
  const finish: Finish = hero ? 'scarf' : 'cotton';
  art.shell(spine,[0,.437,0],[[-.059,.135,.1],[-.038,.153,.111],[-.022,.14,.119],[.003,.124,.11],
    [.02,.115,.101],[.039,.105,.087],[.048,.078,.071]],shade,finish,32,(a,f,pt) => {
      pt[1] += .013*Math.cos(a+.5) + .014*Math.sin(a*2-.6)*Math.sin(f*Math.PI);
      pt[2] += .009*Math.cos(a*3)*Math.sin(f*Math.PI);
    });
  // Loose woven ends fall from the shoulder over the pack.
  for (const s of [-1,1]) {
    const x = hero ? s*.106 : s*.086;
    const tip = hero ? (s<0 ? .193 : .299) : .256;
    const back = hero ? .235 : .122;
    art.shell(spine,[x,0,0],[[tip,.014,.006,back],[tip+.017,.037,.009,back],
      [tip+.05,.042,.014,back-.006],[.373,.045,.013,hero?.195:.124],
      [.406,.043,.02,hero?.161:.101],[.435,.048,.021,.09],[.458,.039,.017,.055]],
      shade,finish,18,(a,f,pt)=>{
        pt[0] += s*Math.sin(f*Math.PI)*.018;
        pt[1] += .012*Math.cos(a)*Math.sin(Math.PI*f);
        pt[2] += .007*Math.sin(a*3+f*5);
      });
    for (let i=0; i<5;i++) {
      const strand=x-.013+i*.006;
      art.cord(spine,[[strand,tip+.014,back],[strand-.001,tip,back+.002],[strand+.003,tip-.016+(i%2)*.006,back]],.0025,i%2===0?'#c8b6a0':'#9f4b40');
    }
  }
}

function pack(art: Sculpt, spine: THREE.Bone) {
  const canvas='#66553c', trim='#463e2e', seam='#a08c67';
  art.shell(spine,[0,.247,.126],[[-.172,.094,.049],[-.15,.134,.082],[-.11,.148,.091],
    [.068,.148,.095],[.119,.136,.085],[.149,.106,.073],[.157,.019,.018]],canvas,'canvas',26,clothFolds);
  art.box(spine,[0,.191,.216],[.202,.143,.055],'#736247');
  art.box(spine,[0,.269,.225],[.21,.05,.053],canvas);
  art.cord(spine,[[-.097,.248,.248],[0,.24,.257],[.097,.248,.248]],.0025,seam);
  art.cord(spine,[[-.053,.393,.154],[-.038,.421,.159],[.04,.421,.159],[.051,.395,.154]],.008,trim);
  for (const s of [-1,1]) {
    art.box(spine,[s*.072,.168,.248],[.016,.11,.008],trim,'leather');
    art.box(spine,[s*.072,.172,.254],[.03,.022,.008],'#ada48a','metal');
    art.box(spine,[s*.143,.226,.138],[.039,.132,.088],canvas);
    art.cord(spine,[[s*.115,.339,.148],[s*.151,.419,.072],[s*.154,.425,-.025],
      [s*.142,.37,-.099],[s*.129,.26,-.114],[s*.16,.165,-.09],[s*.16,.108,.065]],.018,trim,'canvas');
    art.cord(spine,[[s*.149,.407,-.033],[s*.142,.362,-.113],[s*.13,.272,-.132]],.0028,seam);
  }
}

export function createActor(kind: CharacterKind, variant=0) {
  const group = new THREE.Group();
  const art = new Sculpt();
  const hero = kind==='hero', civilian=kind==='civilian';
  const v = ((Math.trunc(variant)%6)+6)%6, woman=civilian && v%3===0;
  const skin = ['#bf8a69','#a87555','#ce9673','#b98166','#ca9675','#ae785b'][v];
  const hair = civilian && v===2 ? '#61554b' : '#3c312a';
  const jacket = hero ? '#77785a' : civilian ? ['#6a7976','#9c8a69','#878379','#8d6e72','#7e8581','#7f715e'][v] : ['#555853','#616259','#625b50'][v%3];
  const pants = hero ? '#4d5246' : civilian ? '#57534b' : '#4c4944';
  const root=art.bone('hips',null,0,.917,0), spine=art.bone('chest',root,0,.079,0);
  const head=art.bone('head',spine,0,.496,-.01);
  const belt = hero ? '#695443' : '#525047';
  art.shell(root,[0,0,0],[[-.092,.124,.085],[-.064,.166,.099],[.01,.17,.104],[.075,.148,.092]],pants,'cotton',26,clothFolds);
  art.shell(spine,[0,0,0],[[-.026,.157,.105],[.012,.171,.109],[.043,.153,.098],[.104,.155,.096],
    [.173,.177,.109],[.232,.195,.122],[.302,.204,.126],[.355,.201,.123],[.385,.178,.108],[.405,.145,.096],[.421,.12,.089],[.443,.083,.072],[.454,.066,.06]],jacket,'cotton',28,clothFolds);
  art.shell(spine,[0,0,0],[[.004,.168,.105],[.012,.168,.109],[.058,.16,.106],[.065,.156,.103]],
    belt,'leather',28);
  art.box(spine,[.013,.034,-.108],[.037,.028,.011],'#a19779','metal');
  // The neck extends into the skull and the sloping trapezius; their overlap survives head turns.
  art.shell(spine,[0,0,.005],[[.406,.093,.075],[.435,.079,.067],[.46,.069,.063],
    [.488,.061,.059],[.524,.062,.059],[.546,.066,.061]],skin,'skin',26);
  art.shell(head,[0,0,.019],[[-.044,.054,.05],[-.014,.059,.054],[.032,.061,.06],[.069,.067,.064]],skin,'skin',24);
  face(art,head,skin,hair,!woman,woman);
  if (woman) {
    art.shell(spine,[0,0,0],[[-.292,.179,.12],[-.247,.177,.121],[-.105,.17,.108],[.009,.162,.102],
      [.068,.154,.101]],jacket,'cotton',30,clothFolds);
    art.shell(spine,[0,0,0],[[.277,.177,.121],[.345,.193,.121],[.39,.171,.11],[.445,.099,.085]],'#abae9e','cotton',24,clothFolds);
  } else {
    for(const s of [-1,1]){
      art.box(spine,[s*.094,.262,-.106],[.09,.083,.024],jacket);
      art.box(spine,[s*.094,.294,-.118],[.093,.022,.018],jacket);
      art.oval(spine,[s*.094,.291,-.127],[.004,.003,.002],'#9d9983');
    }
    const collar = civilian ? '#64635a' : '#696950';
    art.shell(spine,[0,0,0],[[.416,.112,.085],[.428,.104,.083],[.452,.08,.069],[.466,.071,.063]],collar,'cotton',28,
      (a,f,pt)=>{pt[1] -= .041*Math.pow(Math.max(0,-Math.cos(a)),10)*f;});
    if(civilian){
      const vest=v%2?'#6d6352':'#62675d';
      art.shell(spine,[0,0,.002],[[.071,.16,.107],[.096,.162,.109],[.171,.18,.115],
        [.236,.197,.128],[.302,.209,.13],[.351,.196,.126],[.382,.173,.11],[.406,.135,.099]],
        vest,'canvas',32,(a,f,pt)=>{
          const opening=Math.pow(Math.max(0,-Math.cos(a)),5);
          pt[2] += (.07+.08*f)*opening;
          pt[1] -= .034*opening*f;
        });
    }
    art.cord(spine,[[.009,.093,-.096],[.009,.229,-.123],[.009,.342,-.118],[.017,.399,-.081]],.0042,jacket,'cotton');
  }
  if (!civilian) neckScarf(art,spine,hero,false);
  if (hero) pack(art,spine);
  const legs: {thigh:THREE.Bone; shin:THREE.Bone; foot:THREE.Bone}[]=[];
  const arms: {upper:THREE.Bone; lower:THREE.Bone; hand:THREE.Bone}[]=[];
  let prop: THREE.Bone|undefined;
  for (const s of [-1,1]) {
    const thigh=art.bone('thigh'+s,root,s*.092,-.018,0);
    const shin=art.bone('shin'+s,thigh,0,-.414,-.002);
    const foot=art.bone('foot'+s,shin,0,-.389,.002);
    art.shell(thigh,[0,0,0],[[-.432,.064,.066],[-.391,.074,.076],[-.361,.073,.083],[-.331,.077,.073],
      [-.293,.079,.081],[-.223,.087,.092],[-.16,.094,.099],[-.122,.097,.101],[-.054,.099,.102],[.014,.086,.091]],
      pants,'cotton',20,clothFolds);
    art.shell(shin,[0,0,0],[[-.38,.054,.055],[-.353,.061,.064],[-.311,.059,.057],
      [-.266,.066,.064],[-.213,.067,.073,.009],[-.145,.074,.078,.01],[-.086,.074,.078],[-.047,.07,.071],[.011,.062,.061]],pants,'cotton',18,clothFolds);
    if(!civilian){
      art.box(thigh,[s*.082,-.205,.001],[.044,.114,.098],pants);
      art.box(thigh,[s*.097,-.16,0],[.021,.032,.111],jacket);
    }
    const boot = civilian?'#594333':'#4b4238';
    art.shell(foot,[0,0,0],[[-.093,.054,.118,-.035],[-.087,.065,.136,-.044],[-.067,.067,.137,-.044],
      [-.06,.065,.13,-.042]],'#3d3730','leather',22);
    art.shell(foot,[0,0,0],[[-.067,.063,.13,-.04],[-.04,.065,.124,-.039],[-.023,.057,.092,-.021],
      [.006,.052,.065,.002],[.062,.052,.055,.008],[.077,.048,.049,.009]],boot,'leather',22);
    for(let i=0;i<3;i++)art.cord(foot,[[-.031,.051-i*.017,-.043-i*.014],[0,.048-i*.018,-.052-i*.017],
      [.03,.05-i*.018,-.044-i*.014]],.0026,'#786b55','cotton');
    legs.push({thigh,shin,foot});
    const upper=art.bone('shoulder'+s,spine,s*.189,.36,0);
    const lower=art.bone('elbow'+s,upper,s*.019,-.256,.004);
    const hand=art.bone('wrist'+s,lower,s*.004,-.237,-.005);
    art.shell(upper,[0,0,0],[[-.272,.05,.051],[-.243,.058,.056],[-.212,.064,.062],
      [-.167,.065,.067],[-.106,.072,.073],[-.057,.081,.081],[-.018,.08,.079],[.024,.059,.061],[.042,.028,.034]],
      jacket,'cotton',20,(a,f,pt)=>{clothFolds(a,f,pt);pt[0] += s*.018*(1-f);});
    if(hero){
      art.shell(lower,[0,0,0],[[-.243,.029,.031],[-.213,.035,.037],[-.167,.044,.044],
        [-.105,.049,.047],[.012,.053,.05]],skin,'skin',20);
      art.shell(lower,[0,0,0],[[-.143,.048,.046],[-.139,.055,.054],[-.13,.059,.057],
        [-.119,.054,.053],[-.11,.056,.054],[-.102,.053,.052],[-.059,.059,.06],[.016,.052,.053]],
        jacket,'cotton',20,clothFolds);
      art.shell(lower,[0,0,0],[[-.142,.05,.05],[-.138,.057,.056],[-.131,.058,.056],[-.128,.054,.053]],
        '#939378','canvas',20,clothFolds);
    } else {
    art.shell(lower,[0,0,0],[[-.229,.037,.039],[-.21,.04,.042],[-.19,.045,.047],[-.177,.046,.045],
      [-.151,.047,.049],[-.102,.054,.055],[-.049,.057,.057],[.015,.049,.051]],jacket,'cotton',18,clothFolds);
    art.shell(lower,[0,-.214,0],[[-.021,.037,.038],[-.013,.041,.044],[.01,.041,.044],[.015,.039,.041]],jacket,'canvas',16);
    }
    art.oval(hand,[0,-.033,0],[.029,.053,.023],skin,'skin');
    for(let i=0;i<4;i++){
      const x=(i-1.5)*.012*s;
      art.oval(hand,[x,-.079+Math.abs(i-1)*.004,-.004],[.007,.029-i*.002,.011],skin,'skin',10);
    }
    art.oval(hand,[-s*.027,-.041,-.008],[.012,.03,.012],skin,'skin',10);
    arms.push({upper,lower,hand});
    if(s===1&&!civilian){
      prop=art.bone('stage-prop',hand,0,-.042,0);
      art.box(prop,[0,.027,-.112],[.048,.061,.287],'#494c48','metal');
      art.box(prop,[0,.019,.082],[.047,.049,.147],'#615748','canvas');
      art.box(prop,[0,.036,-.275],[.025,.029,.078],'#555650','metal');
      art.box(prop,[0,-.024,-.092],[.034,.064,.048],'#51534b','metal');
    }
  }
  const geometry=art.finish();
  const mesh=new THREE.SkinnedMesh(geometry,wardrobe());
  users++;
  const skeleton = new THREE.Skeleton(art.bones);
  mesh.add(root); mesh.bind(skeleton); mesh.castShadow=true; mesh.receiveShadow=true;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,.91,0),1.08);
  group.add(mesh); group.name=kind;
  if(!hero) group.scale.setScalar(.965 + v*.009);
  let t = v*.732, phase=v*.87, locomotion=0, sprint=0, crouch=0, aim=0, surrender=0, fired=0,
    busy=0, reload=0, hit=0, up=0, climb=0, released=false;
  const damp=(a:number,b:number,k:number,dt:number)=>THREE.MathUtils.damp(a,b,k,dt);
  function update(dt:number,state:ActorState){
    dt=Math.max(0,Math.min(.1,dt)); t+=dt;
    const speed=Math.max(0,state.speed||0);
    locomotion=damp(locomotion,Math.min(1,speed/1.9),11,dt);
    sprint=damp(sprint,state.sprint?1:0,9,dt);
    crouch=damp(crouch,state.crouch?1:0,11,dt);
    aim=damp(aim,state.aim?1:0,13,dt);
    surrender=damp(surrender,state.surrender?1:0,8,dt);
    busy=damp(busy,Math.min(1,state.interact||0),10,dt);
    reload=damp(reload,Math.min(1,state.reload||0),11,dt);
    fired=Math.max(fired*Math.exp(-dt*18),Math.min(1,state.fire||0));
    hit=Math.max(hit*Math.exp(-dt*10),Math.min(1,state.hit||0));
    up=damp(up,Math.min(1,state.jump||0),9,dt);
    climb=damp(climb,state.climb?1:0,10,dt);
    phase+=dt*(5.2+Math.min(speed,6)*1.37);
    const stride=Math.sin(phase), step=locomotion, breath=Math.sin(t*2.3);
    root.position.y=.917-.145*crouch + .015*step*Math.cos(phase*2)+breath*.002;
    root.rotation.y=stride*step*.075;
    root.rotation.z=stride*step*.032-hit*.075 + (1-step)*(.012+.003*breath);
    spine.rotation.x=-.047-.12*sprint-.11*crouch-.13*busy+fired*.048+hit*.14;
    spine.rotation.y=-root.rotation.y*.9+.11*aim+.11*reload;
    head.rotation.x=.03+.11*crouch+.095*sprint+.19*busy+.27*reload-.1*up;
    head.rotation.y=(Math.sin(t*.73+v)*.10+Math.sin(t*.33)*.03)*(1-step)*(1-aim);
    head.rotation.z=-root.rotation.z*.7+breath*.007;
    for(let i=0;i<2;i++){
      const s=i===0?-1:1, swing=s*stride, kneeWave=Math.max(0,-s*Math.cos(phase));
      const {thigh,shin,foot}=legs[i];
      thigh.rotation.x=step*(swing*(.55+.26*sprint)+.13)+.65*crouch+up*(i?.36:.71)+climb*.75*kneeWave;
      shin.rotation.x=-step*kneeWave*(.69+.38*sprint)-1.19*crouch-up*.62-climb*.58*kneeWave;
      foot.rotation.x=-(thigh.rotation.x+shin.rotation.x)*(.73+.22*crouch)+step*.085*swing;
      const {upper,lower,hand}=arms[i];
      const hold = civilian || state.peaceful ? 0 : 1;
      upper.rotation.x=.055 + (1-step)*(.045*s+breath*.012)-swing*step*(.38+.24*sprint)+.19*hold;
      upper.rotation.z=s*(.095+.029*step+.013*Math.sin(t*1.1+i)*(1-step));
      lower.rotation.x=.13+.14*kneeWave*step+.24*sprint+.44*hold;
      // Explicit poses blend over the walk cycle, so upper-body actions can continue in motion.
      const blend=(x:number,y:number,w:number)=>x+(y-x)*w;
      upper.rotation.x=blend(upper.rotation.x,i?.94:1.13,aim);
      lower.rotation.x=blend(lower.rotation.x,i?.72:.55,aim);
      upper.rotation.z=blend(upper.rotation.z,i?-.15:.49,aim);
      upper.rotation.x=blend(upper.rotation.x,.62+Math.sin(t*6)*.1,reload);
      lower.rotation.x=blend(lower.rotation.x,i?.95:1.42,reload);
      upper.rotation.z=blend(upper.rotation.z,-s*.4,reload);
      upper.rotation.x=blend(upper.rotation.x,.72+.11*Math.sin(t*4+i),busy);
      lower.rotation.x=blend(lower.rotation.x,.89,busy);
      upper.rotation.z=blend(upper.rotation.z,-s*.19,busy);
      upper.rotation.x=blend(upper.rotation.x,1.92+s*stride*.68,climb);
      lower.rotation.x=blend(lower.rotation.x,.43+s*Math.cos(phase)*.26,climb);
      upper.rotation.z=blend(upper.rotation.z,s*1.99,surrender);
      upper.rotation.x=blend(upper.rotation.x,.34,surrender);
      lower.rotation.x=blend(lower.rotation.x,1.33,surrender);
      upper.rotation.x+=fired*.13; lower.rotation.x+=fired*.12;
      hand.rotation.x=-.15+.07*breath;
    }
    if(prop){
      prop.rotation.x=-(arms[1].upper.rotation.x+arms[1].lower.rotation.x+arms[1].hand.rotation.x)
        -.53*(1-aim)-.12*sprint+.05*fired;
      prop.rotation.z=-arms[1].upper.rotation.z;
      prop.scale.setScalar(state.peaceful ? .00001 : Math.max(.001,1-surrender));
    }
  }
  update(0,{speed:0});
  function dispose(){
    if(released)return;
    released=true; geometry.dispose(); skeleton.dispose(); group.clear();
    if(--users===0){surface?.dispose();atlas?.dispose();surface=undefined;atlas=undefined;}
  }
  return {group,update,dispose};
}
