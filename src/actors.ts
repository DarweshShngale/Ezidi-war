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
  const tile = 128,
    width = tile * 4,
    height = tile * 2;
  const pixels = new Uint8Array(width * height * 4);
  let seed = 104717;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 4294967296;
      const u = x % tile,
        v = y % tile;
      const slot = Math.floor(x / tile) + Math.floor(y / tile) * 4;
      const weave = Math.cos(u * Math.PI) * Math.cos(v * Math.PI);
      const grain = Math.sin(u * 0.21 + Math.sin(v * 0.14) * 2);
      let c = 242 + noise * 12,
        r = c,
        g = c,
        b = c;
      switch (slot) {
        case 0:
          c = 226 + weave * 10 + noise * 14 + 5 * Math.sin(v * 3.1);
          break;
        case 1:
          c = 244 + noise * 9 + 2 * grain;
          break;
        case 2:
          c = 207 + 22 * Math.sin(u * 2.9 + Math.sin(v * 0.084) * 1.4) + noise * 22;
          break;
        case 3: {
          const diamond = Math.min((u + v) % 32, (u - v + tile * 3) % 32);
          const stripe = u % 48 < 4 || v % 48 < 4;
          const thread = noise * 12 + weave * 5;
          const paleThread =
            diamond < 5 || stripe || Math.abs((u % 32) - 16) + Math.abs((v % 32) - 16) < 5;
          r = (paleThread ? 235 : 154) + thread;
          g = (paleThread ? 212 : 41) + thread;
          b = (paleThread ? 184 : 38) + thread;
          break;
        }
        case 4:
          c = 218 + grain * 8 + noise * 24;
          break;
        case 5:
          c = 217 + weave * 9 + (v % 4 < 2 ? 13 : 0) + noise * 17;
          break;
        case 6:
          c = 233 + noise * 14 + 4 * grain;
          break;
        case 7:
          c = 255;
          break;
      }
      if (slot !== 3) r = g = b = c;
      const i = (y * width + x) * 4;
      pixels[i] = Math.min(255, r);
      pixels[i + 1] = Math.min(255, g);
      pixels[i + 2] = Math.min(255, b);
      pixels[i + 3] = 255;
    }
  atlas = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.magFilter = THREE.LinearFilter;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  atlas.needsUpdate = true;
  surface = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.86 });
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
    b.name = name;
    b.position.set(x, y, z);
    parent?.add(b);
    b.updateWorldMatrix(true, false);
    this.bones.push(b);
    return b;
  }
  // A shaped ring surface supports asymmetric silhouettes, seams and sculpted folds.
  shell(
    b: THREE.Bone,
    p: Point,
    rings: Ring[],
    color: string,
    finish: Finish,
    segments = 20,
    shape?: (a: number, f: number, point: Point) => void,
  ) {
    const start = this.positions.length / 3;
    const origin = b.getWorldPosition(new THREE.Vector3());
    const tint = new THREE.Color(color);
    const index = this.bones.indexOf(b);
    const slot = finishes.indexOf(finish),
      tileX = slot % 4,
      tileY = Math.floor(slot / 4);
    for (let j = 0; j < rings.length; j++) {
      const [y, rx, rz, dz = 0] = rings[j];
      const f = j / (rings.length - 1);
      for (let k = 0; k <= segments; k++) {
        const a = (tau * k) / segments;
        const point: Point = [rx * Math.sin(a), y, rz * Math.cos(a) + dz];
        shape?.(a, f, point);
        this.positions.push(
          point[0] + p[0] + origin.x,
          point[1] + p[1] + origin.y,
          point[2] + p[2] + origin.z,
        );
        const shade = 0.89 + 0.09 * Math.min(1, f * 3) + 0.025 * Math.cos(a - 0.7);
        this.colors.push(tint.r * shade, tint.g * shade, tint.b * shade);
        this.uv.push((tileX + 0.012 + (0.976 * k) / segments) / 4, (tileY + 0.012 + 0.976 * f) / 2);
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
    const rings: Ring[] = Array.from({ length: 9 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 8;
      return [
        Math.sin(a) * scale[1],
        Math.max(0.0001, Math.cos(a)) * scale[0],
        Math.max(0.0001, Math.cos(a)) * scale[2],
      ];
    });
    this.shell(b, p, rings, color, finish, segments);
  }
  box(b: THREE.Bone, p: Point, size: Point, color: string, finish: Finish = 'canvas') {
    const [w, h, d] = size;
    this.shell(
      b,
      p,
      [
        [-h / 2, 0.0001, 0.0001],
        [-h / 2, w * 0.91, d * 0.91],
        [-h * 0.4, w, d],
        [h * 0.39, w, d],
        [h / 2, w * 0.9, d * 0.9],
        [h / 2, 0.0001, 0.0001],
      ],
      color,
      finish,
      16,
      (_a, _f, pt) => {
        pt[0] = (Math.sign(pt[0]) * Math.pow(Math.abs(pt[0]) / w, 0.48) * w) / 2;
        pt[2] = (Math.sign(pt[2]) * Math.pow(Math.abs(pt[2]) / d, 0.48) * d) / 2;
      },
    );
  }
  // Convert a polyline to a narrow tube for straps, piping and stitches.
  cord(b: THREE.Bone, path: Point[], radius: number, color: string, finish: Finish = 'cotton') {
    const geom = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p))),
      Math.max(6, path.length * 2),
      radius,
      5,
      false,
    );
    const pos = geom.getAttribute('position'),
      uv = geom.getAttribute('uv');
    const origin = b.getWorldPosition(new THREE.Vector3()),
      tint = new THREE.Color(color);
    const base = this.positions.length / 3,
      slot = finishes.indexOf(finish),
      boneIndex = this.bones.indexOf(b);
    for (let j = 0; j < pos.count; j++) {
      this.positions.push(pos.getX(j) + origin.x, pos.getY(j) + origin.y, pos.getZ(j) + origin.z);
      this.colors.push(tint.r, tint.g, tint.b);
      this.uv.push(
        ((slot % 4) + 0.012 + 0.976 * uv.getX(j)) / 4,
        (Math.floor(slot / 4) + 0.012 + 0.976 * uv.getY(j)) / 2,
      );
      this.joints.push(boneIndex, 0, 0, 0);
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
    g.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4));
    g.setIndex(this.triangles);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

