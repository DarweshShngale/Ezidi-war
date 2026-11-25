import * as THREE from 'three';

type XZ = [number, number];
type XYZ = [number, number, number];
type Finish =
  | 'stone'
  | 'plaster'
  | 'metal'
  | 'glass'
  | 'cloth'
  | 'bark'
  | 'foliage'
  | 'earth'
  | 'road'
  | 'light';
type Setting = {
  name: string;
  sky: number;
  fog: number;
  sunlight: number;
  plaster: number[];
  mountain?: boolean;
  camp?: boolean;
  night?: boolean;
  damage: number;
  street: number;
  weather: number;
};

const settings: Setting[] = [
  {
    name: 'ساحة العائلة',
    sky: 0xabc3c9,
    fog: 0xd4bc99,
    sunlight: 0xffdc9d,
    plaster: [0xd9bc8f, 0xc6a37b, 0xe2d3aa, 0xd3c1a8],
    damage: 0.08,
    street: 7.9,
    weather: 0.12,
  },
  {
    name: 'سوق النحّاسين',
    sky: 0x94afb7,
    fog: 0xb5a38c,
    sunlight: 0xf9cc96,
    plaster: [0xb6a490, 0xb09578, 0xc5afa0, 0xc7b598],
    damage: 0.65,
    street: 7,
    weather: 0.58,
  },
  {
    name: 'زقاق التوت',
    sky: 0x94a8b3,
    fog: 0xa9a7a1,
    sunlight: 0xffe3be,
    plaster: [0xc2b3a1, 0xbbab97, 0xcbb99e, 0xa89b91],
    damage: 0.82,
    street: 6.6,
    weather: 0.48,
  },
  {
    name: 'وادي الزيتون',
    sky: 0x96becb,
    fog: 0xc7b49b,
    sunlight: 0xffda99,
    plaster: [0xb1a385, 0xc8b38f],
    mountain: true,
    damage: 0.06,
    street: 9,
    weather: 0.22,
  },
  {
    name: 'حارة القناديل',
    sky: 0x202e48,
    fog: 0x414859,
    sunlight: 0xadc5fa,
    plaster: [0xb8a68c, 0xaca9a1, 0xc4b597],
    night: true,
    damage: 0.45,
    street: 6.8,
    weather: 0.22,
  },
  {
    name: 'بيوت النبع',
    sky: 0xa4b6bb,
    fog: 0xc2b6a7,
    sunlight: 0xffd5b2,
    plaster: [0xc2ac88, 0xbbaa8d, 0xe1c8a6],
    camp: true,
    damage: 0.34,
    street: 8,
    weather: 0.34,
  },
  {
    name: 'دروب المدرسة',
    sky: 0xaab4b5,
    fog: 0xc2aca0,
    sunlight: 0xffbd88,
    plaster: [0xbba18a, 0xb9a58d, 0xc3ada2],
    damage: 0.73,
    street: 9.3,
    weather: 0.57,
  },
  {
    name: 'ساحة البنّائين',
    sky: 0x9bb2c3,
    fog: 0xf1c397,
    sunlight: 0xffb265,
    plaster: [0xdcc097, 0xc5a990, 0xd5c2aa, 0xdbc9ac],
    damage: 0.27,
    street: 8.4,
    weather: 0.18,
  },
];

function random(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function canvasTexture(size: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 2;
  return texture;
}

// All surfaces originate from deterministic layered noise and hand-drawn motifs.
function textureFor(kind: Finish, size: number) {
  const rng = random(812 + kind.charCodeAt(0));
  return canvasTexture(size, (ctx) => {
    const pixels = ctx.createImageData(size, size);
    const fine = kind === 'road' || kind === 'earth';
    const levels = [4, 12, 32, 64].map((n) => ({ n, data: Float32Array.from({ length: n * n }, rng) }));
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let v = 0;
        for (let l = 0; l < levels.length; l++) {
          const { n, data } = levels[l];
          const fx = (x * n) / size,
            fy = (y * n) / size,
            ix = Math.floor(fx),
            iy = Math.floor(fy);
          const a = fx - ix,
            b = fy - iy,
            u = a * a * (3 - 2 * a),
            w = b * b * (3 - 2 * b);
          const row = (p: number) =>
            data[(p % n) * n + ix] * (1 - u) + data[(p % n) * n + ((ix + 1) % n)] * u;
          v += ((1 - w) * row(iy) + w * row(iy + 1) - 0.5) * [33, 24, 19, 14][l];
        }
        v += (rng() - 0.5) * (fine ? 38 : 14);
        if (kind === 'cloth') v += (x % 3 === 0 ? -8 : 2) + (y % 4 === 0 ? -5 : 1);
        if (kind === 'bark') v += 9 * Math.sin(x * 0.48 + Math.sin(y * 0.045 + x * 0.16));
        const i = (y * size + x) * 4,
          base = 224 + v;
        pixels.data[i] = base + 3;
        pixels.data[i + 1] = base + 1;
        pixels.data[i + 2] = base - 3;
        pixels.data[i + 3] = 255;
      }
    ctx.putImageData(pixels, 0, 0);
    if (kind === 'stone') {
      const h = size / 9;
      for (let row = 0; row < 9; row++) {
        for (let col = -1; col < 6; col++) {
          const x = ((col + (row % 2) * 0.53) * size) / 5,
            y = row * h;
          ctx.fillStyle = 'rgba(50,42,34,.22)';
          ctx.fillRect(x, y, size / 5, 1.3);
          ctx.fillRect(x, y, 1.5, h);
          ctx.fillStyle = 'rgba(255,250,233,.26)';
          ctx.fillRect(x + 2, y + 2, size / 5 - 3, 1);
          ctx.fillStyle = 'rgba(83,71,55,' + rng() * 0.12 + ')';
          ctx.fillRect(x + 2, y + 3, size / 5 - 3, h - 3);
        }
      }
    }
    if (kind === 'road' || kind === 'plaster' || kind === 'earth') {
      for (let c = 0; c < (kind === 'earth' ? 2 : 8); c++) {
        let x = rng() * size,
          y = rng() * size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 4 + rng() * 9; j++) {
          x += (rng() - 0.5) * size * 0.047;
          y += rng() * size * 0.031;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(64,55,46,' + (0.13 + rng() * 0.23) + ')';
        ctx.lineWidth = 0.4 + rng() * 0.9;
        ctx.stroke();
      }
      if (fine)
        for (let i = 0; i < size * 3; i++) {
          const x = rng() * size,
            y = rng() * size,
            d = rng() * 1.8 + 0.55;
          ctx.fillStyle = 'rgba(91,78,61,.27)';
          ctx.fillRect(x, y, d + 1, d);
          ctx.fillStyle = 'rgba(254,251,229,.55)';
          ctx.fillRect(x, y, d * 0.75, 1);
        }
    }
    if (kind === 'metal')
      for (let i = 0; i < 42; i++) {
        ctx.fillStyle = 'rgba(99,78,62,' + (0.02 + rng() * 0.1) + ')';
        ctx.fillRect(rng() * size, rng() * size, 0.7 + rng() * 2, rng() * size * 0.32);
      }
  });
}

type BufferGroup = {
  pos: number[];
  normal: number[];
  uv: number[];
  color: number[];
  indices: number[];
  mat: THREE.Material;
};
type Frame = { x: number; y: number; z: number; angle: number };

// The panoramic plate supplies fine distant geology. Local slopes, caves and buildings
// use solid geometry so the playable terrain still has parallax and collision.
function skyDome(cfg: Setting, index: number, photo: THREE.Texture) {
  const geometry = new THREE.SphereGeometry(275, 48, 20);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      photo: { value: photo },
      night: { value: cfg.night ? 1 : 0 },
      weather: { value: cfg.weather },
      bearing: { value: index * 0.39 },
      mist: { value: new THREE.Color(cfg.fog) },
    },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.99995;}`,
    fragmentShader: `uniform sampler2D photo;uniform float night,weather,bearing;uniform vec3 mist;varying vec3 direction;
      void main(){vec3 dir=normalize(direction);float ang=atan(dir.x,-dir.z)+bearing;
      vec2 uv=vec2(1.-abs(fract(ang/4.5+.27)*2.-1.),clamp(.47+dir.y*.97,.055,.99));
      vec3 base=texture2D(photo,uv).rgb;
      base=mix(base,mist,.06+weather*.09);float lum=dot(base,vec3(.21,.72,.07));
      base=mix(base,vec3(.025,.042,.075)+lum*vec3(.14,.18,.26),night);
      gl_FragColor=vec4(base,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 50;
  return mesh;
}
export function buildWorld(index: number, quality: number) {
  index = Math.max(0, Math.min(7, Math.floor(index)));
  quality = Math.max(0, Math.min(3, Math.floor(quality) || 0));
  const cfg = settings[index],
    rng = random(0x512e + index * 219);
  const group = new THREE.Group(),
    blockers: THREE.Box3[] = [];
  let completedGoals = 0;
  let courtyardLamp: THREE.Group | undefined;
  let rollingShutter: THREE.Group | undefined;
  group.name = cfg.name;
  const bounds = 33;
  const heightAt = (x: number, z: number) =>
    cfg.mountain
      ? 1.8 +
        1.05 * Math.sin(z * 0.095) +
        0.7 * Math.sin(x * 0.107 + 0.6) +
        0.45 * Math.cos((x + z) * 0.12)
      : cfg.camp
        ? 0.22 * Math.sin(x * 0.12) * Math.cos(z * 0.12)
        : 0;
  const spawn: XZ = [0, 24];
  const routes: XZ[][] = [
    [
      [-0.8, 12],
      [-2.5, 1],
      [3.5, -11],
      [0, -24],
    ],
    [
      [1, 12],
      [3, 1],
      [-3, -12],
      [2, -25],
    ],
    [
      [-1, 11],
      [-3.7, -0.5],
      [2.3, -10],
      [-0.8, -26],
    ],
    [
      [1.4, 13],
      [-1, 3],
      [4, -9],
      [-2, -24],
    ],
    [
      [-0.5, 11],
      [-3.1, -1.5],
      [2.2, -12],
      [0, -26],
    ],
    [
      [1.1, 13],
      [4, 1],
      [-3.2, -12],
      [2, -25],
    ],
    [
      [-1.7, 13],
      [2.1, 1],
      [4.4, -12],
      [-1, -25],
    ],
    [
      [0, 12],
      [-3.8, 2],
      [3.1, -10],
      [1, -25],
    ],
  ];
  const objectives = routes[index],
    landmarks: XZ[] = objectives.map(([x, z]) => [x, z]),
    optional: XZ = [index % 2 ? -4.7 : 4.7, 6.5];
  const encounters: XZ[] = [
    [-2.7, -4],
    [3.8, -17],
    [-2.1, -23],
    [4.2, -7],
  ];
  const midXZ: XZ[] = [spawn, ...objectives, optional, ...encounters];
  const textures = new Set<THREE.Texture>(),
    materials = new Set<THREE.Material>();
  const geometrySet = new Set<THREE.BufferGeometry>();
  const palette = new Map<Finish, THREE.MeshStandardMaterial>();
  const imageMaps = new Map<string, THREE.Texture>();
  const mat = (kind: Finish) => {
    let m = palette.get(kind);
    if (m) return m;
    const textured = !['glass', 'light', 'foliage'].includes(kind);
    const imageName =
      kind === 'road' || kind === 'earth'
        ? 'road'
        : kind === 'plaster'
          ? 'plaster'
          : kind === 'stone'
            ? 'stone'
            : '';
    const tex = imageName
      ? (imageMaps.get(imageName) ?? new THREE.TextureLoader().load('./art/' + imageName + '.webp'))
      : textured
        ? textureFor(kind, quality < 1 ? 128 : 256)
        : null;
    if (tex && imageName) {
      imageMaps.set(imageName, tex);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = quality > 1 ? 4 : 2;
    }
    if (tex) textures.add(tex);
    m = new THREE.MeshStandardMaterial({
      map: tex,
      vertexColors: true,
      roughness: kind === 'glass' ? 0.26 : kind === 'metal' ? 0.66 : 0.93,
      metalness: kind === 'glass' ? 0.32 : kind === 'metal' ? 0.25 : 0,
    });
    if (kind === 'light') {
      m.emissive.setHex(cfg.night ? 0xffab54 : 0x846642);
      m.emissiveIntensity = cfg.night ? 1.8 : 0.25;
    }
    palette.set(kind, m);
    materials.add(m);
    return m;
  };
  const sources = {
    box: new THREE.BoxGeometry(1, 1, 1),
    rod: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    tank: new THREE.CylinderGeometry(0.5, 0.47, 1, 14),
    cone: new THREE.ConeGeometry(0.5, 1, 18),
    rock: new THREE.IcosahedronGeometry(0.5, 0),
    boulder: new THREE.IcosahedronGeometry(0.5, 1),
    round: new THREE.SphereGeometry(0.5, 10, 7),
    ring: new THREE.TorusGeometry(0.43, 0.055, 6, 18),
  };
  type Shape = keyof typeof sources;
  let buffers = new Map<string, BufferGroup>();
  const frame: Frame = { x: 0, y: 0, z: 0, angle: 0 };
  const position = new THREE.Vector3(),
    rotation = new THREE.Quaternion(),
    scale = new THREE.Vector3();
  const transform = new THREE.Matrix4(),
    normalTransform = new THREE.Matrix3(),
    fMat = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0),
    axis = new THREE.Vector3(),
    euler = new THREE.Euler(),
    point = new THREE.Vector3(),
    norm = new THREE.Vector3(),
    tint = new THREE.Color();
  const moveFrame = (x = 0, y = 0, z = 0, angle = 0) => {
    Object.assign(frame, { x, y, z, angle });
    fMat.makeRotationY(angle);
    fMat.setPosition(x, y, z);
  };
  moveFrame();
  function part(
    shape: Shape,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    kind: Finish = 'plaster',
    rx = 0,
    ry = 0,
    rz = 0,
    orient?: THREE.Quaternion,
  ) {
    const source = sources[shape],
      a = source.attributes;
    position.set(x, y, z);
    scale.set(w, h, d);
    if (orient) rotation.copy(orient);
    else rotation.setFromEuler(euler.set(rx, ry, rz));
    transform.compose(position, rotation, scale).premultiply(fMat);
    normalTransform.getNormalMatrix(transform);
    const key =
      kind +
      '_' +
      Math.floor((transform.elements[12] + 36) / 26) +
      '_' +
      Math.floor((transform.elements[14] + 36) / 26);
    let b = buffers.get(key);
    if (!b) {
      b = { pos: [], normal: [], uv: [], color: [], indices: [], mat: mat(kind) };
      buffers.set(key, b);
    }
    const base = b.pos.length / 3;
    tint.setHex(color);
    const den = kind === 'stone' ? 0.31 : kind === 'road' ? 0.19 : kind === 'earth' ? 0.3 : 0.43;
    for (let i = 0; i < a.position.count; i++) {
      point.fromBufferAttribute(a.position, i).applyMatrix4(transform);
      norm.fromBufferAttribute(a.normal, i).applyNormalMatrix(normalTransform);
      b.pos.push(point.x, point.y, point.z);
      b.normal.push(norm.x, norm.y, norm.z);
      b.color.push(tint.r, tint.g, tint.b);
      if (Math.abs(norm.y) > 0.62) b.uv.push(point.x * den, point.z * den);
      else if (Math.abs(norm.x) > 0.62) b.uv.push(point.z * den, point.y * den);
      else b.uv.push(point.x * den, point.y * den);
    }
    if (source.index) for (const v of source.index.array) b.indices.push(base + v);
    else for (let i = 0; i < a.position.count; i++) b.indices.push(base + i);
  }
  function beam(a: XYZ, b: XYZ, width: number, color: number, kind: Finish = 'metal', round = true) {
    axis.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = axis.length();
    if (length < 0.001) return;
    const q = new THREE.Quaternion().setFromUnitVectors(up, axis.normalize());
    part(
      round ? 'rod' : 'box',
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2,
      width,
      length,
      width,
      color,
      kind,
      0,
      0,
      0,
      q,
    );
  }
  function collision(x: number, z: number, w: number, h: number, d: number, y = heightAt(x, z)) {
    blockers.push(
      new THREE.Box3(
        new THREE.Vector3(x - w / 2, y - 0.35, z - d / 2),
        new THREE.Vector3(x + w / 2, y + h, z + d / 2),
      ),
    );
  }
  function localBlock(x: number, y: number, z: number, w: number, h: number, d: number) {
    blockers.push(
      new THREE.Box3(
        new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
        new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
      ).applyMatrix4(fMat),
    );
  }
  function register(mesh: THREE.Mesh, cast = false, receive = true) {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    group.add(mesh);
    geometrySet.add(mesh.geometry);
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => materials.add(m));
    else materials.add(mesh.material);
    return mesh;
  }
  const ridgeTexture = new THREE.TextureLoader().load('./art/ridgeline.webp');
  ridgeTexture.colorSpace = THREE.SRGBColorSpace;
  textures.add(ridgeTexture);
  register(skyDome(cfg, index, ridgeTexture), false, false);
  const groundGeo = new THREE.PlaneGeometry(
    192,
    192,
    cfg.mountain ? 104 : cfg.camp ? 44 : 4,
    cfg.mountain ? 104 : cfg.camp ? 44 : 4,
  );
  groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position,
    gu = groundGeo.attributes.uv,
    gc: number[] = [];
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i),
      z = gp.getZ(i);
    gp.setY(i, heightAt(x, z) - 0.03);
    gu.setXY(i, x * 0.32, z * 0.32);
    tint
      .setHex(cfg.mountain ? 0xb2a084 : 0xc4b395)
      .multiplyScalar(0.91 + 0.07 * Math.sin(x * 0.28 + z * 0.09) + 0.07 * rng());
    gc.push(tint.r, tint.g, tint.b);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
  groundGeo.computeVertexNormals();
  register(new THREE.Mesh(groundGeo, mat('earth')));
  function road() {
    const p: number[] = [],
      colors: number[] = [],
      uv: number[] = [],
      idx: number[] = [];
    for (let i = 0; i <= 54; i++) {
      const z = -54 + i * 2,
        center = Math.sin(z * 0.06 + index) * (cfg.mountain ? 1.4 : 0.32);
      const spread = cfg.mountain ? 2.35 : cfg.street - 0.55;
      for (let j = 0; j <= 4; j++) {
        const x = center + (j / 4 - 0.5) * spread * 2 + (j === 0 || j === 4 ? (rng() - 0.5) * 0.35 : 0);
        p.push(x, heightAt(x, z) + 0.018, z);
        uv.push(x * 0.21, z * 0.21);
        tint
          .setHex(cfg.mountain || cfg.camp ? 0xccb593 : 0x999086)
          .multiplyScalar(0.88 + rng() * 0.12 + (j === 0 || j === 4 ? 0.07 : 0));
        colors.push(tint.r, tint.g, tint.b);
      }
      if (i < 54)
        for (let j = 0; j < 4; j++) {
          const a = i * 5 + j;
          idx.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    register(new THREE.Mesh(g, mat(cfg.mountain ? 'earth' : 'road')));
  }
  road();
  function distanceDetail(mesh: THREE.Mesh, range: number) {
    const levels = new THREE.LOD();
    levels.position.copy(mesh.position);
    mesh.position.set(0, 0, 0);
    levels.addLevel(mesh, 0);
    levels.addLevel(new THREE.Object3D(), range, 0.12);
    group.add(levels);
  }
  const signs = new Map<string, THREE.MeshStandardMaterial>();
  function sign(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    arabic: string,
    kurmanji = '',
    painted = false,
  ) {
    const key = arabic + '|' + kurmanji;
    let m = signs.get(key);
    if (!m) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 176;
      const ctx = canvas.getContext('2d')!;
      if (!painted) {
        ctx.fillStyle = ['#355956', '#404f5b', '#71514a'][key.length % 3];
        ctx.fillRect(0, 0, 512, 176);
        ctx.strokeStyle = '#baa987';
        ctx.lineWidth = 4;
        ctx.strokeRect(8, 8, 496, 160);
        ctx.lineWidth = 1;
        ctx.strokeRect(14, 14, 484, 148);
      }
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = painted ? '#655145' : '#f4e6c8';
      ctx.font = 'bold ' + (kurmanji ? '56' : '74') + 'px serif';
      ctx.fillText(arabic, 256, kurmanji ? 71 : 88, 472);
      if (kurmanji) {
        ctx.direction = 'ltr';
        ctx.font = '24px serif';
        ctx.fillText(kurmanji, 256, 133, 478);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      textures.add(tex);
      m = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: painted,
        roughness: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      signs.set(key, m);
    }
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    o.position.set(x, y, z).applyMatrix4(fMat);
    o.rotation.y = frame.angle;
    register(o);
    distanceDetail(o, quality < 1 ? 26 : quality === 1 ? 38 : 58);
  }
  const shopText = [
    'مخبز الساحة',
    'دكان الزيتون',
    'خياطة نسرين',
    'مكتبة الجبل',
    'سوق النحاس',
    'بيت الخزّاف',
    'أدوات البناء',
    'سنعود ونبني من جديد',
  ];
  function building(
    x: number,
    z: number,
    rotationY: number,
    w: number,
    d: number,
    stories: number,
    style: number,
    details = true,
  ) {
    const y = heightAt(x, z) - 0.08,
      floor = 2.75,
      front = d * 0.5,
      hw = w / 2,
      height = floor * stories;
    moveFrame(x, y, z, rotationY);
    const wall = cfg.plaster[Math.floor(rng() * cfg.plaster.length)],
      edge = 0xd2c4ac,
      frameColor = [0x5f625a, 0x4a534e, 0x75665a][style % 3];
    const decayed = details && rng() < cfg.damage;
    part('box', 0, 0.22, 0, w + 0.12, 0.5, d + 0.1, 0x998979, 'stone');
    part(
      'box',
      0,
      height * 0.5,
      -0.14,
      w,
      height,
      d - 0.28,
      wall,
      style % 5 === 3 ? 'stone' : 'plaster',
    );
    for (let floorIndex = 0; floorIndex < stories; floorIndex++) {
      const fy = floorIndex * floor,
        columns = Math.max(2, Math.round((w - 0.4) / 2.3)),
        bay = w / columns;
      if (floorIndex > 0) part('box', 0, fy + 0.02, 0, w + 0.18, 0.21, d + 0.16, edge);
      for (let col = 0; col < columns; col++) {
        const cx = -hw + bay * (col + 0.5),
          isDoor = floorIndex === 0 && col === style % columns;
        const opening = isDoor ? Math.min(1.36, bay * 0.7) : bay * (style % 2 ? 0.62 : 0.67);
        const bottom = isDoor ? 0.12 : 0.86,
          top = isDoor ? 2.25 : 2.09;
        const damage = decayed && floorIndex === stories - 1 && col === 0;
        const post = (bay - opening) * 0.5;
        if (!damage) {
          part(
            'box',
            cx - bay * 0.5 + post * 0.5,
            fy + floor * 0.5,
            front - 0.1,
            post,
            floor,
            0.24,
            wall,
          );
          part(
            'box',
            cx + bay * 0.5 - post * 0.5,
            fy + floor * 0.5,
            front - 0.1,
            post,
            floor,
            0.24,
            wall,
          );
          if (!isDoor) part('box', cx, fy + bottom * 0.5, front - 0.1, opening, bottom, 0.24, wall);
          part('box', cx, fy + (floor + top) / 2, front - 0.1, opening, floor - top, 0.24, wall);
        }
        const panelZ = front - 0.23;
        part(
          'box',
          cx,
          fy + (bottom + top) / 2,
          panelZ,
          opening + 0.04,
          top - bottom,
          0.055,
          isDoor
            ? 0x5e5b51
            : damage
              ? 0x333333
              : cfg.night && (col + floorIndex + style) % 5 === 1
                ? 0xffca82
                : 0x52605e,
          isDoor
            ? 'bark'
            : cfg.night && !damage && (col + floorIndex + style) % 5 === 1
              ? 'light'
              : 'glass',
        );
        if (!details) continue;
        if (!damage) {
          part('box', cx, fy + bottom - 0.018, front + 0.04, opening + 0.18, 0.1, 0.28, edge);
          if (isDoor) {
            part(
              'box',
              cx,
              fy + (bottom + top) / 2,
              panelZ + 0.065,
              opening * 0.92,
              top - bottom - 0.11,
              0.055,
              [0x58645a, 0x5c7070, 0x805b4e][style % 3],
              'metal',
            );
            for (const off of [-0.23, 0.23])
              for (let k = 0; k < 2; k++)
                part(
                  'box',
                  cx + off * opening,
                  fy + 0.56 + k * 0.92,
                  panelZ + 0.11,
                  opening * 0.34,
                  0.59,
                  0.036,
                  frameColor,
                  'metal',
                );
            part(
              'box',
              cx + 0.31 * opening,
              fy + 1.08,
              panelZ + 0.17,
              0.05,
              0.17,
              0.06,
              0xc1a577,
              'metal',
            );
            part('box', cx, fy + 0.086, front + 0.2, opening + 0.3, 0.16, 0.5, 0xb9ad97, 'stone');
          } else {
            part(
              'box',
              cx,
              fy + (top + bottom) / 2,
              front - 0.1,
              0.052,
              top - bottom,
              0.09,
              frameColor,
              'metal',
            );
            part('box', cx, fy + top - 0.33, front - 0.1, opening, 0.055, 0.09, frameColor, 'metal');
            if (style % 3 === 0 && floorIndex === 0) {
              for (let j = -1; j <= 1; j++)
                part(
                  'box',
                  cx + j * opening * 0.27,
                  fy + (top + bottom) / 2,
                  front + 0.015,
                  0.027,
                  top - bottom,
                  0.055,
                  0x555449,
                  'metal',
                );
            } else if (style % 4 === 1) {
              for (const side of [-1, 1])
                part(
                  'box',
                  cx + side * (opening / 2 + 0.15),
                  fy + (top + bottom) / 2,
                  front + 0.03,
                  0.29,
                  top - bottom,
                  0.075,
                  frameColor,
                  'bark',
                  0,
                  side * 0.09,
                );
            }
          }
        } else {
          part(
            'box',
            cx - 0.13,
            fy + 0.35,
            front + 0.02,
            bay * 0.68,
            0.7,
            0.35,
            0x9c8771,
            'stone',
            0,
            0,
            0.08,
          );
          for (let r = 0; r < 3; r++)
            beam(
              [cx - 0.7 + r * 0.3, fy + 0.45, front],
              [cx - 0.62 + r * 0.32, fy + 1.15 + rng() * 0.37, front + 0.04],
              0.028,
              0x5f5148,
            );
        }
      }
      if (stories > 1 && floorIndex === 1 && details && style % 3 !== 2) {
        const bw = Math.min(w * 0.6, 4.3),
          bz = front + 0.5;
        part('box', 0, fy + 0.05, bz, bw, 0.2, 1.15, edge);
        localBlock(0, fy + 0.52, bz, bw, 1.12, 1.15);
        for (let bar = 0; bar < 12; bar++)
          part(
            'rod',
            -bw / 2 + (bw * bar) / 11,
            fy + 0.58,
            front + 1.03,
            0.034,
            0.88,
            0.034,
            frameColor,
            'metal',
          );
        beam([-bw / 2, fy + 1.01, front + 1.03], [bw / 2, fy + 1.01, front + 1.03], 0.06, frameColor);
        for (const s of [-1, 1])
          beam(
            [(s * bw) / 2, fy + 1.01, front + 0.03],
            [(s * bw) / 2, fy + 1.01, front + 1.03],
            0.06,
            frameColor,
          );
        if (style % 2 === 0)
          part('box', 0.3, fy + 0.77, front + 1.07, bw * 0.36, 0.53, 0.035, 0xb08062, 'cloth', 0.06);
      }
    }
    // Flat roof slabs, parapets and domestic silhouettes.
    part('box', 0, height + 0.07, 0, w + 0.36, 0.2, d + 0.35, 0xb8ab99);
    const frontLen = decayed ? w * 0.55 : w;
    part('box', (w - frontLen) * 0.5, height + 0.35, front - 0.05, frontLen, 0.5, 0.22, wall);
    part('box', 0, height + 0.38, -front, w, 0.54, 0.25, wall);
    for (const s of [-1, 1]) part('box', s * (hw - 0.1), height + 0.36, 0, 0.25, 0.51, d, wall);
    if (details) {
      if (style % 2 === 0) {
        const tx = hw * 0.42,
          tz = -front * 0.4;
        part('tank', tx, height + 1.05, tz, 1.36, 1.7, 1.36, 0xaaa89c, 'metal');
        for (const yy of [0.3, 0.94, 1.63])
          part('rod', tx, height + yy, tz, 1.4, 0.055, 1.4, 0x757671, 'metal');
        part('rod', tx, height + 1.93, tz, 0.45, 0.1, 0.45, 0x696c66, 'metal');
      } else {
        part('rod', hw * 0.4, height + 1.25, -0.7, 0.048, 2.5, 0.048, 0x6e685b, 'metal');
        for (let l = 0; l < 3; l++)
          beam(
            [hw * 0.4 - 0.44, height + 2.03 + l * 0.17, -0.7],
            [hw * 0.4 + 0.44, height + 2.03 + l * 0.17, -0.7],
            0.026,
            0x837969,
          );
      }
      if (decayed) {
        for (let j = 0; j < 5; j++) {
          const ax = -hw + j * 0.22;
          beam(
            [ax, height + 0.15, front - 0.06],
            [ax + (0.5 - rng()) * 0.2, height + 0.53 + rng() * 0.62, front + 0.06],
            0.031,
            0x6d5648,
          );
          part(
            'rock',
            ax,
            0.17,
            front + 0.48 + rng() * 0.68,
            0.4 + rng() * 0.6,
            0.19 + rng() * 0.35,
            0.4 + rng() * 0.45,
            0xac9986,
            'stone',
            rng(),
            rng(),
          );
        }
      }
      if ((index === 1 || index === 0 || index === 7) && style % 3 !== 2) {
        const awColor = [0x805c4b, 0x6e786c, 0x9d8060, 0x515e66][style % 4],
          awWidth = w * 0.75;
        localBlock(0, 2.32, front + 0.78, awWidth, 0.36, 1.56);
        for (let j = 0; j < 7; j++) {
          const ax = awWidth * ((j + 0.5) / 7 - 0.5);
          part(
            'box',
            ax,
            2.38,
            front + 0.78,
            awWidth / 7 + 0.008,
            0.061,
            1.55,
            j % 2 ? awColor : 0xc9b69a,
            'cloth',
            0.18,
          );
          part(
            'box',
            ax,
            2.17,
            front + 1.52,
            awWidth / 7,
            0.22,
            0.044,
            j % 2 ? awColor : 0xc9b69a,
            'cloth',
          );
        }
        for (const s of [-1, 1])
          beam(
            [s * awWidth * 0.46, 1.91, front],
            [s * awWidth * 0.46, 2.24, front + 1.5],
            0.045,
            0x686154,
          );
        sign(
          0,
          2.66,
          front + 0.04,
          Math.min(3.4, w * 0.55),
          0.64,
          shopText[(style + index) % shopText.length],
        );
      } else if (style % 5 === 1) {
        sign(
          0,
          2.44,
          front + 0.06,
          Math.min(3.6, w * 0.72),
          0.72,
          index === 2 ? 'لن ننسى' : 'السلام لأرض شنكال',
          'Silav ji Şingalê',
          true,
        );
      }
    }
    const swap = Math.abs(Math.sin(rotationY)) > 0.6;
    collision(x, z, swap ? d : w, height + 0.6, swap ? w : d, y);
    moveFrame();
  }
  const leafMatrices: THREE.Matrix4[] = [],
    leafColors: THREE.Color[] = [];
  function olive(x: number, z: number, size: number) {
    moveFrame(x, heightAt(x, z), z, rng() * Math.PI * 2);
    part(
      'tank',
      0,
      size * 0.54,
      0,
      size * 0.43,
      size * 1.12,
      size * 0.34,
      0x736655,
      'bark',
      0.07,
      0,
      -0.14,
    );
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 0.4 + rng() * 0.66,
        tx = Math.cos(a) * size * (0.59 + rng() * 0.36),
        tz = Math.sin(a) * size * (0.59 + rng() * 0.36),
        ty = size * (1.12 + rng() * 0.29);
      beam([0.03, size * 0.68, 0.02], [tx * 0.57, ty, tz * 0.57], size * 0.18, 0x7c7060, 'bark');
      beam([tx * 0.57, ty, tz * 0.57], [tx, ty + size * 0.24, tz], size * 0.09, 0x7b6c5a, 'bark');
      for (let j = 0; j < 5; j++) {
        position.set(
          tx + (rng() - 0.5) * size * 0.45,
          ty + size * (0.27 + rng() * 0.29),
          tz + (rng() - 0.5) * size * 0.47,
        );
        rotation.setFromEuler(euler.set((rng() - 0.5) * 1.2, a + j * 0.98, (rng() - 0.5) * 0.8));
        scale.set(size * (1.1 + rng() * 0.42), size * (0.8 + rng() * 0.31), 1);
        const color = new THREE.Color().setRGB(
          0.72 + rng() * 0.22,
          0.75 + rng() * 0.18,
          0.71 + rng() * 0.18,
        );
        if (quality > 0 || j < 3) {
          leafMatrices.push(new THREE.Matrix4().compose(position, rotation, scale).premultiply(fMat));
          leafColors.push(color);
        }
      }
    }
    collision(x, z, size * 0.44, size * 2.15, size * 0.44);
    moveFrame();
  }
  function foliage() {
    if (!leafMatrices.length) return;
    const tex = canvasTexture(256, (ctx) => {
      ctx.clearRect(0, 0, 256, 256);
      for (let k = 0; k < 19; k++) {
        const a = k * 0.34 + 0.62 * rng(),
          fromX = 112 + rng() * 26,
          fromY = 112 + rng() * 36,
          len = 51 + rng() * 70;
        const dx = Math.cos(a),
          dy = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.quadraticCurveTo(
          fromX + dx * len * 0.45 + dy * 6,
          fromY + dy * len * 0.45,
          fromX + dx * len,
          fromY + dy * len,
        );
        ctx.strokeStyle = '#71715c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        for (let j = 0; j < 13; j++)
          for (const s of [-1, 1]) {
            const f = (j + rng()) / 13,
              la = a + s * (0.47 + rng() * 0.73),
              l = 3 + rng() * 7;
            const lx = fromX + dx * len * f + Math.cos(la) * l * 0.75,
              ly = fromY + dy * len * f + Math.sin(la) * l * 0.75;
            ctx.beginPath();
            ctx.ellipse(lx, ly, l, 1.5 + rng() * 2.7, la, 0, Math.PI * 2);
            ctx.fillStyle = ['#798168', '#8c9479', '#657457', '#a0a48b', '#69775b', '#8d9777'][
              Math.floor(rng() * 6)
            ];
            ctx.fill();
          }
      }
    });
    textures.add(tex);
    const material = new THREE.MeshStandardMaterial({
      map: tex,
      alphaTest: 0.33,
      side: THREE.DoubleSide,
      roughness: 0.95,
    });
    const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, leafMatrices.length);
    for (let i = 0; i < leafMatrices.length; i++) {
      leaves.setMatrixAt(i, leafMatrices[i]);
      leaves.setColorAt(i, leafColors[i]);
    }
    leaves.computeBoundingSphere();
    register(leaves, quality > 0);
  }
  function safe(x: number, z: number, r: number) {
    return midXZ.every((p) => Math.hypot(p[0] - x, p[1] - z) > r + 0.95);
  }
  function vehicle(x: number, z: number, angle: number, abandoned: boolean) {
    const y = heightAt(x, z),
      body = [0x938c77, 0xa19a88, 0x78837c, 0xab9c89][index % 4];
    moveFrame(x, y, z, angle);
    // Boxy older estate, assembled with an inclined windshield, recessed grille and independent tires.
    part('box', 0, 0.66, 0, 1.76, 0.5, 3.9, body, 'metal');
    part('box', 0, 0.76, 1.41, 1.74, 0.35, 1.12, body, 'metal', -0.06);
    part('box', 0, 1.17, -0.16, 1.51, 0.68, 1.72, 0x475653, 'glass');
    part('box', 0, 1.25, 0.7, 1.51, 0.61, 0.095, 0x536362, 'glass', -0.44);
    part('box', 0, 1.24, -1.02, 1.5, 0.59, 0.1, 0x59615c, 'glass', 0.35);
    part('box', 0, 1.54, -0.18, 1.59, 0.096, 1.64, body, 'metal');
    for (const s of [-1, 1]) {
      for (const zz of [-0.94, -0.15, 0.61])
        part(
          'box',
          s * 0.77,
          1.23,
          zz,
          0.064,
          0.65,
          0.072,
          body,
          'metal',
          zz < -0.8 ? 0.29 : zz > 0.5 ? -0.39 : 0,
        );
      part('box', s * 0.89, 0.7, -0.02, 0.04, 0.035, 2.32, 0x636357, 'metal');
      part('box', s * 0.89, 0.88, 0.22, 0.053, 0.055, 0.18, 0x737773, 'metal');
      part('box', s * 0.99, 1.08, 0.53, 0.2, 0.13, 0.2, body, 'metal');
      for (const zz of [-1.16, 1.17]) {
        part('rod', s * 0.82, 0.38, zz, 0.7, 0.24, 0.7, 0x474542, 'metal', 0, 0, Math.PI / 2);
        part('rod', s * 0.945, 0.38, zz, 0.38, 0.027, 0.38, 0x898a80, 'metal', 0, 0, Math.PI / 2);
        part('rod', s * 0.967, 0.38, zz, 0.17, 0.026, 0.17, 0x61635b, 'metal', 0, 0, Math.PI / 2);
      }
      part('box', s * 0.58, 0.71, 1.97, 0.38, 0.17, 0.045, 0xcebc92, 'glass');
      part('box', s * 0.63, 0.74, -1.97, 0.3, 0.17, 0.05, 0x885b50, 'glass');
    }
    part('box', 0, 0.43, 1.98, 1.72, 0.14, 0.17, 0x81827a, 'metal');
    part('box', 0, 0.69, 1.98, 0.68, 0.23, 0.07, 0x4e514e, 'metal');
    for (let k = 0; k < 3; k++)
      part('box', 0, 0.61 + k * 0.07, 2.025, 0.64, 0.024, 0.028, 0x96958a, 'metal');
    if (abandoned) {
      part('box', -0.87, 0.69, -0.41, 0.07, 0.57, 0.96, 0x817565, 'metal', 0, -0.42);
      part('box', 0.29, 0.99, 1.28, 0.56, 0.018, 0.67, 0x998779, 'metal', 0.02, 0.22);
    }
    collision(
      x,
      z,
      Math.abs(Math.cos(angle)) * 1.9 + Math.abs(Math.sin(angle)) * 3.9,
      1.55,
      Math.abs(Math.cos(angle)) * 3.9 + Math.abs(Math.sin(angle)) * 1.9,
    );
    moveFrame();
  }
  function crate(x: number, z: number, s: number, stack: boolean) {
    moveFrame(x, heightAt(x, z), z, 0);
    for (let j = 0; j < (stack ? 2 : 1); j++) {
      part('box', j * 0.06, (j + 0.5) * s, 0, s * 1.27, s * 0.93, s * 0.91, 0x9e8463, 'bark');
      for (const a of [-1, 1]) {
        part(
          'box',
          a * s * 0.43,
          (j + 0.5) * s,
          s * 0.47,
          s * 0.084,
          s * 0.98,
          s * 0.05,
          0xb29b77,
          'bark',
        );
        part(
          'box',
          j * 0.06,
          (j + 0.5) * s + a * s * 0.35,
          s * 0.47,
          s * 1.24,
          s * 0.045,
          s * 0.04,
          0x826f58,
          'bark',
        );
      }
      part('box', j * 0.06, j * s + s * 0.98, 0, s * 1.35, s * 0.07, s * 0.99, 0xb29b78, 'bark');
    }
    collision(x, z, 1.33 * s, (stack ? 2 : 1) * s, s);
    moveFrame();
  }
  function tent(x: number, z: number, angle: number, w: number) {
    const h = w * 0.52,
      d = w * 1.34,
      y = heightAt(x, z);
    moveFrame(x, y, z, angle);
    const color = [0xb0a18a, 0xc5b69c, 0xa9aa94][Math.floor(rng() * 3)];
    for (const s of [-1, 1]) {
      part('box', s * w * 0.255, h * 0.86, 0, w * 0.56, 0.052, d, color, 'cloth', 0, 0, -s * 0.44);
      part('box', s * w * 0.5, h * 0.36, 0, 0.045, h * 0.7, d, color, 'cloth');
      part('box', s * w * 0.3, h * 0.39, d / 2, w * 0.4, h * 0.74, 0.046, color, 'cloth');
      for (const e of [-1, 1]) {
        beam(
          [s * w * 0.47, h * 0.62, e * d * 0.47],
          [s * w * 0.68, 0.04, e * d * 0.54],
          0.023,
          0x726b57,
          'cloth',
        );
        part('rod', s * w * 0.5, h * 0.36, e * d * 0.475, 0.07, h * 0.72, 0.07, 0x89775c, 'bark');
      }
    }
    part('box', 0, h * 0.45, -d / 2, w * 0.96, h * 0.88, 0.065, color, 'cloth');
    part('rod', 0, h * 0.55, d * 0.47, 0.07, h * 1.1, 0.07, 0x82715d, 'bark');
    collision(
      x,
      z,
      Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * d,
      h,
      Math.abs(Math.cos(angle)) * d + Math.abs(Math.sin(angle)) * w,
    );
    moveFrame();
  }
  function lamp(x: number, z: number, side: number, aLit: boolean) {
    moveFrame(x, heightAt(x, z), z);
    const height = 4.55;
    part('tank', 0, height / 2, 0, 0.119, height, 0.119, 0x716e60, 'metal');
    beam([0, height - 0.35, 0], [-side * 0.72, height + 0.11, 0], 0.076, 0x7a796b);
    part('box', -side * 0.79, height + 0.085, 0, 0.46, 0.12, 0.27, 0x656a60, 'metal', 0, 0, side * 0.09);
    part('box', -side * 0.8, height - 0.02, 0, 0.37, 0.055, 0.2, 0xffd990, aLit ? 'light' : 'glass');
    if (cfg.night && aLit) {
      const l = new THREE.PointLight(0xffbf73, 15, 12, 1.8);
      l.position.set(x - side * 0.79, height - 0.11, z);
      group.add(l);
    }
    moveFrame();
  }
  function powerline(x1: number, z1: number, x2: number, z2: number) {
    const gray = 0x5e5a51;
    for (let n = 0; n < 2; n++) {
      const x = n ? x2 : x1,
        z = n ? z2 : z1,
        y = heightAt(x, z);
      part('tank', x, y + 2.95, z, 0.15, 5.9, 0.15, 0x847965, 'bark', 0, 0, n ? 0.016 : -0.018);
      part('box', x, y + 5.65, z, 0.13, 0.14, 1.2, gray, 'metal');
    }
    for (let line = 0; line < 2; line++) {
      const dz = line === 0 ? -0.39 : 0.39;
      const pt = (u: number): XYZ => [
        x1 + (x2 - x1) * u,
        5.82 + (1 - u) * heightAt(x1, z1) + u * heightAt(x2, z2) - Math.sin(u * Math.PI) * 0.71,
        z1 + (z2 - z1) * u + dz,
      ];
      for (let j = 0; j < 8; j++)
        beam(pt(j / 8), pt((j + 1) / 8), quality === 0 ? 0.065 : 0.043, 0x666457);
    }
  }
  function street() {
    const zs = [-28, -17.6, -7, 4.5, 16.2, 27.5];
    for (const side of [-1, 1]) {
      for (let j = 0; j < zs.length; j++) {
        const z = zs[j] + (side === 1 ? 2.3 : 0) + (rng() - 0.5) * 1.55;
        const depth = 5.0 + rng() * 2.5,
          w = 6.8 + rng() * 2.7,
          x = side * (cfg.street + depth / 2 + rng() * 1.1);
        if (cfg.camp && (j + Number(side > 0)) % 3 !== 0) {
          tent(x, z, side * 0.5, 3.8 + rng());
          olive(x + side * 3.8, z - 3, 1.75 + rng() * 0.35);
        } else if ((j + index + (side > 0 ? 2 : 0)) % 7 === 3) {
          olive(x, z, 2.4);
          building(x + side * 4.6, z, (-side * Math.PI) / 2, w, depth * 0.67, 1, j + index);
        } else {
          const floors =
            1 +
            ((j * 7 + index + (side === 1 ? 2 : 0)) % 3 === 0 ? 0 : index === 1 && j % 3 === 1 ? 2 : 1);
          building(x, z, (-side * Math.PI) / 2, w, depth, floors, j + index + (side > 0 ? 2 : 0));
        }
        if (j % 2 === 0 && !cfg.camp) {
          const xx = side * (cfg.street - 0.02);
          if (safe(xx, z + 2, 1.25)) crate(xx, z + 2, 0.74, j % 4 === 0);
        }
        if (!cfg.camp) {
          // Narrow paved stoops and individual kerbstones with occasional broken sections.
          part('box', side * (cfg.street + 0.48), 0.053, z, 1.47, 0.19, w + 0.9, 0xb8aa94, 'stone');
          for (let k = 0; k < Math.floor(w / 1.1); k++)
            part(
              'box',
              side * (cfg.street - 0.22),
              0.11,
              z - w / 2 + k * 1.13,
              0.19,
              0.21,
              1.09,
              0xc4b79f,
              'stone',
            );
        }
      }
      for (let j = 0; j < 5; j++) {
        const x = side * (24.5 + rng() * 2.5),
          z = -27 + 13.1 * j + (side === 1 ? 3 : 0);
        if (cfg.camp && j % 2) {
          olive(x, z, 2.1);
          continue;
        }
        building(
          x,
          z,
          (-side * Math.PI) / 2,
          7 + rng() * 2,
          5.5 + rng(),
          1 + Math.round(rng()),
          j + 3,
          false,
        );
      }
    }
    // Cross streets open into the neighbourhood at both ends.
    for (let j = -2; j <= 2; j++) {
      if (j !== 0 || !cfg.camp)
        building(
          j * 10 + 0.8,
          -39 - rng() * 2,
          0,
          6.9 + rng() * 1.7,
          4.8,
          1 + (j === 1 ? 1 : 0),
          j + 5,
          false,
        );
      if (j !== 0)
        building(
          j * 11,
          39 + rng() * 3,
          Math.PI,
          7.1 + rng(),
          4.9,
          1 + (j % 2 === 0 ? 1 : 0),
          j + 6,
          false,
        );
    }
    powerline(-cfg.street + 0.08, -20, cfg.street - 0.06, -15);
    powerline(-cfg.street + 0.1, 7, cfg.street - 0.3, 13);
    for (let j = 0; j < 4; j++) {
      const s = j % 2 ? -1 : 1;
      lamp(s * (cfg.street - 0.38), -24 + j * 14, s, j === 1 || j === 2);
    }
    for (let j = 0; j < (cfg.camp ? 1 : 3); j++) {
      const s = j % 2 ? -1 : 1,
        x = s * (cfg.street - 0.77),
        z = [-19.6, -7.1, 19.7][j];
      if (safe(x, z, 2.1)) vehicle(x, z, (rng() - 0.5) * 0.31 + (j % 2 ? Math.PI : 0), cfg.damage > 0.4);
    }
    for (let j = 0; j < 6; j++) {
      const s = j % 2 ? -1 : 1,
        x = s * (17.5 + rng() * 2),
        z = -29 + j * 9;
      if (
        !blockers.some((b) => x > b.min.x - 1 && x < b.max.x + 1 && z > b.min.z - 1 && z < b.max.z + 1)
      )
        olive(x, z, 1.7 + rng() * 0.5);
    }
  }
  function mountain() {
    for (let i = 0; i < 94; i++) {
      const s = i % 2 ? -1 : 1,
        z = (rng() - 0.5) * 75,
        x = s * (7.8 + rng() * 29);
      const w = 0.65 + rng() * 3.3,
        h = w * (0.43 + rng() * 0.46),
        d = w * (0.75 + rng() * 0.51),
        base = heightAt(x, z);
      part(
        'boulder',
        x,
        base + h * 0.34,
        z,
        w,
        h,
        d,
        [0xa4957f, 0xa79a86, 0x918775, 0xc1b197][i % 4],
        'stone',
        rng() * 0.56,
        rng() * 3.8,
        rng() * 0.28,
      );
      if (w > 1.5) collision(x, z, w * 0.75, h * 0.77, d * 0.74);
    }
    for (let j = 0; j < 13; j++) {
      const z = -31 + j * 5.4 + (rng() - 0.5) * 4,
        x = (j % 2 ? -1 : 1) * (6.7 + rng() * 7);
      olive(x, z, 1.77 + rng() * 0.7);
    }
    tent(8.6, 14, -0.38, 3.65);
    tent(12.4, 7, -1.2, 3.95);
    tent(-8.7, -7, 0.82, 3.65);
    // Walkable rock shelter with a cantilever canopy and a genuinely open entrance.
    const x = -11,
      z = -21,
      y = heightAt(x, z);
    for (let i = -1; i <= 1; i += 2) {
      part(
        'boulder',
        x + i * 3.2,
        y + 1.3,
        z,
        2.9,
        4.7,
        6.6,
        0x968974,
        'stone',
        0,
        rng() * 0.45,
        i * 0.12,
      );
      collision(x + i * 3.2, z, 2.25, 3.7, 5.6, y);
    }
    part('boulder', x, y + 3.5, z - 0.7, 8.9, 2.4, 7.3, 0xaa9c87, 'stone', 0, 0.09, -0.07);
    blockers.push(
      new THREE.Box3(
        new THREE.Vector3(x - 3.7, y + 3.2, z - 3),
        new THREE.Vector3(x + 3.7, y + 4.6, z + 2.7),
      ),
    );
    part('rock', x, y + 1.7, z - 3.2, 7.5, 4.5, 3.25, 0x837867, 'stone');
    collision(x, z - 3.5, 6.2, 3.7, 1.9, y);
    for (let j = 0; j < 4; j++) crate(j % 2 ? 6 : -5, 18 - j * 10, 0.69, j % 2 === 0);
  }
  if (cfg.mountain) mountain();
  else street();
  // Protected distant heritage silhouette, well outside the playable enclosure.
  function heritage() {
    const x = -48 + index * 0.65,
      z = -48,
      y = heightAt(x, z),
      stone = cfg.night ? 0xc8c4ae : 0xeee2c4;
    moveFrame(x, y, z, 0.19);
    part('box', 0, 1.7, 0, 8.2, 3.4, 6.8, stone, 'stone');
    part('box', 0, 3.4, 0, 8.4, 0.19, 7.0, 0xe0d5ba);
    part('tank', 0, 4.28, 0, 4.46, 1.65, 4.46, stone);
    part('cone', 0, 7.43, 0, 5.1, 5.0, 5.1, stone);
    for (let k = 0; k < 22; k++) {
      const a = (k * Math.PI * 2) / 22;
      beam(
        [Math.sin(a) * 2.5, 4.98, Math.cos(a) * 2.5],
        [Math.sin(a) * 0.17, 9.65, Math.cos(a) * 0.17],
        0.112,
        0xf2e7cb,
        'stone',
      );
    }
    part('rod', 0, 10.12, 0, 0.08, 0.7, 0.08, 0xb09b6b, 'metal');
    part('round', 0, 10.47, 0, 0.22, 0.28, 0.22, 0xc4ae7a, 'metal');
    moveFrame();
  }
  heritage();
  // Loose scree, fallen plaster and old pavers hug the edges of the walking surface.
  const rubbleCount = Math.round((cfg.mountain ? 90 : 72 + cfg.damage * 175) * (quality < 1 ? 0.7 : 1));
  for (let i = 0; i < rubbleCount; i++) {
    const z = (rng() - 0.5) * 65,
      side = rng() > 0.5 ? 1 : -1,
      x = side * (cfg.mountain ? 2.7 + rng() * 6.8 : cfg.street - 1.75 + rng() * 2.2);
    const size = 0.045 + rng() * (cfg.damage > 0.6 ? 0.44 : 0.32);
    part(
      i % 4 === 1 ? 'box' : 'rock',
      x,
      heightAt(x, z) + size * 0.2,
      z,
      size * (0.8 + rng()),
      size * (0.27 + rng() * 0.36),
      size * (0.54 + rng()),
      [0xc6b59c, 0xafa18e, 0xb09b85, 0x9b9282][i % 4],
      i % 4 === 1 ? 'plaster' : 'earth',
      rng() * 0.42,
      rng() * 3,
      rng() * 0.24,
    );
  }
  // Small working spaces connect the fictional families' stories to the scenery.
  function worktable(
    x: number,
    z: number,
    kind: 'bread' | 'copper' | 'school' | 'sewing' | 'book' | 'radio',
  ) {
    const y = heightAt(x, z);
    moveFrame(x, y, z, -0.12);
    part('box', 0, 0.83, 0, 1.65, 0.11, 0.77, 0xa48c70, 'bark');
    for (const a of [-1, 1])
      for (const b of [-1, 1]) part('box', a * 0.7, 0.42, b * 0.28, 0.08, 0.84, 0.08, 0x85715b, 'bark');
    if (kind === 'bread') {
      part('tank', 0, 0.96, 0, 0.84, 0.17, 0.6, 0xa9875c, 'bark');
      for (let j = 0; j < 6; j++)
        part(
          'round',
          ((j % 3) - 1) * 0.22,
          1.06 + Math.floor(j / 3) * 0.02,
          j < 3 ? -0.1 : 0.1,
          0.32,
          0.13,
          0.19,
          j % 2 ? 0xcc9b62 : 0xd7ad74,
          'earth',
          0,
          j * 0.2,
        );
      part('box', 0.39, 0.9, -0.06, 0.56, 0.035, 0.57, 0x9b6b58, 'cloth');
    } else if (kind === 'copper') {
      for (let j = 0; j < 3; j++) {
        const xx = -0.46 + j * 0.43;
        part('round', xx, 1.08, 0, 0.36, 0.39, 0.36, 0xb38260, 'metal');
        part('tank', xx, 1.27, 0, 0.23, 0.09, 0.23, 0xcf9c73, 'metal');
        part('tank', xx, 1.32, 0, 0.27, 0.025, 0.27, 0x9b6b53, 'metal');
      }
    } else if (kind === 'sewing') {
      part('box', -0.16, 0.91, 0, 0.68, 0.08, 0.39, 0x726c60, 'bark');
      part('tank', -0.35, 1.095, 0, 0.27, 0.37, 0.17, 0x485951, 'metal');
      part('box', -0.15, 1.25, 0, 0.58, 0.15, 0.19, 0x47584e, 'metal');
      part('rod', 0.1, 1.11, 0, 0.02, 0.15, 0.02, 0xb9b8a6, 'metal');
      for (let j = 0; j < 4; j++)
        part(
          'rod',
          0.37 + (j % 2) * 0.14,
          0.98,
          j < 2 ? -0.1 : 0.1,
          0.088,
          0.18,
          0.088,
          j % 2 ? 0x648b99 : 0x9f776c,
          'cloth',
        );
      part('box', 0.48, 0.96, 0.08, 0.38, 0.16, 0.26, 0x627f83, 'metal');
      part('box', 0.48, 1.06, 0.08, 0.4, 0.04, 0.27, 0xabb0a0, 'metal');
    } else if (kind === 'radio') {
      part('box', -0.12, 1.08, 0.02, 0.65, 0.36, 0.23, 0x706957, 'metal');
      part('box', -0.22, 1.08, 0.15, 0.31, 0.24, 0.015, 0x424c47, 'metal');
      for (let j = 0; j < 4; j++)
        part('box', -0.22, 1.015 + 0.04 * j, 0.161, 0.29, 0.014, 0.012, 0x929081, 'metal');
      part('box', 0.108, 1.08, 0.15, 0.22, 0.05, 0.02, 0xada688, 'glass');
      beam([0.12, 1.25, 0], [0.32, 1.9, -0.02], 0.016, 0xc1b8a7);
    } else {
      for (let j = 0; j < 4; j++) {
        const xx = -0.49 + j * 0.25;
        part(
          'box',
          xx,
          0.918 + j * 0.004,
          (j % 2) * 0.09,
          0.32,
          0.05,
          0.29,
          0x935f4e,
          'bark',
          0,
          j * 0.14,
        );
        part(
          'box',
          xx,
          0.951 + j * 0.004,
          (j % 2) * 0.09,
          0.3,
          0.024,
          0.27,
          0xddccb0,
          'cloth',
          0,
          j * 0.14,
        );
      }
      part('rod', 0.55, 0.965, 0.06, 0.022, 0.32, 0.022, 0xa38155, 'bark', 1.5, 0.5);
    }
    collision(x, z, 1.68, 0.9, 0.8);
    moveFrame();
  }
  function bench(x: number, z: number) {
    moveFrame(x, heightAt(x, z), z);
    for (let j = 0; j < 3; j++)
      part('box', 0, 0.49, -0.16 + j * 0.16, 1.53, 0.08, 0.14, 0xac9274, 'bark');
    for (const side of [-1, 1]) {
      part('box', side * 0.57, 0.23, 0.02, 0.11, 0.46, 0.34, 0x6c685c, 'metal');
      part('box', side * 0.57, 0.71, -0.18, 0.065, 0.52, 0.065, 0x6c685c, 'metal');
    }
    part('box', 0, 0.89, -0.19, 1.53, 0.26, 0.057, 0x9f886d, 'bark');
    collision(x, z, 1.52, 0.96, 0.5);
    moveFrame();
  }
  function shade(x: number, z: number, cloth: number) {
    const y = heightAt(x, z);
    moveFrame(x, y, z);
    for (const side of [-1, 1])
      for (const end of [-1, 1]) {
        part('rod', side * 1.12, 1.14, end * 0.81, 0.065, 2.28, 0.065, 0x876f51, 'bark');
        collision(x + side * 1.12, z + end * 0.81, 0.1, 2.4, 0.1, y);
      }
    for (const s of [-1, 1])
      part('box', s * 0.59, 2.39, 0, 1.28, 0.046, 1.78, cloth, 'cloth', 0, 0, -s * 0.13);
    moveFrame();
  }
  const g0 = objectives[0],
    g1 = objectives[1],
    g2 = objectives[2];
  if (index === 0) {
    bench(g0[0] - 2.1, g0[1]);
    worktable(g1[0] - 1.6, g1[1], 'bread');
    shade(g2[0] + 2.3, g2[1], 0x966751);
    worktable(g2[0] + 2.3, g2[1], 'copper');
  } else if (index === 1) {
    shade(g0[0] + 2.1, g0[1], 0xa58e6a);
    worktable(g0[0] + 2.1, g0[1], 'copper');
    bench(g2[0] - 1.9, g2[1]);
  } else if (index === 2 || index === 6) {
    worktable(g2[0] + 1.9, g2[1], 'school');
    moveFrame(g2[0] + 2.28, heightAt(g2[0] + 2.28, g2[1]), g2[1] - 1, -0.18);
    part('box', 0, 1.53, 0, 1.47, 0.94, 0.1, 0x616c60, 'bark');
    for (const side of [-1, 1]) part('box', side * 0.68, 0.95, 0, 0.063, 1.95, 0.15, 0x9e876a, 'bark');
    part('box', 0, 1.03, 0.035, 1.53, 0.05, 0.2, 0xb09573, 'bark');
    sign(0, 1.57, 0.065, 1.25, 0.63, 'مدرستنا', 'Dibistana me', true);
    moveFrame();
    bench(g1[0] - 2.05, g1[1]);
  } else if (index === 3) {
    shade(g2[0] + 2.3, g2[1], 0xb5a68b);
    moveFrame(g0[0] + 1.8, heightAt(g0[0] + 1.8, g0[1]), g0[1]);
    for (let j = 0; j < 4; j++) {
      const ax = (j % 2) * 0.47,
        zz = j < 2 ? 0 : 0.42;
      part('round', ax, 0.32, zz, 0.43, 0.59, 0.43, 0xae8f71, 'earth');
      part('tank', ax, 0.62, zz, 0.19, 0.16, 0.19, 0x997a61, 'earth');
      part('rod', ax, 0.7, zz, 0.226, 0.039, 0.226, 0xc0a185, 'earth');
    }
    moveFrame();
  } else if (index === 4) {
    worktable(g2[0] + 1.8, g2[1], 'radio');
    bench(g2[0] + 1.8, g2[1] + 1.1);
  } else if (index === 5) {
    worktable(g0[0] + 1.85, g0[1], 'sewing');
    shade(g0[0] + 1.85, g0[1], 0xa3a38c);
    bench(g2[0] - 2.1, g2[1]);
  } else {
    worktable(g1[0] - 1.75, g1[1], 'book');
    bench(g1[0] - 1.75, g1[1] + 1.3);
    shade(g2[0] + 2.15, g2[1], 0xbd9b74);
    worktable(g2[0] + 2.15, g2[1], 'bread');
  }
  function shutter(x: number, z: number) {
    moveFrame(x, heightAt(x, z), z, 0);
    for (const sx of [-1, 1]) {
      part('box', sx * 0.79, 1.14, -0.02, 0.18, 2.28, 0.28, 0x958570, 'stone');
      part('box', sx * 0.73, 1.17, 0.045, 0.07, 2.17, 0.08, 0x665c4f, 'metal');
    }
    part('box', 0, 2.24, -0.04, 1.79, 0.25, 0.32, 0xa7967d, 'stone');
    part('box', 0, 1.1, -0.11, 1.34, 2.1, 0.09, 0x635e50, 'bark');
    localBlock(0, 1.18, 0, 1.8, 2.4, 0.33);
    const facade = buffers;
    buffers = new Map();
    moveFrame();
    // The shutter rolls up around its top edge when the family opens the shop.
    for (let j = 0; j < 12; j++)
      part(
        'box',
        0,
        -1.72 + j * 0.14,
        -0.002,
        1.34,
        0.13,
        0.1,
        j % 3 ? 0x84918a : 0x8b958c,
        'metal',
        0.07,
      );
    part('box', 0, -1.74, 0.094, 0.34, 0.05, 0.06, 0x9c997f, 'metal');
    rollingShutter = new THREE.Group();
    rollingShutter.position.set(x, heightAt(x, z) + 2.12, z);
    group.add(rollingShutter);
    bake(buffers, rollingShutter);
    buffers = facade;
  }
  function windowStation(x: number, z: number) {
    moveFrame(x, heightAt(x, z), z, -0.16);
    const blue = 0x587a80,
      wall = 0xcab79c;
    part('box', 0, 0.41, 0, 2.35, 0.82, 0.39, wall, 'stone');
    part('box', 0, 2.21, 0, 2.35, 0.28, 0.39, wall, 'stone');
    for (const side of [-1, 1]) {
      part('box', side * 0.93, 1.44, 0, 0.48, 1.28, 0.39, wall);
      part('box', side * 0.63, 1.44, 0.04, 0.09, 1.27, 0.1, blue, 'bark');
      part('box', side * 0.45, 1.44, 0.18, 0.32, 1.23, 0.06, blue, 'bark', 0, side * 0.42);
      for (let j = 0; j < 5; j++)
        part(
          'box',
          side * 0.45,
          0.96 + j * 0.205,
          0.22,
          0.3,
          0.034,
          0.06,
          0x718b86,
          'bark',
          0,
          side * 0.42,
        );
    }
    part('box', 0, 0.84, 0.09, 1.56, 0.1, 0.5, 0xd1c4a9, 'stone');
    localBlock(0, 1.17, 0, 2.35, 2.35, 0.43);
    moveFrame();
  }
  function rollingChair(x: number, z: number) {
    moveFrame(x, heightAt(x, z), z, 0.3);
    for (const side of [-1, 1]) {
      part('ring', side * 0.37, 0.38, 0, 0.78, 0.78, 0.92, 0x4e504b, 'metal', 0, Math.PI / 2);
      part('ring', side * 0.397, 0.38, 0, 0.65, 0.65, 0.57, 0x969588, 'metal', 0, Math.PI / 2);
      for (let j = 0; j < 10; j++) {
        const a = (j * Math.PI) / 5;
        beam(
          [side * 0.37, 0.38, 0],
          [side * 0.37, 0.38 + 0.33 * Math.sin(a), 0.33 * Math.cos(a)],
          0.014,
          0xb4b1a3,
        );
      }
      beam([side * 0.26, 0.25, 0.35], [side * 0.26, 0.96, -0.27], 0.043, 0x969a8c);
      part('rod', side * 0.26, 0.12, 0.36, 0.2, 0.069, 0.2, 0x62635b, 'metal', 0, 0, Math.PI / 2);
      part('box', side * 0.285, 0.65, 0.012, 0.06, 0.056, 0.37, 0x70746a, 'metal');
    }
    part('box', 0, 0.47, -0.015, 0.51, 0.076, 0.47, 0x687970, 'cloth');
    part('box', 0, 0.73, -0.255, 0.51, 0.47, 0.045, 0x69786e, 'cloth', -0.08);
    part('box', 0, 0.16, 0.455, 0.4, 0.043, 0.2, 0x707870, 'metal');
    localBlock(0, 0.44, 0, 0.82, 0.94, 0.96);
    moveFrame();
  }
  if (index === 0) {
    landmarks[1] = [g1[0] - 1.6, g1[1]];
    landmarks[2] = [g2[0] + 2.3, g2[1] - 0.8];
    shutter(...landmarks[2]);
  } else if (index === 2) {
    landmarks[2] = [g2[0] + 1.9, g2[1]];
  } else if (index === 3) {
    landmarks[0] = [g0[0] + 1.8, g0[1]];
    landmarks[2] = [g2[0] + 2.3, g2[1]];
  } else if (index === 4) {
    landmarks[0] = [g0[0] - 1.57, g0[1]];
    landmarks[1] = [g1[0] - 1.64, g1[1]];
    const [bx, bz] = landmarks[0];
    moveFrame(bx, heightAt(bx, bz), bz);
    part('box', 0, 0.23, 0, 0.8, 0.46, 0.61, 0xa49275, 'bark');
    part('box', 0, 0.64, 0, 0.43, 0.32, 0.29, 0x5a655c, 'metal');
    part('box', 0, 0.82, 0, 0.45, 0.055, 0.31, 0x98927b, 'metal');
    for (const a of [-1, 1]) part('rod', a * 0.14, 0.88, 0, 0.064, 0.09, 0.064, 0xb29575, 'metal');
    beam([-0.09, 0.83, 0.045], [-0.09, 0.95, 0.045], 0.035, 0x747569);
    beam([-0.09, 0.95, 0.045], [0.09, 0.95, 0.045], 0.035, 0x747569);
    beam([0.09, 0.95, 0.045], [0.09, 0.83, 0.045], 0.035, 0x747569);
    localBlock(0, 0.33, 0, 0.81, 0.67, 0.62);
    moveFrame();
    const [lx, lz] = landmarks[1];
    lamp(lx, lz, 1, false);
    collision(lx, lz, 0.18, 4.6, 0.18);
    courtyardLamp = new THREE.Group();
    const lens = new THREE.Mesh(
      new THREE.BoxGeometry(0.37, 0.065, 0.21),
      new THREE.MeshBasicMaterial({ color: 0xffe0a0 }),
    );
    lens.position.set(lx - 0.8, heightAt(lx, lz) + 4.525, lz);
    register(lens, false, false);
    courtyardLamp.add(lens);
    const glow = new THREE.PointLight(0xffbe70, 32, 16, 1.8);
    glow.position.copy(lens.position);
    glow.position.y -= 0.15;
    courtyardLamp.add(glow);
    courtyardLamp.visible = false;
    group.add(courtyardLamp);
  } else if (index === 5) {
    landmarks[0] = [g0[0] + 1.85, g0[1]];
    landmarks[1] = [g1[0] + 1.4, g1[1]];
    rollingChair(...landmarks[1]);
  } else if (index === 6) {
    landmarks[0] = [g0[0] - 1.47, g0[1]];
    landmarks[2] = [g2[0] + 1.84, g2[1] + 1.1];
    const [xx, zz] = landmarks[0];
    moveFrame(xx, heightAt(xx, zz), zz);
    part('box', 0, 0.44, 0, 0.61, 0.87, 0.5, 0x958168, 'bark');
    part('box', 0, 0.91, 0, 0.66, 0.07, 0.53, 0xa89778, 'bark');
    part('box', 0, 0.98, 0, 0.25, 0.06, 0.2, 0xb08a59, 'metal');
    part('tank', 0, 1.06, 0, 0.1, 0.12, 0.1, 0xb38d60, 'metal');
    part('round', 0, 1.14, 0, 0.145, 0.13, 0.145, 0x9b784f, 'metal');
    localBlock(0, 0.46, 0, 0.68, 0.92, 0.55);
    moveFrame();
    windowStation(...landmarks[2]);
  } else if (index === 7) {
    landmarks[1] = [g1[0] - 1.75, g1[1]];
    landmarks[2] = [g2[0] + 2.15, g2[1] - 0.8];
    shutter(...landmarks[2]);
  }
  const nicheX = optional[0] + Math.sign(optional[0]) * 1.18,
    nicheZ = optional[1];
  moveFrame(nicheX, heightAt(nicheX, nicheZ), nicheZ);
  // The low shelf stays in the scene after its personal keepsake is collected.
  part('box', 0, 0.76, 0, 0.84, 0.085, 0.51, 0xa48f71, 'bark');
  for (const s of [-1, 1]) part('box', s * 0.31, 0.35, 0, 0.12, 0.71, 0.4, 0x8b7a62, 'bark');
  localBlock(0, 0.38, 0, 0.85, 0.82, 0.52);
  moveFrame();
  if (index === 0 || index === 7) {
    // A permanent ceramic mural in the family courtyard. The artwork has no damage state.
    const x = -cfg.street + 0.15,
      z = 8.9,
      y = heightAt(x, z);
    moveFrame(x, y, z, Math.PI * 0.36);
    part('box', 0, 0.14, 0, 3.43, 0.28, 0.84, 0xb3a38b, 'stone');
    part('box', 0, 1.26, 0, 3.08, 2.37, 0.29, 0xc7b392, 'stone');
    part('box', 0, 2.47, 0, 3.29, 0.15, 0.45, 0xd0bd9e, 'stone');
    const tex = canvasTexture(512, (c) => {
      c.fillStyle = '#425b58';
      c.fillRect(0, 0, 512, 512);
      c.strokeStyle = '#a78b5a';
      c.lineWidth = 7;
      c.strokeRect(12, 12, 488, 488);
      c.lineWidth = 2;
      c.strokeRect(23, 23, 466, 466);
      // A fan of feather eyes frames a hand-painted peacock in profile.
      for (let ring = 0; ring < 2; ring++)
        for (let j = 0; j < (ring ? 13 : 9); j++) {
          const steps = ring ? 12 : 8,
            angle = -Math.PI * 0.96 + (Math.PI * 0.92 * j) / steps,
            radius = ring ? 164 : 118;
          const fx = 252 + Math.cos(angle) * radius,
            fy = 314 + Math.sin(angle) * radius;
          c.save();
          c.translate(fx, fy);
          c.rotate(angle + Math.PI / 2);
          c.beginPath();
          c.ellipse(0, 0, ring ? 17 : 21, ring ? 45 : 59, 0, 0, Math.PI * 2);
          c.fillStyle = ring ? '#818d6d' : '#738975';
          c.fill();
          c.strokeStyle = '#b69d69';
          c.lineWidth = 2;
          c.stroke();
          c.fillStyle = '#ad9a62';
          c.beginPath();
          c.ellipse(0, -15, 11, 15, 0, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#43646b';
          c.beginPath();
          c.ellipse(0, -17, 6, 8, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
      c.fillStyle = '#405c69';
      c.strokeStyle = '#c6ac75';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(172, 319);
      c.bezierCurveTo(228, 283, 286, 337, 308, 274);
      c.bezierCurveTo(319, 246, 301, 220, 324, 209);
      c.bezierCurveTo(343, 198, 354, 217, 343, 230);
      c.bezierCurveTo(319, 240, 342, 270, 323, 311);
      c.bezierCurveTo(295, 356, 223, 356, 172, 319);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#c5ab71';
      c.beginPath();
      c.moveTo(346, 216);
      c.lineTo(368, 222);
      c.lineTo(345, 226);
      c.fill();
      c.beginPath();
      c.arc(338, 215, 2.6, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = 3;
      for (let j = -1; j <= 1; j++) {
        c.beginPath();
        c.moveTo(327, 208);
        c.lineTo(320 + j * 6, 191 - Math.abs(j) * 2);
        c.stroke();
        c.beginPath();
        c.arc(320 + j * 6, 190 - Math.abs(j) * 2, 3, 0, Math.PI * 2);
        c.fill();
      }
      c.textAlign = 'center';
      c.direction = 'rtl';
      c.fillStyle = '#decc9f';
      c.font = 'bold 39px serif';
      c.fillText('السلام لأرض شنكال', 256, 407, 420);
      c.direction = 'ltr';
      c.font = '21px serif';
      c.fillText('Aştî ji bo Şingalê', 256, 449);
      c.strokeStyle = 'rgba(49,51,43,.29)';
      c.lineWidth = 1.5;
      for (let j = 0; j <= 512; j += 32) {
        c.beginPath();
        c.moveTo(j, 0);
        c.lineTo(j, 512);
        c.moveTo(0, j);
        c.lineTo(512, j);
        c.stroke();
      }
      for (let j = 0; j < 1600; j++) {
        c.fillStyle = j % 2 ? 'rgba(236,218,178,.16)' : 'rgba(62,49,34,.10)';
        c.fillRect(rng() * 512, rng() * 512, rng() * 2.5 + 1, rng() * 2 + 1);
      }
    });
    textures.add(tex);
    const mural = new THREE.Mesh(
      new THREE.PlaneGeometry(2.74, 1.96),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.74 }),
    );
    mural.position.set(0, 1.31, 0.157).applyMatrix4(fMat);
    mural.rotation.y = frame.angle;
    register(mural);
    localBlock(0, 1.25, 0, 3.3, 2.54, 0.85);
    moveFrame();
  }
  foliage();
  const keepsake = new THREE.Group();
  keepsake.name = 'ذكرى عائلية';
  const worldBuffers = buffers;
  buffers = new Map<string, BufferGroup>();
  keepsake.position.set(
    nicheX - optional[0],
    heightAt(nicheX, nicheZ) - heightAt(...optional) + 0.805,
    nicheZ - optional[1],
  );
  if (index === 0) {
    part('ring', -0.09, 0.048, 0, 0.19, 0.2, 0.36, 0xc2a679, 'metal', Math.PI / 2);
    beam([-0.02, 0.035, 0], [0.21, 0.035, 0.044], 0.036, 0xbba077);
    for (const xx of [0.14, 0.2]) beam([xx, 0.038, 0.036], [xx, 0.037, 0.093], 0.038, 0xbba077);
    beam([-0.16, 0.045, -0.025], [-0.25, 0.045, -0.11], 0.025, 0xae594b, 'cloth');
    beam([-0.25, 0.045, -0.11], [-0.34, 0.042, -0.086], 0.024, 0xb9604f, 'cloth');
  } else if (index === 1 || index === 3 || index === 4) {
    const base = index === 3 ? 0x9c5e52 : index === 1 ? 0x6b8880 : 0x9e8975;
    for (let j = 0; j < 3; j++)
      part(
        'box',
        (j - 1) * 0.016,
        0.036 + j * 0.056,
        0,
        0.62 - j * 0.022,
        0.072,
        0.35 - j * 0.018,
        base,
        'cloth',
      );
    for (let j = 0; j < 5; j++)
      part('box', -0.21 + j * 0.1, 0.186, 0, 0.026, 0.009, 0.32, 0xc9b796, 'cloth');
    for (let j = 0; j < 10; j++)
      part('box', -0.26 + j * 0.055, 0.125, 0.18, 0.022, 0.03, 0.084, 0xbbac90, 'cloth', 0.13);
  } else if (index === 2 || index === 6) {
    part(
      'box',
      0,
      0.024,
      0,
      0.56,
      0.045,
      0.39,
      index === 6 ? 0x68878b : 0xdcc9a3,
      index === 6 ? 'bark' : 'cloth',
    );
    if (index === 2) {
      beam([-0.15, 0.048, 0.07], [-0.15, 0.048, -0.04], 0.014, 0x7b8b8c);
      beam([-0.15, 0.048, -0.04], [-0.053, 0.048, -0.12], 0.015, 0xb37467);
      beam([-0.053, 0.048, -0.12], [0.044, 0.048, -0.04], 0.015, 0xb37467);
      beam([0.044, 0.048, -0.04], [0.044, 0.048, 0.07], 0.014, 0x82938d);
      part('rod', 0.16, 0.049, -0.081, 0.072, 0.008, 0.072, 0xd0ad62, 'cloth');
    } else {
      const boardTex = canvasTexture(128, (c) => {
        c.fillStyle = '#718784';
        c.fillRect(0, 0, 128, 128);
        c.fillStyle = '#e7d5aa';
        c.font = 'bold 38px serif';
        c.textAlign = 'center';
        c.fillText('صفّنا', 64, 78, 110);
      });
      textures.add(boardTex);
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.35),
        new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.94 }),
      );
      board.rotation.x = -Math.PI / 2;
      board.position.y = 0.05;
      register(board);
      keepsake.add(board);
    }
  } else if (index === 5) {
    for (const s of [-1, 1]) {
      part('ring', s * 0.085, 0.034, -0.1, 0.139, 0.152, 0.35, 0xb48b61, 'metal', Math.PI / 2);
      beam([s * 0.069, 0.034, -0.053], [-s * 0.105, 0.035, 0.17], 0.033, 0xb7b4a2);
    }
    part('rod', 0, 0.053, 0.022, 0.041, 0.025, 0.041, 0xa17c54, 'metal');
  } else {
    beam([-0.27, 0.04, 0.12], [0.27, 0.054, -0.11], 0.021, 0x888267, 'bark');
    for (let j = 0; j < 7; j++) {
      const u = j / 7;
      for (const side of [-1, 1])
        part(
          'round',
          -0.23 + u * 0.46,
          0.05 + u * 0.015,
          0.12 - u * 0.19 + side * 0.05,
          0.12,
          0.024,
          0.058,
          side < 0 ? 0x879676 : 0x687e66,
          'foliage',
          0,
          side * 0.52,
        );
    }
  }
  function bake(draw: Map<string, BufferGroup>, to: THREE.Group) {
    for (const [key, b] of draw) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normal, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.color, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setIndex(b.indices);
      g.computeBoundingSphere();
      const m = register(new THREE.Mesh(g, b.mat), !key.startsWith('earth') && !key.startsWith('glass'));
      m.name = key;
      if (to !== group) to.add(m);
    }
    draw.clear();
  }
  bake(worldBuffers, group);
  bake(buffers, keepsake);
  Object.values(sources).forEach((g) => g.dispose());
  const flags: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>[] = [];
  if (index === 0 || index === 7) {
    // Original sun banner for the family's peaceful gathering.
    const tex = canvasTexture(256, (c) => {
      c.fillStyle = '#e4ddbe';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#b3833d';
      c.beginPath();
      for (let j = 0; j < 42; j++) {
        const a = (j * Math.PI) / 21,
          r = j % 2 ? 35 : 63;
        c.lineTo(128 + Math.cos(a) * r * 0.78, 128 + Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.beginPath();
      c.ellipse(128, 128, 20, 27, 0, 0, Math.PI * 2);
      c.fillStyle = '#e5b457';
      c.fill();
      c.fillStyle = '#8d5543';
      c.fillRect(0, 9, 256, 7);
      c.fillRect(0, 240, 256, 7);
    });
    textures.add(tex);
    const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.98 });
    const g = new THREE.PlaneGeometry(1.36, 0.74, 10, 4);
    g.translate(0.68, 0, 0);
    const flag = new THREE.Mesh(g, m);
    flag.position.set(-cfg.street + 0.08, heightAt(-cfg.street, -20) + 5.33, -20);
    flag.rotation.y = -0.17;
    register(flag, true);
    flags.push(flag);
  }
  // Baked contact shading remains visible on devices that switch shadow maps off.
  const contactMap = canvasTexture(64, (c) => {
    const gradient = c.createRadialGradient(32, 32, 1, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,.96)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,.73)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gradient;
    c.fillRect(0, 0, 64, 64);
  });
  textures.add(contactMap);
  const groundContacts = blockers.filter(
    (b) =>
      b.getSize(point).x > 0.35 &&
      b.getSize(point).z > 0.35 &&
      b.min.y < heightAt((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2) + 0.2,
  );
  const contactGeometry = new THREE.PlaneGeometry(1, 1);
  contactGeometry.rotateX(-Math.PI / 2);
  const contactMaterial = new THREE.MeshBasicMaterial({
    map: contactMap,
    color: 0x393128,
    opacity: cfg.night ? 0.21 : 0.29,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const contacts = new THREE.InstancedMesh(contactGeometry, contactMaterial, groundContacts.length);
  groundContacts.forEach((b, j) => {
    b.getCenter(position);
    const x = position.x,
      z = position.z;
    position.y = heightAt(x, z) + 0.045;
    const dx = heightAt(x + 0.5, z) - heightAt(x - 0.5, z),
      dz = heightAt(x, z + 0.5) - heightAt(x, z - 0.5);
    rotation.setFromUnitVectors(up, norm.set(-dx, 1, -dz).normalize());
    b.getSize(scale);
    scale.set(scale.x * 1.43 + 0.4, 1, scale.z * 1.43 + 0.4);
    contacts.setMatrixAt(j, transform.compose(position, rotation, scale));
  });
  contacts.computeBoundingSphere();
  register(contacts, false, false);
  // Bake broad cast shadows onto a terrain-conforming overlay for the mobile preset.
  if (quality === 0) {
    const size = 768,
      span = 120,
      px = (v: number) => (v / span + 0.5) * size;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const c = canvas.getContext('2d')!;
    c.fillStyle = cfg.night ? 'rgba(9,16,30,.27)' : 'rgba(43,40,40,.38)';
    const shade = (points: number[][]) => {
      const cross = (a: number[], b: number[], d: number[]) =>
        (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
      points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const chain = (pts: number[][]) => {
        const line: number[][] = [];
        for (const p of pts) {
          while (line.length > 1 && cross(line[line.length - 2], line[line.length - 1], p) <= 0)
            line.pop();
          line.push(p);
        }
        line.pop();
        return line;
      };
      const hull = chain(points).concat(chain(points.reverse()));
      c.beginPath();
      hull.forEach(([x, z], i) => (i ? c.lineTo(px(x), px(z)) : c.moveTo(px(x), px(z))));
      c.closePath();
      c.fill();
    };
    for (const box of groundContacts) {
      const h = box.max.y - heightAt(box.min.x, box.min.z);
      if (h < 0.5) continue;
      const corners = [
        [box.min.x, box.min.z],
        [box.max.x, box.min.z],
        [box.min.x, box.max.z],
        [box.max.x, box.max.z],
      ];
      shade([...corners, ...corners.map(([x, z]) => [x + h * 0.71, z + h * 0.85])]);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    textures.add(tex);
    const shadowGeo = new THREE.PlaneGeometry(
      span,
      span,
      cfg.mountain ? 80 : 24,
      cfg.mountain ? 80 : 24,
    );
    shadowGeo.rotateX(-Math.PI / 2);
    const pos = shadowGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)) + 0.055);
    const shadow = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    shadow.renderOrder = 1;
    register(shadow, false, false);
  }
  const particleTexture = canvasTexture(64, (c) => {
    const gradient = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,.90)');
    gradient.addColorStop(0.22, 'rgba(255,255,255,.63)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,.13)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gradient;
    c.fillRect(0, 0, 64, 64);
  });
  textures.add(particleTexture);
  const count = quality < 1 ? 36 : quality > 1 ? 105 : 68,
    dustPositions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    dustPositions[i * 3] = (rng() - 0.5) * 55;
    dustPositions[i * 3 + 1] = 0.25 + rng() * 8;
    dustPositions[i * 3 + 2] = (rng() - 0.5) * 59;
  }
  const dustGeometry = new THREE.BufferGeometry(),
    dustAttribute = new THREE.BufferAttribute(dustPositions, 3).setUsage(THREE.DynamicDrawUsage);
  dustGeometry.setAttribute('position', dustAttribute);
  dustGeometry.computeBoundingSphere();
  const dustMat = new THREE.PointsMaterial({
    map: particleTexture,
    color: cfg.night ? 0xe2ca99 : 0xe4cb9e,
    size: cfg.night ? 0.073 : 0.085,
    opacity: cfg.night ? 0.58 : 0.37,
    transparent: true,
    depthWrite: false,
  });
  group.add(new THREE.Points(dustGeometry, dustMat));
  materials.add(dustMat);
  geometrySet.add(dustGeometry);
  const haze: THREE.Sprite[] = [];
  if (cfg.damage > 0.42) {
    const smokeMat = new THREE.SpriteMaterial({
      map: particleTexture,
      color: cfg.night ? 0x7a7980 : 0x8c8278,
      opacity: 0.12,
      depthWrite: false,
      transparent: true,
    });
    materials.add(smokeMat);
    for (let j = 0; j < (quality === 0 ? 5 : 10); j++) {
      const puff = new THREE.Sprite(smokeMat);
      puff.position.set(19 + j * 0.5, 5.6 + j * 0.62, -29.5);
      puff.scale.setScalar(3.4 + j * 0.39);
      group.add(puff);
      haze.push(puff);
    }
  }
  let lastParticle = 0;
  const setStage = (stage: number) => {
    completedGoals = stage;
    if (courtyardLamp) courtyardLamp.visible = stage >= 2;
  };
  const update = (t: number, dt: number) => {
    if (rollingShutter)
      rollingShutter.scale.y = THREE.MathUtils.damp(
        rollingShutter.scale.y,
        completedGoals >= 3 ? 0.04 : 1,
        4,
        dt,
      );
    for (const flag of flags) {
      const p = flag.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) / 1.36;
        p.setZ(
          i,
          u * (0.105 * Math.sin(u * 8 - t * 3.6) + 0.053 * Math.sin(u * 14 + p.getY(i) * 3 - t * 3)),
        );
      }
      p.needsUpdate = true;
    }
    lastParticle += dt;
    if (lastParticle > 0.065) {
      const elapsed = Math.min(lastParticle, 0.2);
      lastParticle = 0;
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        dustPositions[ix] += elapsed * (0.35 + cfg.weather * 0.45);
        dustPositions[ix + 1] += Math.sin(t * 0.5 + i) * elapsed * 0.05;
        if (dustPositions[ix] > 29) dustPositions[ix] = -29;
      }
      dustAttribute.needsUpdate = true;
      haze.forEach((p, j) => {
        const u = (j * 0.104 + t * 0.037) % 1;
        p.position.set(19 + u * 5 + Math.sin(u * 6) * 0.42, 5.6 + u * 7.6, -29.5 + u * 0.75);
        p.scale.setScalar(3.5 + u * 4.3);
      });
    }
  };
  const dispose = () => {
    for (const item of group.children) if (item instanceof THREE.InstancedMesh) item.dispose();
    geometrySet.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    group.clear();
  };
  return {
    group,
    blockers,
    heightAt,
    spawn,
    objectives,
    landmarks,
    optional,
    keepsake,
    encounters,
    bounds,
    sky: cfg.sky,
    fog: cfg.fog,
    sunlight: cfg.sunlight,
    night: !!cfg.night,
    setStage,
    update,
    dispose,
  };
}