// Slightly irregular cloth rings catch light across elbows, knees and cloth gathers.
function clothFolds(a: number, f: number, point: Point) {
  const wav = 1 + 0.043 * Math.sin(a * 5 + f * 2.5) + 0.019 * Math.sin(9 * a - f);
  point[0] *= wav;
  point[2] *= wav;
  point[1] += 0.007 * Math.sin(a * 2 + f * 7) * Math.sin(f * Math.PI);
}

function face(
  art: Sculpt,
  head: THREE.Bone,
  skin: string,
  hair: string,
  bearded: boolean,
  wrap: boolean,
) {
  const shape: Ring[] = [
    [0.003, 0.02, 0.027, -0.024],
    [0.018, 0.044, 0.056, -0.022],
    [0.038, 0.067, 0.069, -0.014],
    [0.066, 0.083, 0.082, -0.005],
    [0.101, 0.09, 0.087],
    [0.137, 0.089, 0.088, 0.003],
    [0.169, 0.088, 0.088, 0.008],
    [0.199, 0.081, 0.083, 0.011],
    [0.222, 0.063, 0.071, 0.012],
    [0.236, 0.031, 0.04, 0.01],
    [0.24, 0.002, 0.003, 0.01],
  ];
  art.shell(head, [0, 0, 0], shape, skin, 'skin', 32);
  for (const s of [-1, 1]) {
    art.oval(head, [s * 0.087, 0.106, 0.003], [0.016, 0.025, 0.013], skin, 'skin', 12);
    art.oval(head, [s * 0.096, 0.105, -0.002], [0.008, 0.014, 0.008], '#b4755c', 'skin', 10);
    art.oval(head, [s * 0.039, 0.121, -0.075], [0.022, 0.009, 0.009], '#c9b4a1', 'skin');
    art.oval(head, [s * 0.036, 0.121, -0.082], [0.008, 0.007, 0.005], '#352920', 'smooth');
    art.cord(
      head,
      [
        [s * 0.017, 0.136, -0.086],
        [s * 0.036, 0.142, -0.082],
        [s * 0.057, 0.139, -0.069],
      ],
      0.0046,
      hair,
      'hair',
    );
    art.cord(
      head,
      [
        [s * 0.018, 0.122, -0.085],
        [s * 0.037, 0.128, -0.086],
        [s * 0.058, 0.123, -0.073],
      ],
      0.0021,
      '#865745',
      'skin',
    );
  }
  art.shell(
    head,
    [0, 0, -0.077],
    [
      [0.077, 0.014, 0.01, -0.01],
      [0.087, 0.019, 0.016, -0.012],
      [0.097, 0.015, 0.021, -0.01],
      [0.12, 0.009, 0.013],
      [0.134, 0.009, 0.006],
    ],
    skin,
    'skin',
    16,
  );
  art.oval(head, [0, 0.062, -0.085], [0.024, 0.005, 0.006], '#a56b5d', 'skin');
  // Conform the hair and beard to the face even at a sloping hairline.
  function followSkull(a: number, y: number, margin: number, point: Point) {
    const i = Math.max(
      1,
      shape.findIndex((ring) => ring[0] >= y),
    );
    const lo = shape[i - 1],
      hi = shape[i];
    const t = THREE.MathUtils.clamp((y - lo[0]) / (hi[0] - lo[0]), 0, 1);
    const rx = THREE.MathUtils.lerp(lo[1], hi[1], t) + margin;
    const rz = THREE.MathUtils.lerp(lo[2], hi[2], t) + margin;
    point[0] = Math.sin(a) * rx;
    point[1] = y;
    point[2] = Math.cos(a) * rz + THREE.MathUtils.lerp(lo[3] || 0, hi[3] || 0, t);
  }
  const layers: Ring[] = Array.from({ length: 9 }, (_, i) => [i / 8, 1, 1]);
  art.shell(head, [0, 0, 0], layers, hair, 'hair', 36, (a, f, pt) => {
    const front = (1 - Math.cos(a)) / 2;
    const taper = 0.012 * Math.abs(Math.sin(a)) - 0.009 * Math.cos(2 * a - 0.4);
    const line = 0.05 + 0.118 * front ** 1.3 + taper + 0.003 * Math.sin(7 * a);
    const level = THREE.MathUtils.lerp(line, 0.239, f);
    followSkull(a, level, 0.0022 + 0.004 * Math.sin(f * Math.PI), pt);
    pt[1] += f * f * 0.01;
  });
  // Swept locks follow the crown in irregular curved ribbons; their relief reads in a rear view.
  if (!wrap) {
    for (let i = 0; i < 19; i++) {
      const a = (i / 19) * tau + 0.12,
        path: Point[] = [];
      const front = (1 - Math.cos(a)) / 2,
        bottom = 0.068 + front * 0.114;
      for (let k = 0; k < 7; k++) {
        const u = k / 6;
        const point: Point = [0, 0, 0];
        const y = THREE.MathUtils.lerp(
          0.226 + 0.005 * Math.sin(i * 4),
          bottom + 0.007 * Math.sin(i * 2.3),
          u,
        );
        followSkull(a + (0.47 + 0.1 * Math.sin(i)) * Math.pow(1 - u, 2), y, 0.005, point);
        point[1] += 0.006 * (1 - u);
        path.push(point);
      }
      art.cord(head, path, i % 3 === 0 ? 0.0038 : 0.0022, i % 3 === 0 ? '#4d4036' : '#3e352e', 'hair');
    }
  }
  if (bearded) {
    art.shell(head, [0, 0, 0], layers, hair, 'hair', 34, (a, f, pt) => {
      const side = Math.abs(Math.sin(a)),
        back = Math.max(0, Math.cos(a));
      const edge = 0.054 + side ** 2.8 * 0.074 - 0.046 * back;
      const level = THREE.MathUtils.lerp(0.004, edge, f);
      followSkull(a, level, 0.0024 - 0.012 * back, pt);
      pt[1] -= 0.003 * (1 - f);
    });
    for (const s of [-1, 1])
      art.cord(
        head,
        [
          [s * 0.002, 0.077, -0.093],
          [s * 0.014, 0.075, -0.091],
          [s * 0.027, 0.068, -0.084],
        ],
        0.0048,
        hair,
        'hair',
      );
  }
  if (wrap) {
    art.shell(
      head,
      [0, 0, 0.012],
      [
        [0.056, 0.091, 0.082],
        [0.126, 0.1, 0.099],
        [0.181, 0.1, 0.1],
        [0.219, 0.089, 0.092],
        [0.242, 0.059, 0.067],
        [0.249, 0.003, 0.002],
      ],
      '#bdb9a7',
      'cotton',
      28,
      (a, f, pt) => {
        pt[1] += (1 - f) ** 2 * 0.122 * Math.max(0, -Math.cos(a));
        pt[2] += 0.013 * (1 - f);
      },
    );
  }
}

function neckScarf(art: Sculpt, spine: THREE.Bone, hero: boolean, second: boolean) {
  const shade = hero ? '#ffead4' : second ? '#7f948f' : '#929182';
  const finish: Finish = hero ? 'scarf' : 'cotton';
  art.shell(
    spine,
    [0, 0.437, 0],
    [
      [-0.059, 0.135, 0.1],
      [-0.038, 0.153, 0.111],
      [-0.022, 0.14, 0.119],
      [0.003, 0.124, 0.11],
      [0.02, 0.115, 0.101],
      [0.039, 0.105, 0.087],
      [0.048, 0.078, 0.071],
    ],
    shade,
    finish,
    32,
    (a, f, pt) => {
      pt[1] += 0.013 * Math.cos(a + 0.5) + 0.014 * Math.sin(a * 2 - 0.6) * Math.sin(f * Math.PI);
      pt[2] += 0.009 * Math.cos(a * 3) * Math.sin(f * Math.PI);
    },
  );
  // Loose woven ends fall from the shoulder over the pack.
  for (const s of [-1, 1]) {
    const x = hero ? s * 0.106 : s * 0.086;
    const tip = hero ? (s < 0 ? 0.193 : 0.299) : 0.256;
    const back = hero ? 0.235 : 0.122;
    art.shell(
      spine,
      [x, 0, 0],
      [
        [tip, 0.014, 0.006, back],
        [tip + 0.017, 0.037, 0.009, back],
        [tip + 0.05, 0.042, 0.014, back - 0.006],
        [0.373, 0.045, 0.013, hero ? 0.195 : 0.124],
        [0.406, 0.043, 0.02, hero ? 0.161 : 0.101],
        [0.435, 0.048, 0.021, 0.09],
        [0.458, 0.039, 0.017, 0.055],
      ],
      shade,
      finish,
      18,
      (a, f, pt) => {
        pt[0] += s * Math.sin(f * Math.PI) * 0.018;
        pt[1] += 0.012 * Math.cos(a) * Math.sin(Math.PI * f);
        pt[2] += 0.007 * Math.sin(a * 3 + f * 5);
      },
    );
    for (let i = 0; i < 5; i++) {
      const strand = x - 0.013 + i * 0.006;
      art.cord(
        spine,
        [
          [strand, tip + 0.014, back],
          [strand - 0.001, tip, back + 0.002],
          [strand + 0.003, tip - 0.016 + (i % 2) * 0.006, back],
        ],
        0.0025,
        i % 2 === 0 ? '#c8b6a0' : '#9f4b40',
      );
    }
  }
}

function pack(art: Sculpt, spine: THREE.Bone) {
  const canvas = '#66553c',
    trim = '#463e2e',
    seam = '#a08c67';
  art.shell(
    spine,
    [0, 0.247, 0.126],
    [
      [-0.172, 0.094, 0.049],
      [-0.15, 0.134, 0.082],
      [-0.11, 0.148, 0.091],
      [0.068, 0.148, 0.095],
      [0.119, 0.136, 0.085],
      [0.149, 0.106, 0.073],
      [0.157, 0.019, 0.018],
    ],
    canvas,
    'canvas',
    26,
    clothFolds,
  );
  art.box(spine, [0, 0.191, 0.216], [0.202, 0.143, 0.055], '#736247');
  art.box(spine, [0, 0.269, 0.225], [0.21, 0.05, 0.053], canvas);
  art.cord(
    spine,
    [
      [-0.097, 0.248, 0.248],
      [0, 0.24, 0.257],
      [0.097, 0.248, 0.248],
    ],
    0.0025,
    seam,
  );
  art.cord(
    spine,
    [
      [-0.053, 0.393, 0.154],
      [-0.038, 0.421, 0.159],
      [0.04, 0.421, 0.159],
      [0.051, 0.395, 0.154],
    ],
    0.008,
    trim,
  );
  for (const s of [-1, 1]) {
    art.box(spine, [s * 0.072, 0.168, 0.248], [0.016, 0.11, 0.008], trim, 'leather');
    art.box(spine, [s * 0.072, 0.172, 0.254], [0.03, 0.022, 0.008], '#ada48a', 'metal');
    art.box(spine, [s * 0.143, 0.226, 0.138], [0.039, 0.132, 0.088], canvas);
    art.cord(
      spine,
      [
        [s * 0.115, 0.339, 0.148],
        [s * 0.151, 0.419, 0.072],
        [s * 0.154, 0.425, -0.025],
        [s * 0.142, 0.37, -0.099],
        [s * 0.129, 0.26, -0.114],
        [s * 0.16, 0.165, -0.09],
        [s * 0.16, 0.108, 0.065],
      ],
      0.018,
      trim,
      'canvas',
    );
    art.cord(
      spine,
      [
        [s * 0.149, 0.407, -0.033],
        [s * 0.142, 0.362, -0.113],
        [s * 0.13, 0.272, -0.132],
      ],
      0.0028,
      seam,
    );
  }
}

export function createActor(kind: CharacterKind, variant = 0) {
  const group = new THREE.Group();
  const art = new Sculpt();
  const hero = kind === 'hero',
    civilian = kind === 'civilian';
  const v = ((Math.trunc(variant) % 6) + 6) % 6,
    woman = civilian && v % 3 === 0;
  const skin = ['#bf8a69', '#a87555', '#ce9673', '#b98166', '#ca9675', '#ae785b'][v];
  const hair = civilian && v === 2 ? '#61554b' : '#3c312a';
  const jacket = hero
    ? '#77785a'
    : civilian
      ? ['#6a7976', '#9c8a69', '#878379', '#8d6e72', '#7e8581', '#7f715e'][v]
      : ['#555853', '#616259', '#625b50'][v % 3];
  const pants = hero ? '#4d5246' : civilian ? '#57534b' : '#4c4944';
  const root = art.bone('hips', null, 0, 0.917, 0),
    spine = art.bone('chest', root, 0, 0.079, 0);
  const head = art.bone('head', spine, 0, 0.496, -0.01);
  const belt = hero ? '#695443' : '#525047';
  art.shell(
    root,
    [0, 0, 0],
    [
      [-0.092, 0.124, 0.085],
      [-0.064, 0.166, 0.099],
      [0.01, 0.17, 0.104],
      [0.075, 0.148, 0.092],
    ],
    pants,
    'cotton',
    26,
    clothFolds,
  );
  art.shell(
    spine,
    [0, 0, 0],
    [
      [-0.026, 0.157, 0.105],
      [0.012, 0.171, 0.109],
      [0.043, 0.153, 0.098],
      [0.104, 0.155, 0.096],
      [0.173, 0.177, 0.109],
      [0.232, 0.195, 0.122],
      [0.302, 0.204, 0.126],
      [0.355, 0.201, 0.123],
      [0.385, 0.178, 0.108],
      [0.405, 0.145, 0.096],
      [0.421, 0.12, 0.089],
      [0.443, 0.083, 0.072],
      [0.454, 0.066, 0.06],
    ],
    jacket,
    'cotton',
    28,
    clothFolds,
  );
  art.shell(
    spine,
    [0, 0, 0],
    [
      [0.004, 0.168, 0.105],
      [0.012, 0.168, 0.109],
      [0.058, 0.16, 0.106],
      [0.065, 0.156, 0.103],
    ],
    belt,
    'leather',
    28,
  );
  art.box(spine, [0.013, 0.034, -0.108], [0.037, 0.028, 0.011], '#a19779', 'metal');
  // The neck extends into the skull and the sloping trapezius; their overlap survives head turns.
  art.shell(
    spine,
    [0, 0, 0.005],
    [
      [0.406, 0.093, 0.075],
      [0.435, 0.079, 0.067],
      [0.46, 0.069, 0.063],
      [0.488, 0.061, 0.059],
      [0.524, 0.062, 0.059],
      [0.546, 0.066, 0.061],
    ],
    skin,
    'skin',
    26,
  );
  art.shell(
    head,
    [0, 0, 0.019],
    [
      [-0.044, 0.054, 0.05],
      [-0.014, 0.059, 0.054],
      [0.032, 0.061, 0.06],
      [0.069, 0.067, 0.064],
    ],
    skin,
    'skin',
    24,
  );
  face(art, head, skin, hair, !woman, woman);
  if (woman) {
    art.shell(
      spine,
      [0, 0, 0],
      [
        [-0.292, 0.179, 0.12],
        [-0.247, 0.177, 0.121],
        [-0.105, 0.17, 0.108],
        [0.009, 0.162, 0.102],
        [0.068, 0.154, 0.101],
      ],
      jacket,
      'cotton',
      30,
      clothFolds,
    );
    art.shell(
      spine,
      [0, 0, 0],
      [
        [0.277, 0.177, 0.121],
        [0.345, 0.193, 0.121],
        [0.39, 0.171, 0.11],
        [0.445, 0.099, 0.085],
      ],
      '#abae9e',
      'cotton',
      24,
      clothFolds,
    );
  } else {
    for (const s of [-1, 1]) {
      art.box(spine, [s * 0.094, 0.262, -0.106], [0.09, 0.083, 0.024], jacket);
      art.box(spine, [s * 0.094, 0.294, -0.118], [0.093, 0.022, 0.018], jacket);
      art.oval(spine, [s * 0.094, 0.291, -0.127], [0.004, 0.003, 0.002], '#9d9983');
    }
    const collar = civilian ? '#64635a' : '#696950';
    art.shell(
      spine,
      [0, 0, 0],
      [
        [0.416, 0.112, 0.085],
        [0.428, 0.104, 0.083],
        [0.452, 0.08, 0.069],
        [0.466, 0.071, 0.063],
      ],
      collar,
      'cotton',
      28,
      (a, f, pt) => {
        pt[1] -= 0.041 * Math.pow(Math.max(0, -Math.cos(a)), 10) * f;
      },
    );
    if (civilian) {
      const vest = v % 2 ? '#6d6352' : '#62675d';
      art.shell(
        spine,
        [0, 0, 0.002],
        [
          [0.071, 0.16, 0.107],
          [0.096, 0.162, 0.109],
          [0.171, 0.18, 0.115],
          [0.236, 0.197, 0.128],
          [0.302, 0.209, 0.13],
          [0.351, 0.196, 0.126],
          [0.382, 0.173, 0.11],
          [0.406, 0.135, 0.099],
        ],
        vest,
        'canvas',
        32,
        (a, f, pt) => {
          const opening = Math.pow(Math.max(0, -Math.cos(a)), 5);
          pt[2] += (0.07 + 0.08 * f) * opening;
          pt[1] -= 0.034 * opening * f;
        },
      );
    }
    art.cord(
      spine,
      [
        [0.009, 0.093, -0.096],
        [0.009, 0.229, -0.123],
        [0.009, 0.342, -0.118],
        [0.017, 0.399, -0.081],
      ],
      0.0042,
      jacket,
      'cotton',
    );
  }
  if (!civilian) neckScarf(art, spine, hero, false);
  if (hero) pack(art, spine);
  const legs: { thigh: THREE.Bone; shin: THREE.Bone; foot: THREE.Bone }[] = [];
  const arms: { upper: THREE.Bone; lower: THREE.Bone; hand: THREE.Bone }[] = [];
  let prop: THREE.Bone | undefined;
  for (const s of [-1, 1]) {
    const thigh = art.bone('thigh' + s, root, s * 0.092, -0.018, 0);
    const shin = art.bone('shin' + s, thigh, 0, -0.414, -0.002);
    const foot = art.bone('foot' + s, shin, 0, -0.389, 0.002);
    art.shell(
      thigh,
      [0, 0, 0],
      [
        [-0.432, 0.064, 0.066],
        [-0.391, 0.074, 0.076],
        [-0.361, 0.073, 0.083],
        [-0.331, 0.077, 0.073],
        [-0.293, 0.079, 0.081],
        [-0.223, 0.087, 0.092],
        [-0.16, 0.094, 0.099],
        [-0.122, 0.097, 0.101],
        [-0.054, 0.099, 0.102],
        [0.014, 0.086, 0.091],
      ],
      pants,
      'cotton',
      20,
      clothFolds,
    );
    art.shell(
      shin,
      [0, 0, 0],
      [
        [-0.38, 0.054, 0.055],
        [-0.353, 0.061, 0.064],
        [-0.311, 0.059, 0.057],
        [-0.266, 0.066, 0.064],
        [-0.213, 0.067, 0.073, 0.009],
        [-0.145, 0.074, 0.078, 0.01],
        [-0.086, 0.074, 0.078],
        [-0.047, 0.07, 0.071],
        [0.011, 0.062, 0.061],
      ],
      pants,
      'cotton',
      18,
      clothFolds,
    );
    if (!civilian) {
      art.box(thigh, [s * 0.082, -0.205, 0.001], [0.044, 0.114, 0.098], pants);
      art.box(thigh, [s * 0.097, -0.16, 0], [0.021, 0.032, 0.111], jacket);
    }
    const boot = civilian ? '#594333' : '#4b4238';
    art.shell(
      foot,
      [0, 0, 0],
      [
        [-0.093, 0.054, 0.118, -0.035],
        [-0.087, 0.065, 0.136, -0.044],
        [-0.067, 0.067, 0.137, -0.044],
        [-0.06, 0.065, 0.13, -0.042],
      ],
      '#3d3730',
      'leather',
      22,
    );
    art.shell(
      foot,
      [0, 0, 0],
      [
        [-0.067, 0.063, 0.13, -0.04],
        [-0.04, 0.065, 0.124, -0.039],
        [-0.023, 0.057, 0.092, -0.021],
        [0.006, 0.052, 0.065, 0.002],
        [0.062, 0.052, 0.055, 0.008],
        [0.077, 0.048, 0.049, 0.009],
      ],
      boot,
      'leather',
      22,
    );
    for (let i = 0; i < 3; i++)
      art.cord(
        foot,
        [
          [-0.031, 0.051 - i * 0.017, -0.043 - i * 0.014],
          [0, 0.048 - i * 0.018, -0.052 - i * 0.017],
          [0.03, 0.05 - i * 0.018, -0.044 - i * 0.014],
        ],
        0.0026,
        '#786b55',
        'cotton',
      );
    legs.push({ thigh, shin, foot });
    const upper = art.bone('shoulder' + s, spine, s * 0.189, 0.36, 0);
    const lower = art.bone('elbow' + s, upper, s * 0.019, -0.256, 0.004);
    const hand = art.bone('wrist' + s, lower, s * 0.004, -0.237, -0.005);
    art.shell(
      upper,
      [0, 0, 0],
      [
        [-0.272, 0.05, 0.051],
        [-0.243, 0.058, 0.056],
        [-0.212, 0.064, 0.062],
        [-0.167, 0.065, 0.067],
        [-0.106, 0.072, 0.073],
        [-0.057, 0.081, 0.081],
        [-0.018, 0.08, 0.079],
        [0.024, 0.059, 0.061],
        [0.042, 0.028, 0.034],
      ],
      jacket,
      'cotton',
      20,
      (a, f, pt) => {
        clothFolds(a, f, pt);
        pt[0] += s * 0.018 * (1 - f);
      },
    );
    if (hero) {
      art.shell(
        lower,
        [0, 0, 0],
        [
          [-0.243, 0.029, 0.031],
          [-0.213, 0.035, 0.037],
          [-0.167, 0.044, 0.044],
          [-0.105, 0.049, 0.047],
          [0.012, 0.053, 0.05],
        ],
        skin,
        'skin',
        20,
      );
      art.shell(
        lower,
        [0, 0, 0],
        [
          [-0.143, 0.048, 0.046],
          [-0.139, 0.055, 0.054],
          [-0.13, 0.059, 0.057],
          [-0.119, 0.054, 0.053],
          [-0.11, 0.056, 0.054],
          [-0.102, 0.053, 0.052],
          [-0.059, 0.059, 0.06],
          [0.016, 0.052, 0.053],
        ],
        jacket,
        'cotton',
        20,
        clothFolds,
      );
      art.shell(
        lower,
        [0, 0, 0],
        [
          [-0.142, 0.05, 0.05],
          [-0.138, 0.057, 0.056],
          [-0.131, 0.058, 0.056],
          [-0.128, 0.054, 0.053],
        ],
        '#939378',
        'canvas',
        20,
        clothFolds,
      );
    } else {
      art.shell(
        lower,
        [0, 0, 0],
        [
          [-0.229, 0.037, 0.039],
          [-0.21, 0.04, 0.042],
          [-0.19, 0.045, 0.047],
          [-0.177, 0.046, 0.045],
          [-0.151, 0.047, 0.049],
          [-0.102, 0.054, 0.055],
          [-0.049, 0.057, 0.057],
          [0.015, 0.049, 0.051],
        ],
        jacket,
        'cotton',
        18,
        clothFolds,
      );
      art.shell(
        lower,
        [0, -0.214, 0],
        [
          [-0.021, 0.037, 0.038],
          [-0.013, 0.041, 0.044],
          [0.01, 0.041, 0.044],
          [0.015, 0.039, 0.041],
        ],
        jacket,
        'canvas',
        16,
      );
    }
    art.oval(hand, [0, -0.033, 0], [0.029, 0.053, 0.023], skin, 'skin');
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.012 * s;
      art.oval(
        hand,
        [x, -0.079 + Math.abs(i - 1) * 0.004, -0.004],
        [0.007, 0.029 - i * 0.002, 0.011],
        skin,
        'skin',
        10,
      );
    }
    art.oval(hand, [-s * 0.027, -0.041, -0.008], [0.012, 0.03, 0.012], skin, 'skin', 10);
    arms.push({ upper, lower, hand });
    if (s === 1 && !civilian) {
      prop = art.bone('stage-prop', hand, 0, -0.042, 0);
      art.box(prop, [0, 0.027, -0.112], [0.048, 0.061, 0.287], '#494c48', 'metal');
      art.box(prop, [0, 0.019, 0.082], [0.047, 0.049, 0.147], '#615748', 'canvas');
      art.box(prop, [0, 0.036, -0.275], [0.025, 0.029, 0.078], '#555650', 'metal');
      art.box(prop, [0, -0.024, -0.092], [0.034, 0.064, 0.048], '#51534b', 'metal');
    }
  }
  const geometry = art.finish();
  const mesh = new THREE.SkinnedMesh(geometry, wardrobe());
  users++;
  const skeleton = new THREE.Skeleton(art.bones);
  mesh.add(root);
  mesh.bind(skeleton);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.91, 0), 1.08);
  group.add(mesh);
  group.name = kind;
  if (!hero) group.scale.setScalar(0.965 + v * 0.009);
  let t = v * 0.732,
    phase = v * 0.87,
    locomotion = 0,
    sprint = 0,
    crouch = 0,
    aim = 0,
    surrender = 0,
    fired = 0,
    busy = 0,
    reload = 0,
    hit = 0,
    up = 0,
    climb = 0,
    released = false;
  const damp = (a: number, b: number, k: number, dt: number) => THREE.MathUtils.damp(a, b, k, dt);
  function update(dt: number, state: ActorState) {
    dt = Math.max(0, Math.min(0.1, dt));
    t += dt;
    const speed = Math.max(0, state.speed || 0);
    locomotion = damp(locomotion, Math.min(1, speed / 1.9), 11, dt);
    sprint = damp(sprint, state.sprint ? 1 : 0, 9, dt);
    crouch = damp(crouch, state.crouch ? 1 : 0, 11, dt);
    aim = damp(aim, state.aim ? 1 : 0, 13, dt);
    surrender = damp(surrender, state.surrender ? 1 : 0, 8, dt);
    busy = damp(busy, Math.min(1, state.interact || 0), 10, dt);
    reload = damp(reload, Math.min(1, state.reload || 0), 11, dt);
    fired = Math.max(fired * Math.exp(-dt * 18), Math.min(1, state.fire || 0));
    hit = Math.max(hit * Math.exp(-dt * 10), Math.min(1, state.hit || 0));
    up = damp(up, Math.min(1, state.jump || 0), 9, dt);
    climb = damp(climb, state.climb ? 1 : 0, 10, dt);
    phase += dt * (5.2 + Math.min(speed, 6) * 1.37);
    const stride = Math.sin(phase),
      step = locomotion,
      breath = Math.sin(t * 2.3);
    root.position.y = 0.917 - 0.145 * crouch + 0.015 * step * Math.cos(phase * 2) + breath * 0.002;
    root.rotation.y = stride * step * 0.075;
    root.rotation.z = stride * step * 0.032 - hit * 0.075 + (1 - step) * (0.012 + 0.003 * breath);
    spine.rotation.x = -0.047 - 0.12 * sprint - 0.11 * crouch - 0.13 * busy + fired * 0.048 + hit * 0.14;
    spine.rotation.y = -root.rotation.y * 0.9 + 0.11 * aim + 0.11 * reload;
    head.rotation.x = 0.03 + 0.11 * crouch + 0.095 * sprint + 0.19 * busy + 0.27 * reload - 0.1 * up;
    head.rotation.y =
      (Math.sin(t * 0.73 + v) * 0.1 + Math.sin(t * 0.33) * 0.03) * (1 - step) * (1 - aim);
    head.rotation.z = -root.rotation.z * 0.7 + breath * 0.007;
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1,
        swing = s * stride,
        kneeWave = Math.max(0, -s * Math.cos(phase));
      const { thigh, shin, foot } = legs[i];
      thigh.rotation.x =
        step * (swing * (0.55 + 0.26 * sprint) + 0.13) +
        0.65 * crouch +
        up * (i ? 0.36 : 0.71) +
        climb * 0.75 * kneeWave;
      shin.rotation.x =
        -step * kneeWave * (0.69 + 0.38 * sprint) - 1.19 * crouch - up * 0.62 - climb * 0.58 * kneeWave;
      foot.rotation.x =
        -(thigh.rotation.x + shin.rotation.x) * (0.73 + 0.22 * crouch) + step * 0.085 * swing;
      const { upper, lower, hand } = arms[i];
      const hold = civilian || state.peaceful ? 0 : 1;
      upper.rotation.x =
        0.055 +
        (1 - step) * (0.045 * s + breath * 0.012) -
        swing * step * (0.38 + 0.24 * sprint) +
        0.19 * hold;
      upper.rotation.z = s * (0.095 + 0.029 * step + 0.013 * Math.sin(t * 1.1 + i) * (1 - step));
      lower.rotation.x = 0.13 + 0.14 * kneeWave * step + 0.24 * sprint + 0.44 * hold;
      // Explicit poses blend over the walk cycle, so upper-body actions can continue in motion.
      const blend = (x: number, y: number, w: number) => x + (y - x) * w;
      upper.rotation.x = blend(upper.rotation.x, i ? 0.94 : 1.13, aim);
      lower.rotation.x = blend(lower.rotation.x, i ? 0.72 : 0.55, aim);
      upper.rotation.z = blend(upper.rotation.z, i ? -0.15 : 0.49, aim);
      upper.rotation.x = blend(upper.rotation.x, 0.62 + Math.sin(t * 6) * 0.1, reload);
      lower.rotation.x = blend(lower.rotation.x, i ? 0.95 : 1.42, reload);
      upper.rotation.z = blend(upper.rotation.z, -s * 0.4, reload);
      upper.rotation.x = blend(upper.rotation.x, 0.72 + 0.11 * Math.sin(t * 4 + i), busy);
      lower.rotation.x = blend(lower.rotation.x, 0.89, busy);
      upper.rotation.z = blend(upper.rotation.z, -s * 0.19, busy);
      upper.rotation.x = blend(upper.rotation.x, 1.92 + s * stride * 0.68, climb);
      lower.rotation.x = blend(lower.rotation.x, 0.43 + s * Math.cos(phase) * 0.26, climb);
      upper.rotation.z = blend(upper.rotation.z, s * 1.99, surrender);
      upper.rotation.x = blend(upper.rotation.x, 0.34, surrender);
      lower.rotation.x = blend(lower.rotation.x, 1.33, surrender);
      upper.rotation.x += fired * 0.13;
      lower.rotation.x += fired * 0.12;
      hand.rotation.x = -0.15 + 0.07 * breath;
    }
    if (prop) {
      prop.rotation.x =
        -(arms[1].upper.rotation.x + arms[1].lower.rotation.x + arms[1].hand.rotation.x) -
        0.53 * (1 - aim) -
        0.12 * sprint +
        0.05 * fired;
      prop.rotation.z = -arms[1].upper.rotation.z;
      prop.scale.setScalar(state.peaceful ? 0.00001 : Math.max(0.001, 1 - surrender));
    }
  }
  update(0, { speed: 0 });
  function dispose() {
    if (released) return;
    released = true;
    geometry.dispose();
    skeleton.dispose();
    group.clear();
    if (--users === 0) {
      surface?.dispose();
      atlas?.dispose();
      surface = undefined;
      atlas = undefined;
    }
  }
  return { group, update, dispose };
}
