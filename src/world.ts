import * as THREE from 'three'

type XZ = [number, number]
type XYZ = [number, number, number]
type Finish = 'stone' | 'plaster' | 'metal' | 'glass' | 'cloth' | 'bark' | 'foliage' | 'earth' | 'road' | 'light'
type Setting = {
  name: string
  sky: number
  fog: number
  sunlight: number
  plaster: number[]
  mountain?: boolean
  camp?: boolean
  night?: boolean
  damage: number
  street: number
  weather: number
}

const settings: Setting[] = [
  {name:'ساحة العائلة', sky:0xabc3c9, fog:0xd4bc99, sunlight:0xffdc9d, plaster:[0xd9bc8f,0xc6a37b,0xe2d3aa,0xd3c1a8], damage:.08, street:7.9, weather:.12},
  {name:'سوق النحّاسين', sky:0x94afb7, fog:0xb5a38c, sunlight:0xf9cc96, plaster:[0xb6a490,0xb09578,0xc5afa0,0xc7b598], damage:.65, street:7, weather:.58},
  {name:'زقاق التوت', sky:0x94a8b3, fog:0xa9a7a1, sunlight:0xffe3be, plaster:[0xc2b3a1,0xbbab97,0xcbb99e,0xa89b91], damage:.82, street:6.6, weather:.48},
  {name:'وادي الزيتون', sky:0x96becb, fog:0xc7b49b, sunlight:0xffda99, plaster:[0xb1a385,0xc8b38f], mountain:true, damage:.06, street:9, weather:.22},
  {name:'حارة القناديل', sky:0x202e48, fog:0x414859, sunlight:0xadc5fa, plaster:[0xb8a68c,0xaca9a1,0xc4b597], night:true, damage:.45, street:6.8, weather:.22},
  {name:'بيوت النبع', sky:0xa4b6bb, fog:0xc2b6a7, sunlight:0xffd5b2, plaster:[0xc2ac88,0xbbaa8d,0xe1c8a6], camp:true, damage:.34, street:8, weather:.34},
  {name:'دروب المدرسة', sky:0xaab4b5, fog:0xc2aca0, sunlight:0xffbd88, plaster:[0xbba18a,0xb9a58d,0xc3ada2], damage:.73, street:9.3, weather:.57},
  {name:'ساحة البنّائين', sky:0x9bb2c3, fog:0xf1c397, sunlight:0xffb265, plaster:[0xdcc097,0xc5a990,0xd5c2aa,0xdbc9ac], damage:.27, street:8.4, weather:.18}
]

function random(seed:number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function canvasTexture(size:number, paint:(ctx:CanvasRenderingContext2D)=>void) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  paint(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 2
  return texture
}

// All surfaces originate from deterministic layered noise and hand-drawn motifs.
function textureFor(kind:Finish, size:number) {
  const rng = random(812 + kind.charCodeAt(0))
  return canvasTexture(size, ctx => {
    const pixels = ctx.createImageData(size,size)
    const fine = kind === 'road' || kind === 'earth'
    const levels = [4,12,32,64].map(n => ({n, data:Float32Array.from({length:n*n},rng)}))
    for(let y=0; y<size; y++) for(let x=0; x<size; x++) {
      let v = 0
      for(let l=0; l<levels.length; l++) {
        const {n,data} = levels[l]
        const fx=x*n/size, fy=y*n/size, ix=Math.floor(fx), iy=Math.floor(fy)
        const a=fx-ix, b=fy-iy, u=a*a*(3-2*a), w=b*b*(3-2*b)
        const row=(p:number) => data[(p%n)*n+ix]*(1-u)+data[(p%n)*n+(ix+1)%n]*u
        v += ((1-w)*row(iy)+w*row(iy+1)-.5)*[33,24,19,14][l]
      }
      v += (rng()-.5)*(fine?38:14)
      if(kind==='cloth') v+=(x%3===0?-8:2)+(y%4===0?-5:1)
      if(kind==='bark') v+=9*Math.sin(x*.48+Math.sin(y*.045+x*.16))
      const i=(y*size+x)*4, base=224+v
      pixels.data[i]=base+3; pixels.data[i+1]=base+1; pixels.data[i+2]=base-3; pixels.data[i+3]=255
    }
    ctx.putImageData(pixels,0,0)
    if(kind==='stone') {
      const h = size/9
      for(let row=0; row<9;row++) {
        for(let col=-1;col<6;col++) {
          const x=(col+(row%2)*.53)*size/5, y=row*h
          ctx.fillStyle='rgba(50,42,34,.22)'
          ctx.fillRect(x,y,size/5,1.3)
          ctx.fillRect(x,y,1.5,h)
          ctx.fillStyle='rgba(255,250,233,.26)'
          ctx.fillRect(x+2,y+2,size/5-3,1)
          ctx.fillStyle='rgba(83,71,55,'+(rng()*.12)+')'
          ctx.fillRect(x+2,y+3,size/5-3,h-3)
        }
      }
    }
    if(kind==='road' || kind==='plaster' || kind==='earth') {
      for(let c=0;c<(kind==='earth'?2:8);c++){
        let x=rng()*size, y=rng()*size
        ctx.beginPath(); ctx.moveTo(x,y)
        for(let j=0;j<4+rng()*9;j++){x+=(rng()-.5)*size*.047; y+=rng()*size*.031;ctx.lineTo(x,y)}
        ctx.strokeStyle='rgba(64,55,46,'+(.13+rng()*.23)+')'
        ctx.lineWidth=.4+rng()*.9;ctx.stroke()
      }
      if(fine) for(let i=0;i<size*3;i++){
        const x=rng()*size,y=rng()*size,d=rng()*1.8+.55
        ctx.fillStyle='rgba(91,78,61,.27)';ctx.fillRect(x,y,d+1,d)
        ctx.fillStyle='rgba(254,251,229,.55)';ctx.fillRect(x,y,d*.75,1)
      }
    }
    if(kind==='metal') for(let i=0;i<42;i++){
      ctx.fillStyle='rgba(99,78,62,'+(.02+rng()*.10)+')'
      ctx.fillRect(rng()*size,rng()*size,.7+rng()*2,rng()*size*.32)
    }
  })
}

type BufferGroup={pos:number[],normal:number[],uv:number[],color:number[],indices:number[],mat:THREE.Material}
type Frame={x:number, y:number, z:number, angle:number}

function skyDome(cfg:Setting,index:number) {
  const geometry = new THREE.SphereGeometry(280,36,20)
  const material = new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{zenith:{value:new THREE.Color(cfg.sky).multiplyScalar(cfg.night?.52:.76)}, horizon:{value:new THREE.Color(cfg.fog)},sunColor:{value:new THREE.Color(cfg.night?0xd2e2ff:0xffe6b5)}, sunDir:{value:new THREE.Vector3(-.56,.19+Math.sin(index*1.75)*.09,-.77).normalize()}, night:{value:cfg.night?1:0}, weather:{value:cfg.weather}},
    vertexShader:`varying vec3 vDir; void main(){vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.99998;}`,
    fragmentShader:`varying vec3 vDir; uniform vec3 zenith,horizon,sunColor,sunDir;uniform float night,weather;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
    void main(){vec3 d=normalize(vDir);float alt=max(d.y,0.);vec3 c=mix(horizon,zenith,pow(smoothstep(-.09,.85,d.y),.53));
    vec2 p=d.xz/max(.06,alt+.14);p*=vec2(3.3,8.);float cl=.55*noise(p)+.28*noise(p*2.13)+.12*noise(p*4.57)+.05*noise(p*9.);
    c=mix(c,mix(horizon*1.21,zenith*.67,smoothstep(.48,.84,cl)),smoothstep(.44,.77,cl)*(.32+weather*.48)*smoothstep(.008,.28,alt));
    float s=max(dot(d,sunDir),0.);c+=sunColor*(pow(s,26.)*.26+pow(s,420.)*.46)*(1.-night*.92);
    c=mix(c,sunColor*(1.7-night*.4),smoothstep(.99975,.99992,s));if(night>.5){vec2 uv=vec2(atan(d.x,d.z),asin(d.y))*560.;c+=vec3(pow(h(floor(uv)),280.)*smoothstep(.12,.5,alt)*(.35+.65*noise(floor(uv)))*(1.-smoothstep(.05,.5,length(fract(uv)-.5)))*.8);}
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`
  })
  const mesh = new THREE.Mesh(geometry,material)
  mesh.renderOrder=-10
  return mesh
}

export function buildWorld(index:number,quality:number) {
  index=Math.max(0,Math.min(7,Math.floor(index)))
  quality=Math.max(0,Math.min(3,Math.floor(quality)||0))
  const cfg=settings[index], rng=random(0x512e+index*219)
  const group=new THREE.Group(), blockers:THREE.Box3[]=[]
  let completedGoals=0
  let courtyardLamp:THREE.Group|undefined
  let rollingShutter:THREE.Group|undefined
  group.name=cfg.name
  const bounds=33
  const heightAt=(x:number,z:number)=>cfg.mountain ?
    1.8+1.05*Math.sin(z*.095)+.70*Math.sin(x*.107+.6)+.45*Math.cos((x+z)*.12) :
    cfg.camp ? .22*Math.sin(x*.12)*Math.cos(z*.12) : 0
  const spawn:XZ=[0,24]
  const routes: XZ[][]=[
    [[-.8,12],[-2.5,1],[3.5,-11],[0,-24]], [[1,12],[3,1],[-3,-12],[2,-25]],
    [[-1,11],[-3.7,-.5],[2.3,-10],[-.8,-26]], [[1.4,13],[-1,3],[4,-9],[-2,-24]],
    [[-.5,11],[-3.1,-1.5],[2.2,-12],[0,-26]], [[1.1,13],[4,1],[-3.2,-12],[2,-25]],
    [[-1.7,13],[2.1,1],[4.4,-12],[-1,-25]], [[0,12],[-3.8,2],[3.1,-10],[1,-25]]
  ]
  const objectives=routes[index], landmarks:XZ[]=objectives.map(([x,z])=>[x,z]), optional:XZ=[index%2 ? -4.7 : 4.7,6.5]
  const encounters:XZ[]=[[-2.7,-4],[3.8,-17],[-2.1,-23],[4.2,-7]]
  const midXZ:XZ[]=[spawn,...objectives,optional,...encounters]
  const textures=new Set<THREE.Texture>(),materials=new Set<THREE.Material>()
  const geometrySet=new Set<THREE.BufferGeometry>()
  const palette=new Map<Finish,THREE.MeshStandardMaterial>()
  const mat=(kind:Finish)=>{
    let m=palette.get(kind)
    if(m) return m
    const textured=!['glass','light','foliage'].includes(kind)
    const tex=textured?textureFor(kind,quality<1?128:256):null
    if(tex)textures.add(tex)
    m=new THREE.MeshStandardMaterial({map:tex,vertexColors:true,roughness:kind==='glass'?.26:kind==='metal'?.66:.93,metalness:kind==='glass'?.32:kind==='metal'?.25:0})
    if(kind==='light'){m.emissive.setHex(cfg.night?0xffab54:0x846642);m.emissiveIntensity=cfg.night?1.8:.25}
    palette.set(kind,m);materials.add(m);return m
  }
  const sources={
    box:new THREE.BoxGeometry(1,1,1),
    rod:new THREE.CylinderGeometry(.5,.5,1,8),
    tank:new THREE.CylinderGeometry(.5,.47,1,14),
    cone:new THREE.ConeGeometry(.5,1,18),
    rock:new THREE.IcosahedronGeometry(.5,0),
    boulder:new THREE.IcosahedronGeometry(.5,1),
    round:new THREE.SphereGeometry(.5,10,7),
    ring:new THREE.TorusGeometry(.43,.055,6,18)
  }
  type Shape=keyof typeof sources
  let buffers=new Map<string,BufferGroup>()
  const frame:Frame={x:0,y:0,z:0,angle:0}
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3()
  const transform=new THREE.Matrix4(),normalTransform=new THREE.Matrix3(),fMat=new THREE.Matrix4()
  const up=new THREE.Vector3(0,1,0),axis=new THREE.Vector3(),euler=new THREE.Euler(), point=new THREE.Vector3(),norm=new THREE.Vector3(),tint=new THREE.Color()
  const moveFrame=(x=0,y=0,z=0,angle=0)=>{
    Object.assign(frame,{x,y,z,angle});fMat.makeRotationY(angle);fMat.setPosition(x,y,z)
  }
  moveFrame()
  function part(shape:Shape,x:number,y:number,z:number,w:number,h:number,d:number,color:number,kind:Finish='plaster',rx=0,ry=0,rz=0,orient?:THREE.Quaternion) {
    const source=sources[shape], a=source.attributes
    position.set(x,y,z);scale.set(w,h,d)
    if(orient) rotation.copy(orient);else rotation.setFromEuler(euler.set(rx,ry,rz))
    transform.compose(position,rotation,scale).premultiply(fMat);normalTransform.getNormalMatrix(transform)
    const key=kind+'_'+Math.floor((transform.elements[12]+36)/26)+'_'+Math.floor((transform.elements[14]+36)/26)
    let b=buffers.get(key)
    if(!b){b={pos:[],normal:[],uv:[],color:[],indices:[],mat:mat(kind)};buffers.set(key,b)}
    const base=b.pos.length/3;tint.setHex(color)
    const den=kind==='stone'?.31:kind==='road'?.19:kind==='earth'?.30:.43
    for(let i=0;i<a.position.count;i++){
      point.fromBufferAttribute(a.position,i).applyMatrix4(transform)
      norm.fromBufferAttribute(a.normal,i).applyNormalMatrix(normalTransform)
      b.pos.push(point.x,point.y,point.z);b.normal.push(norm.x,norm.y,norm.z);b.color.push(tint.r,tint.g,tint.b)
      if(Math.abs(norm.y)>.62)b.uv.push(point.x*den,point.z*den)
      else if(Math.abs(norm.x)>.62)b.uv.push(point.z*den,point.y*den)
      else b.uv.push(point.x*den,point.y*den)
    }
    if(source.index) for(const v of source.index.array)b.indices.push(base+v)
    else for(let i=0;i<a.position.count;i++)b.indices.push(base+i)
  }
  function beam(a:XYZ,b:XYZ,width:number,color:number,kind:Finish='metal',round=true){
    axis.set(b[0]-a[0],b[1]-a[1],b[2]-a[2])
    const length=axis.length()
    if(length<.001)return
    const q=new THREE.Quaternion().setFromUnitVectors(up,axis.normalize())
    part(round?'rod':'box',(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,width,length,width,color,kind,0,0,0,q)
  }
  function collision(x:number,z:number,w:number,h:number,d:number,y=heightAt(x,z)){
    blockers.push(new THREE.Box3(new THREE.Vector3(x-w/2,y-.35,z-d/2), new THREE.Vector3(x+w/2,y+h,z+d/2)))
  }
  function localBlock(x:number,y:number,z:number,w:number,h:number,d:number){
    blockers.push(new THREE.Box3(new THREE.Vector3(x-w/2,y-h/2,z-d/2),new THREE.Vector3(x+w/2,y+h/2,z+d/2)).applyMatrix4(fMat))
  }
  function register(mesh:THREE.Mesh,cast=false,receive=true){
    mesh.castShadow=cast;mesh.receiveShadow=receive;group.add(mesh);geometrySet.add(mesh.geometry)
    if(Array.isArray(mesh.material))mesh.material.forEach(m=>materials.add(m));else materials.add(mesh.material)
    return mesh
  }
  register(skyDome(cfg,index),false,false)
  // Hand-shaped stratified ridgelines. Three spatial layers remain visible above the rooftops.
  function ridge(layer:number){
    const pos:number[]=[],col:number[]=[],indices:number[]=[],baseRadius=layer===2?181:layer===1?132:87
    const steps=148,rows=7, outer=new THREE.Color(), base=new THREE.Color()
    base.setHex(cfg.night?[0x414456,0x545466,0x636779][layer]:[0x8e806d,0xb09d88,0xbbafa0][layer])
    const phase=1.21*index+.97*layer
    for(let j=0;j<rows;j++)for(let i=0;i<=steps;i++){
      const ang=i/steps*Math.PI*2, v=j/(rows-1)
      const ridged=Math.sin(3*ang+phase)*3.5+Math.sin(7*ang+phase*.33)*3.9+Math.sin(13*ang+phase)*1.7+1.35*Math.sin(24*ang+phase)
      const peak=(cfg.mountain?23:15)+layer*5+ridged*1.1+6*Math.cos(ang+Math.PI)+Math.sin(36*ang+phase)*.65
      const radius=baseRadius+v*17+2*Math.cos(10*ang+v*3+phase)
      pos.push(Math.sin(ang)*radius, -2+v*peak+Math.sin(ang*19+v*5)*v*.7,Math.cos(ang)*radius)
      outer.copy(base)
      outer.multiplyScalar(.82+.14*Math.sin(ang*21+phase+v*2)+v*.23+(j%2)*.055)
      col.push(outer.r,outer.g,outer.b)
      if(j<rows-1 && i<steps){const p=j*(steps+1)+i;indices.push(p,p+steps+1,p+1,p+1,p+steps+1,p+steps+2)}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.setIndex(indices);geo.computeVertexNormals()
    const m=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1,side:THREE.DoubleSide})
    register(new THREE.Mesh(geo,m),false,false)
  }
  for(let l=2;l>=0;l--)ridge(l)
  const groundGeo=new THREE.PlaneGeometry(192,192,cfg.mountain?104:cfg.camp?44:4,cfg.mountain?104:cfg.camp?44:4)
  groundGeo.rotateX(-Math.PI/2)
  const gp=groundGeo.attributes.position,gu=groundGeo.attributes.uv,gc:number[]=[]
  for(let i=0;i<gp.count;i++){
    const x=gp.getX(i),z=gp.getZ(i);gp.setY(i,heightAt(x,z)-.03);gu.setXY(i,x*.32,z*.32)
    tint.setHex(cfg.mountain?0xb2a084:0xc4b395).multiplyScalar(.91+.07*Math.sin(x*.28+z*.09)+.07*rng());gc.push(tint.r,tint.g,tint.b)
  }
  groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(gc,3));groundGeo.computeVertexNormals()
  register(new THREE.Mesh(groundGeo,mat('earth')))
  function road(){
    const p:number[]=[],colors:number[]=[],uv:number[]=[],idx:number[]=[]
    for(let i=0;i<=54;i++){
      const z=-54+i*2, center=Math.sin(z*.06+index)* (cfg.mountain?1.4:.32)
      const spread=cfg.mountain?2.35:cfg.street-.55
      for(let j=0;j<=4;j++){
        const x=center+(j/4-.5)*spread*2+(j===0 || j===4 ? (rng()-.5)*.35:0)
        p.push(x,heightAt(x,z)+.018,z);uv.push(x*.21,z*.21)
        tint.setHex(cfg.mountain||cfg.camp?0xccb593:0x999086).multiplyScalar(.88+rng()*.12+(j===0||j===4?.07:0));colors.push(tint.r,tint.g,tint.b)
      }
      if(i<54) for(let j=0;j<4;j++){const a=i*5+j;idx.push(a,a+5,a+1,a+1,a+5,a+6)}
    }
    const g=new THREE.BufferGeometry()
    g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();register(new THREE.Mesh(g,mat(cfg.mountain?'earth':'road')))
  }
  road()
  function distanceDetail(mesh:THREE.Mesh,range:number){
    const levels=new THREE.LOD()
    levels.position.copy(mesh.position)
    mesh.position.set(0,0,0)
    levels.addLevel(mesh,0)
    levels.addLevel(new THREE.Object3D(),range,.12)
    group.add(levels)
  }
  const signs=new Map<string,THREE.MeshStandardMaterial>()
  function sign(x:number,y:number,z:number,w:number,h:number,arabic:string,kurmanji='',painted=false){
    const key=arabic+'|'+kurmanji
    let m=signs.get(key)
    if(!m){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=176
      const ctx=canvas.getContext('2d')!
      if(!painted){
        ctx.fillStyle=['#355956','#404f5b','#71514a'][key.length%3];ctx.fillRect(0,0,512,176)
        ctx.strokeStyle='#baa987';ctx.lineWidth=4;ctx.strokeRect(8,8,496,160)
        ctx.lineWidth=1;ctx.strokeRect(14,14,484,148)
      }
      ctx.direction='rtl';ctx.textAlign='center';ctx.textBaseline='middle'
      ctx.fillStyle=painted?'#655145':'#f4e6c8';ctx.font='bold '+(kurmanji?'56':'74')+'px serif';ctx.fillText(arabic,256,kurmanji?71:88,472)
      if(kurmanji){ctx.direction='ltr';ctx.font='24px serif';ctx.fillText(kurmanji,256,133,478)}
      const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;textures.add(tex)
      m=new THREE.MeshStandardMaterial({map:tex,transparent:painted,roughness:.95,polygonOffset:true,polygonOffsetFactor:-2});signs.set(key,m)
    }
    const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);o.position.set(x,y,z).applyMatrix4(fMat);o.rotation.y=frame.angle
    register(o)
    distanceDetail(o,quality<1?26:quality===1?38:58)
  }
  const shopText=['مخبز الساحة','دكان الزيتون','خياطة نسرين','مكتبة الجبل','سوق النحاس','بيت الخزّاف','أدوات البناء','سنعود ونبني من جديد']
  function building(x:number,z:number,rotationY:number,w:number,d:number,stories:number,style:number,details=true){
    const y=heightAt(x,z)-.08,floor=2.75,front=d*.5,hw=w/2,height=floor*stories
    moveFrame(x,y,z,rotationY)
    const wall=cfg.plaster[Math.floor(rng()*cfg.plaster.length)],edge=0xd2c4ac, frameColor=[0x5f625a,0x4a534e,0x75665a][style%3]
    const decayed=details && rng()<cfg.damage
    part('box',0,.22,0,w+.12,.5,d+.10,0x998979,'stone')
    part('box',0,height*.5, -.14,w,height,d-.28,wall,style%5===3?'stone':'plaster')
    for(let floorIndex=0;floorIndex<stories;floorIndex++){
      const fy=floorIndex*floor, columns=Math.max(2,Math.round((w-.4)/2.3)),bay=w/columns
      if(floorIndex>0)part('box',0,fy+.02,0,w+.18,.21,d+.16,edge)
      for(let col=0;col<columns;col++){
        const cx=-hw+bay*(col+.5),isDoor=floorIndex===0&&col===style%columns
        const opening=isDoor?Math.min(1.36,bay*.7):bay*(style%2?.62:.67)
        const bottom=isDoor?.12:.86,top=isDoor?2.25:2.09
        const damage=decayed && floorIndex===stories-1 && col===0
        const post=(bay-opening)*.5
        if(!damage){
          part('box',cx-bay*.5+post*.5,fy+floor*.5,front-.1,post,floor,.24,wall)
          part('box',cx+bay*.5-post*.5,fy+floor*.5,front-.1,post,floor,.24,wall)
          if(!isDoor)part('box',cx,fy+bottom*.5,front-.1,opening,bottom,.24,wall)
          part('box',cx,fy+(floor+top)/2,front-.1,opening,floor-top,.24,wall)
        }
        const panelZ=front-.23
        part('box',cx,fy+(bottom+top)/2,panelZ,opening+.04,top-bottom,.055,isDoor?0x5e5b51:damage?0x333333:cfg.night&&(col+floorIndex+style)%5===1?0xffca82:0x52605e,isDoor?'bark':cfg.night&&!damage&&(col+floorIndex+style)%5===1?'light':'glass')
        if(!details)continue
        if(!damage){
          part('box',cx,fy+bottom-.018,front+.04,opening+.18,.10,.28,edge)
          if(isDoor){
            part('box',cx,fy+(bottom+top)/2,panelZ+.065,opening*.92,top-bottom-.11,.055,[0x58645a,0x5c7070,0x805b4e][style%3],'metal')
            for(const off of [-.23,.23])for(let k=0;k<2;k++)
              part('box',cx+off*opening,fy+.56+k*.92,panelZ+.11,opening*.34,.59,.036,frameColor,'metal')
            part('box',cx+.31*opening,fy+1.08,panelZ+.17,.05,.17,.06,0xc1a577,'metal')
            part('box',cx,fy+.086,front+.20,opening+.3,.16,.5,0xb9ad97,'stone')
          }else{
            part('box',cx,fy+(top+bottom)/2,front-.10,.052,top-bottom,.09,frameColor,'metal')
            part('box',cx,fy+top-.33,front-.1,opening,.055,.09,frameColor,'metal')
            if(style%3===0 && floorIndex===0){
              for(let j=-1;j<=1;j++)part('box',cx+j*opening*.27,fy+(top+bottom)/2,front+.015,.027,top-bottom,.055,0x555449,'metal')
            }else if(style%4===1){
              for(const side of [-1,1])part('box',cx+side*(opening/2+.15),fy+(top+bottom)/2,front+.03,.29,top-bottom,.075,frameColor,'bark',0,side*.09)
            }
          }
        }else{
          part('box',cx-.13,fy+.35,front+.02,bay*.68,.7,.35,0x9c8771,'stone',0,0,.08)
          for(let r=0;r<3;r++)beam([cx-.7+r*.3,fy+.45,front],[cx-.62+r*.32,fy+1.15+rng()*.37,front+.04],.028,0x5f5148)
        }
      }
      if(stories>1 && floorIndex===1 && details && style%3!==2){
        const bw=Math.min(w*.6,4.3),bz=front+.50
        part('box',0,fy+.05,bz,bw,.20,1.15,edge)
        localBlock(0,fy+.52,bz,bw,1.12,1.15)
        for(let bar=0;bar<12;bar++)part('rod',-bw/2+bw*bar/11,fy+.58,front+1.03,.034,.88,.034,frameColor,'metal')
        beam([-bw/2,fy+1.01,front+1.03],[bw/2,fy+1.01,front+1.03],.06,frameColor)
        for(const s of [-1,1])beam([s*bw/2,fy+1.01,front+.03],[s*bw/2,fy+1.01,front+1.03],.06,frameColor)
        if(style%2===0)part('box',.3,fy+.77,front+1.07,bw*.36,.53,.035,0xb08062,'cloth',.06)
      }
    }
    // Flat roof slabs, parapets and domestic silhouettes.
    part('box',0,height+.07,0,w+.36,.20,d+.35,0xb8ab99)
    const frontLen=decayed?w*.55:w
    part('box',(w-frontLen)*.5,height+.35,front-.05,frontLen,.50,.22,wall)
    part('box',0,height+.38,-front,w,.54,.25,wall)
    for(const s of [-1,1])part('box',s*(hw-.1),height+.36,0,.25,.51,d,wall)
    if(details){
      if(style%2===0){
        const tx=hw*.42,tz=-front*.4
        part('tank',tx,height+1.05,tz,1.36,1.7,1.36,0xaaa89c,'metal')
        for(const yy of [.30,.94,1.63])part('rod',tx,height+yy,tz,1.40,.055,1.40,0x757671,'metal')
        part('rod',tx,height+1.93,tz,.45,.10,.45,0x696c66,'metal')
      }else{
        part('rod',hw*.4,height+1.25,-.7,.048,2.5,.048,0x6e685b,'metal')
        for(let l=0;l<3;l++)beam([hw*.4-.44,height+2.03+l*.17,-.7],[hw*.4+.44,height+2.03+l*.17,-.7],.026,0x837969)
      }
      if(decayed){
        for(let j=0;j<5;j++){
          const ax=-hw+j*.22
          beam([ax,height+.15,front-.06],[ax+(.5-rng())*.2,height+.53+rng()*.62,front+.06],.031,0x6d5648)
          part('rock',ax,.17,front+.48+rng()*.68,.4+rng()*.6,.19+rng()*.35,.4+rng()*.45,0xac9986,'stone',rng(),rng())
        }
      }
      if((index===1 || index===0 || index===7) && style%3!==2){
        const awColor=[0x805c4b,0x6e786c,0x9d8060,0x515e66][style%4],awWidth=w*.75
        localBlock(0,2.32,front+.78,awWidth,.36,1.56)
        for(let j=0;j<7;j++){
          const ax=awWidth*((j+.5)/7-.5)
          part('box',ax,2.38,front+.78,awWidth/7+.008,.061,1.55,j%2?awColor:0xc9b69a,'cloth',.18)
          part('box',ax,2.17,front+1.52,awWidth/7,.22,.044,j%2?awColor:0xc9b69a,'cloth')
        }
        for(const s of [-1,1])beam([s*awWidth*.46,1.91,front],[s*awWidth*.46,2.24,front+1.5],.045,0x686154)
        sign(0,2.66,front+.04,Math.min(3.4,w*.55),.64,shopText[(style+index)%shopText.length])
      }else if(style%5===1){
        sign(0,2.44,front+.06,Math.min(3.6,w*.72),.72,index===2?'لن ننسى':'السلام لأرض شنكال','Silav ji Şingalê',true)
      }
    }
    const swap=Math.abs(Math.sin(rotationY))>.6
    collision(x,z,swap?d:w,height+.6,swap?w:d,y)
    moveFrame()
  }
  const leafMatrices:THREE.Matrix4[]=[],leafColors:THREE.Color[]=[]
  function olive(x:number,z:number,size:number){
    moveFrame(x,heightAt(x,z),z,rng()*Math.PI*2)
    part('tank',0,size*.54,0,size*.43,size*1.12,size*.34,0x736655,'bark',.07,0,-.14)
    for(let k=0;k<5;k++){
      const a=k*Math.PI*.4+rng()*.66,tx=Math.cos(a)*size*(.59+rng()*.36),tz=Math.sin(a)*size*(.59+rng()*.36),ty=size*(1.12+rng()*.29)
      beam([.03,size*.68,.02],[tx*.57,ty,tz*.57],size*.18,0x7c7060,'bark')
      beam([tx*.57,ty,tz*.57],[tx,ty+size*.24,tz],size*.09,0x7b6c5a,'bark')
      for(let j=0;j<5;j++){
        position.set(tx+(rng()-.5)*size*.45,ty+size*(.27+rng()*.29),tz+(rng()-.5)*size*.47)
        rotation.setFromEuler(euler.set((rng()-.5)*1.2,a+j*.98,(rng()-.5)*.8));scale.set(size*(1.1+rng()*.42),size*(.8+rng()*.31),1)
        const color=new THREE.Color().setRGB(.72+rng()*.22,.75+rng()*.18,.71+rng()*.18)
        if(quality>0 || j<3){
          leafMatrices.push(new THREE.Matrix4().compose(position,rotation,scale).premultiply(fMat))
          leafColors.push(color)
        }
      }
    }
    collision(x,z,size*.44,size*2.15,size*.44);moveFrame()
  }
  function foliage(){
    if(!leafMatrices.length)return
    const tex=canvasTexture(256,ctx=>{
      ctx.clearRect(0,0,256,256)
      for(let k=0;k<19;k++){
        const a=k*.34+ .62*rng(),fromX=112+rng()*26,fromY=112+rng()*36, len=51+rng()*70
        const dx=Math.cos(a),dy=Math.sin(a)
        ctx.beginPath();ctx.moveTo(fromX,fromY);ctx.quadraticCurveTo(fromX+dx*len*.45+dy*6,fromY+dy*len*.45,fromX+dx*len,fromY+dy*len)
        ctx.strokeStyle='#71715c';ctx.lineWidth=1.5;ctx.stroke()
        for(let j=0;j<13;j++)for(const s of [-1,1]){
          const f=(j+rng())/13,la=a+s*(.47+rng()*.73),l=3+rng()*7
          const lx=fromX+dx*len*f+Math.cos(la)*l*.75,ly=fromY+dy*len*f+Math.sin(la)*l*.75
          ctx.beginPath();ctx.ellipse(lx,ly,l,1.5+rng()*2.7,la,0,Math.PI*2)
          ctx.fillStyle=['#798168','#8c9479','#657457','#a0a48b','#69775b','#8d9777'][Math.floor(rng()*6)];ctx.fill()
        }
      }
    });textures.add(tex)
    const material=new THREE.MeshStandardMaterial({map:tex,alphaTest:.33,side:THREE.DoubleSide,roughness:.95})
    const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),material,leafMatrices.length)
    for(let i=0;i<leafMatrices.length;i++){leaves.setMatrixAt(i,leafMatrices[i]);leaves.setColorAt(i,leafColors[i])}
    leaves.computeBoundingSphere();register(leaves,quality>0)
  }
  function safe(x:number,z:number,r:number){return midXZ.every(p=>Math.hypot(p[0]-x,p[1]-z)>r+.95)}
  function vehicle(x:number,z:number,angle:number,abandoned:boolean){
    const y=heightAt(x,z),body=[0x938c77,0xa19a88,0x78837c,0xab9c89][index%4]
    moveFrame(x,y,z,angle)
    // Boxy older estate, assembled with an inclined windshield, recessed grille and independent tires.
    part('box',0,.66,0,1.76,.5,3.9,body,'metal')
    part('box',0,.76,1.41,1.74,.35,1.12,body,'metal',-.06)
    part('box',0,1.17,-.16,1.51,.68,1.72,0x475653,'glass')
    part('box',0,1.25,.70,1.51,.61,.095,0x536362,'glass',-.44)
    part('box',0,1.24,-1.02,1.50,.59,.10,0x59615c,'glass',.35)
    part('box',0,1.54,-.18,1.59,.096,1.64,body,'metal')
    for(const s of [-1,1]){
      for(const zz of [-.94,-.15,.61])part('box',s*.77,1.23,zz,.064,.65,.072,body,'metal',zz<-.8?.29:zz>.5?-.39:0)
      part('box',s*.89,.7,-.02,.04,.035,2.32,0x636357,'metal')
      part('box',s*.89,.88,.22,.053,.055,.18,0x737773,'metal')
      part('box',s*.99,1.08,.53,.20,.13,.20,body,'metal')
      for(const zz of [-1.16,1.17]){
        part('rod',s*.82,.38,zz,.70,.24,.70,0x474542,'metal',0,0,Math.PI/2)
        part('rod',s*.945,.38,zz,.38,.027,.38,0x898a80,'metal',0,0,Math.PI/2)
        part('rod',s*.967,.38,zz,.17,.026,.17,0x61635b,'metal',0,0,Math.PI/2)
      }
      part('box',s*.58,.71,1.97,.38,.17,.045,0xcebc92,'glass')
      part('box',s*.63,.74,-1.97,.30,.17,.050,0x885b50,'glass')
    }
    part('box',0,.43,1.98,1.72,.14,.17,0x81827a,'metal')
    part('box',0,.69,1.98,.68,.23,.07,0x4e514e,'metal')
    for(let k=0;k<3;k++)part('box',0,.61+k*.07,2.025,.64,.024,.028,0x96958a,'metal')
    if(abandoned){
      part('box',-.87,.69,-.41,.07,.57,.96,0x817565,'metal',0,-.42)
      part('box',.29,.99,1.28,.56,.018,.67,0x998779,'metal',.02,.22)
    }
    collision(x,z,Math.abs(Math.cos(angle))*1.9+Math.abs(Math.sin(angle))*3.9,1.55,Math.abs(Math.cos(angle))*3.9+Math.abs(Math.sin(angle))*1.9)
    moveFrame()
  }
  function crate(x:number,z:number,s:number,stack:boolean){
    moveFrame(x,heightAt(x,z),z,0)
    for(let j=0;j<(stack?2:1);j++){
      part('box',j*.06,(j+.5)*s,0,s*1.27,s*.93,s*.91,0x9e8463,'bark')
      for(const a of [-1,1]){
        part('box',a*s*.43,(j+.5)*s,s*.47,s*.084,s*.98,s*.05,0xb29b77,'bark')
        part('box',j*.06,(j+.5)*s+a*s*.35,s*.47,s*1.24,s*.045,s*.04,0x826f58,'bark')
      }
      part('box',j*.06,j*s+s*.98,0,s*1.35,s*.07,s*.99,0xb29b78,'bark')
    }
    collision(x,z,1.33*s,(stack?2:1)*s,s);moveFrame()
  }
  function tent(x:number,z:number,angle:number,w:number){
    const h=w*.52,d=w*1.34, y=heightAt(x,z)
    moveFrame(x,y,z,angle)
    const color=[0xb0a18a,0xc5b69c,0xa9aa94][Math.floor(rng()*3)]
    for(const s of [-1,1]){
      part('box',s*w*.255,h*.86,0,w*.56,.052,d,color,'cloth',0,0,-s*.44)
      part('box',s*w*.50,h*.36,0,.045,h*.7,d,color,'cloth')
      part('box',s*w*.30,h*.39,d/2,w*.40,h*.74,.046,color,'cloth')
      for(const e of [-1,1]) {
        beam([s*w*.47,h*.62,e*d*.47],[s*w*.68,.04,e*d*.54],.023,0x726b57,'cloth')
        part('rod',s*w*.50,h*.36,e*d*.475,.07,h*.72,.07,0x89775c,'bark')
      }
    }
    part('box',0,h*.45,-d/2,w*.96,h*.88,.065,color,'cloth')
    part('rod',0,h*.55,d*.47,.07,h*1.1,.07,0x82715d,'bark')
    collision(x,z,Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*d,h,Math.abs(Math.cos(angle))*d+Math.abs(Math.sin(angle))*w)
    moveFrame()
  }
  function lamp(x:number,z:number,side:number,aLit:boolean){
    moveFrame(x,heightAt(x,z),z)
    const height=4.55
    part('tank',0,height/2,0,.119,height,.119,0x716e60,'metal')
    beam([0,height-.35,0],[-side*.72,height+.11,0],.076,0x7a796b)
    part('box',-side*.79,height+.085,0,.46,.12,.27,0x656a60,'metal',0,0,side*.09)
    part('box',-side*.80,height-.02,0,.37,.055,.20,0xffd990,aLit?'light':'glass')
    if(cfg.night && aLit){
      const l=new THREE.PointLight(0xffbf73,15,12,1.8);l.position.set(x-side*.79,height-.11,z);group.add(l)
    }
    moveFrame()
  }
  function powerline(x1:number,z1:number,x2:number,z2:number){
    const gray=0x5e5a51
    for(let n=0;n<2;n++) {
      const x=n?x2:x1,z=n?z2:z1, y=heightAt(x,z)
      part('tank',x,y+2.95,z,.15,5.9,.15,0x847965,'bark',0,0,n?.016:-.018)
      part('box',x,y+5.65,z,.13,.14,1.2,gray,'metal')
    }
    for(let line=0;line<2;line++){
      const dz=line===0?-.39:.39
      const pt=(u:number):XYZ=>[x1+(x2-x1)*u,5.82+(1-u)*heightAt(x1,z1)+u*heightAt(x2,z2)-Math.sin(u*Math.PI)*.71,z1+(z2-z1)*u+dz]
      for(let j=0;j<8;j++)beam(pt(j/8),pt((j+1)/8),.021,0x52534a)
    }
  }
  function street(){
    const zs=[-28,-17.6,-7,4.5,16.2,27.5]
    for(const side of [-1,1]){
      for(let j=0;j<zs.length;j++){
        const z=zs[j]+(side===1?2.3:0)+(rng()-.5)*1.55
        const depth=5.0+rng()*2.5, w=6.8+rng()*2.7, x=side*(cfg.street+depth/2+rng()*1.1)
        if(cfg.camp && ((j+Number(side>0))%3!==0)){
          tent(x,z,side*.5,3.8+rng());olive(x+side*3.8,z-3,1.75+rng()*.35)
        }else if((j+index+(side>0?2:0))%7===3){
          olive(x,z,2.4)
          building(x+side*4.6,z, -side*Math.PI/2,w,depth*.67,1,j+index)
        }else{
          const floors=1+((j*7+index+(side===1?2:0))%3===0?0:(index===1&&j%3===1?2:1))
          building(x,z,-side*Math.PI/2,w,depth,floors,j+index+(side>0?2:0))
        }
        if(j%2===0 && !cfg.camp){
          const xx=side*(cfg.street-.02)
          if(safe(xx,z+2,1.25))crate(xx,z+2,.74, j%4===0)
        }
        if(!cfg.camp){
          // Narrow paved stoops and individual kerbstones with occasional broken sections.
          part('box',side*(cfg.street+.48),.053,z,1.47,.19,w+.9,0xb8aa94,'stone')
          for(let k=0;k<Math.floor(w/1.1);k++)part('box',side*(cfg.street-.22),.11,z-w/2+k*1.13,.19,.21,1.09,0xc4b79f,'stone')
        }
      }
      for(let j=0;j<5;j++){
        const x=side*(24.5+rng()*2.5),z=-27+13.1*j+(side===1?3:0)
        if(cfg.camp && j%2){olive(x,z,2.1);continue}
        building(x,z,-side*Math.PI/2,7+rng()*2,5.5+rng(),1+Math.round(rng()),j+3,false)
      }
    }
    // Cross streets open into the neighbourhood at both ends.
    for(let j=-2;j<=2;j++){
      if(j!==0 || !cfg.camp)building(j*10+.8,-39-rng()*2,0,6.9+rng()*1.7,4.8,1+(j===1?1:0),j+5,false)
      if(j!==0)building(j*11,39+rng()*3,Math.PI,7.1+rng(),4.9,1+(j%2===0?1:0),j+6,false)
    }
    powerline(-cfg.street+.08,-20,cfg.street-.06,-15)
    powerline(-cfg.street+.10,7,cfg.street-.30,13)
    for(let j=0;j<4;j++){const s=j%2?-1:1;lamp(s*(cfg.street-.38),-24+j*14,s,j===1||j===2)}
    for(let j=0;j<(cfg.camp?1:3);j++){
      const s=j%2?-1:1,x=s*(cfg.street-.77),z=[-19.6,-7.1,19.7][j]
      if(safe(x,z,2.1))vehicle(x,z,(rng()-.5)*.31+(j%2?Math.PI:0),cfg.damage>.4)
    }
    for(let j=0;j<6;j++){
      const s=j%2?-1:1,x=s*(17.5+rng()*2),z=-29+j*9
      if(!blockers.some(b=>x>b.min.x-1&&x<b.max.x+1&&z>b.min.z-1&&z<b.max.z+1))olive(x,z,1.7+rng()*.5)
    }
  }
  function mountain(){
    for(let i=0;i<94;i++){
      const s=i%2?-1:1,z=(rng()-.5)*75,x=s*(7.8+rng()*29)
      const w=.65+rng()*3.3, h=w*(.43+rng()*.46),d=w*(.75+rng()*.51),base=heightAt(x,z)
      part('boulder',x,base+h*.34,z,w,h,d,[0xa4957f,0xa79a86,0x918775,0xc1b197][i%4],'stone',rng()*.56,rng()*3.8,rng()*.28)
      if(w>1.5)collision(x,z,w*.75,h*.77,d*.74)
    }
    for(let j=0;j<13;j++){
      const z=-31+j*5.4+(rng()-.5)*4,x=(j%2?-1:1)*(6.7+rng()*7)
      olive(x,z,1.77+rng()*.70)
    }
    tent(8.6,14,-.38,3.65);tent(12.4,7,-1.2,3.95);tent(-8.7,-7,.82,3.65)
    // Walkable rock shelter with a cantilever canopy and a genuinely open entrance.
    const x=-11,z=-21,y=heightAt(x,z)
    for(let i=-1;i<=1;i+=2){
      part('boulder',x+i*3.2,y+1.3,z,2.9,4.7,6.6,0x968974,'stone',0,rng()*.45,i*.12)
      collision(x+i*3.2,z,2.25,3.7,5.6,y)
    }
    part('boulder',x,y+3.5,z-.7,8.9,2.4,7.3,0xaa9c87,'stone',0,.09,-.07)
    blockers.push(new THREE.Box3(new THREE.Vector3(x-3.7,y+3.2,z-3),new THREE.Vector3(x+3.7,y+4.6,z+2.7)))
    part('rock',x,y+1.7,z-3.2,7.5,4.5,3.25,0x837867,'stone');collision(x,z-3.5,6.2,3.7,1.9,y)
    for(let j=0;j<4;j++)crate(j%2?6:-5,18-j*10,.69,j%2===0)
  }
  if(cfg.mountain)mountain();else street()
  // Protected distant heritage silhouette, well outside the playable enclosure.
  function heritage(){
    const x=-48+index*.65,z=-48,y=heightAt(x,z),stone=cfg.night?0xc8c4ae:0xeee2c4
    moveFrame(x,y,z,.19)
    part('box',0,1.7,0,8.2,3.4,6.8,stone,'stone')
    part('box',0,3.4,0,8.4,.19,7.0,0xe0d5ba)
    part('tank',0,4.28,0,4.46,1.65,4.46,stone)
    part('cone',0,7.43,0,5.10,5.0,5.10,stone)
    for(let k=0;k<22;k++){
      const a=k*Math.PI*2/22
      beam([Math.sin(a)*2.50,4.98,Math.cos(a)*2.50],[Math.sin(a)*.17,9.65,Math.cos(a)*.17],.112,0xf2e7cb,'stone')
    }
    part('rod',0,10.12,0,.08,.70,.08,0xb09b6b,'metal')
    part('round',0,10.47,0,.22,.28,.22,0xc4ae7a,'metal')
    moveFrame()
  }
  heritage()
  // Loose scree, fallen plaster and old pavers hug the edges of the walking surface.
  const rubbleCount=Math.round((cfg.mountain?90:72+cfg.damage*175)*(quality<1?.7:1))
  for(let i=0;i<rubbleCount;i++){
    const z=(rng()-.5)*65, side=rng()>.5?1:-1,x=side*(cfg.mountain?2.7+rng()*6.8:cfg.street-1.75+rng()*2.2)
    const size=.045+rng()*(cfg.damage>.6?.44:.32)
    part(i%4===1?'box':'rock',x,heightAt(x,z)+size*.20,z,size*(.8+rng()),size*(.27+rng()*.36),size*(.54+rng()),[0xc6b59c,0xafa18e,0xb09b85,0x9b9282][i%4],i%4===1?'plaster':'earth',rng()*.42,rng()*3,rng()*.24)
  }
  // Small working spaces connect the fictional families' stories to the scenery.
  function worktable(x:number,z:number,kind:'bread'|'copper'|'school'|'sewing'|'book'|'radio'){
    const y=heightAt(x,z)
    moveFrame(x,y,z,-.12)
    part('box',0,.83,0,1.65,.11,.77,0xa48c70,'bark')
    for(const a of [-1,1])for(const b of [-1,1])part('box',a*.70,.42,b*.28,.08,.84,.08,0x85715b,'bark')
    if(kind==='bread'){
      part('tank',0,.96,0,.84,.17,.60,0xa9875c,'bark')
      for(let j=0;j<6;j++)part('round',(j%3-1)*.22,1.06+Math.floor(j/3)*.02,(j<3?-.1:.1),.32,.13,.19,j%2?0xcc9b62:0xd7ad74,'earth',0,j*.2)
      part('box',.39,.90,-.06,.56,.035,.57,0x9b6b58,'cloth')
    }else if(kind==='copper'){
      for(let j=0;j<3;j++){
        const xx=-.46+j*.43
        part('round',xx,1.08,0,.36,.39,.36,0xb38260,'metal')
        part('tank',xx,1.27,0,.23,.09,.23,0xcf9c73,'metal')
        part('tank',xx,1.32,0,.27,.025,.27,0x9b6b53,'metal')
      }
    }else if(kind==='sewing'){
      part('box',-.16,.91,0,.68,.08,.39,0x726c60,'bark')
      part('tank',-.35,1.095,0,.27,.37,.17,0x485951,'metal')
      part('box',-.15,1.25,0,.58,.15,.19,0x47584e,'metal')
      part('rod',.10,1.11,0,.02,.15,.02,0xb9b8a6,'metal')
      for(let j=0;j<4;j++)part('rod',.37+(j%2)*.14,.98,(j<2?-.1:.1),.088,.18,.088,j%2?0x648b99:0x9f776c,'cloth')
      part('box',.48,.96,.08,.38,.16,.26,0x627f83,'metal')
      part('box',.48,1.06,.08,.40,.04,.27,0xabb0a0,'metal')
    }else if(kind==='radio'){
      part('box',-.12,1.08,.02,.65,.36,.23,0x706957,'metal')
      part('box',-.22,1.08,.15,.31,.24,.015,0x424c47,'metal')
      for(let j=0;j<4;j++)part('box',-.22,1.015+.04*j,.161,.29,.014,.012,0x929081,'metal')
      part('box',.108,1.08,.15,.22,.05,.02,0xada688,'glass')
      beam([.12,1.25,0],[.32,1.90,-.02],.016,0xc1b8a7)
    }else{
      for(let j=0;j<4;j++){
        const xx=-.49+j*.25
        part('box',xx,.918+j*.004,(j%2)*.09,.32,.05,.29,0x935f4e,'bark',0,j*.14)
        part('box',xx,.951+j*.004,(j%2)*.09,.30,.024,.27,0xddccb0,'cloth',0,j*.14)
      }
      part('rod',.55,.965,.06,.022,.32,.022,0xa38155,'bark',1.5,.5)
    }
    collision(x,z,1.68,.9,.80)
    moveFrame()
  }
  function bench(x:number,z:number){
    moveFrame(x,heightAt(x,z),z)
    for(let j=0;j<3;j++)part('box',0,.49,-.16+j*.16,1.53,.08,.14,0xac9274,'bark')
    for(const side of [-1,1]){
      part('box',side*.57,.23,.02,.11,.46,.34,0x6c685c,'metal')
      part('box',side*.57,.71,-.18,.065,.52,.065,0x6c685c,'metal')
    }
    part('box',0,.89,-.19,1.53,.26,.057,0x9f886d,'bark')
    collision(x,z,1.52,.96,.5);moveFrame()
  }
  function shade(x:number,z:number,cloth:number){
    const y=heightAt(x,z)
    moveFrame(x,y,z)
    for(const side of [-1,1])for(const end of [-1,1]){
      part('rod',side*1.12,1.14,end*.81,.065,2.28,.065,0x876f51,'bark')
      collision(x+side*1.12,z+end*.81,.1,2.4,.1,y)
    }
    for(const s of [-1,1])part('box',s*.59,2.39,0,1.28,.046,1.78,cloth,'cloth',0,0,-s*.13)
    moveFrame()
  }
  const g0=objectives[0],g1=objectives[1],g2=objectives[2]
  if(index===0){
    bench(g0[0]-2.1,g0[1]);worktable(g1[0]-1.6,g1[1],'bread')
    shade(g2[0]+2.3,g2[1],0x966751);worktable(g2[0]+2.3,g2[1],'copper')
  }else if(index===1){
    shade(g0[0]+2.1,g0[1],0xa58e6a);worktable(g0[0]+2.1,g0[1],'copper');bench(g2[0]-1.9,g2[1])
  }else if(index===2||index===6){
    worktable(g2[0]+1.9,g2[1],'school')
    moveFrame(g2[0]+2.28,heightAt(g2[0]+2.28,g2[1]),g2[1]-1, -.18)
    part('box',0,1.53,0,1.47,.94,.1,0x616c60,'bark')
    for(const side of [-1,1])part('box',side*.68,.95,0,.063,1.95,.15,0x9e876a,'bark')
    part('box',0,1.03,.035,1.53,.05,.2,0xb09573,'bark')
    sign(0,1.57,.065,1.25,.63,'مدرستنا','Dibistana me',true)
    moveFrame();bench(g1[0]-2.05,g1[1])
  }else if(index===3){
    shade(g2[0]+2.3,g2[1],0xb5a68b)
    moveFrame(g0[0]+1.80,heightAt(g0[0]+1.80,g0[1]),g0[1])
    for(let j=0;j<4;j++){
      const ax=(j%2)*.47,zz=(j<2?0:.42)
      part('round',ax,.32,zz,.43,.59,.43,0xae8f71,'earth')
      part('tank',ax,.62,zz,.19,.16,.19,0x997a61,'earth')
      part('rod',ax,.70,zz,.226,.039,.226,0xc0a185,'earth')
    }
    moveFrame()
  }else if(index===4){
    worktable(g2[0]+1.8,g2[1],'radio');bench(g2[0]+1.8,g2[1]+1.1)
  }else if(index===5){
    worktable(g0[0]+1.85,g0[1],'sewing');shade(g0[0]+1.85,g0[1],0xa3a38c)
    bench(g2[0]-2.1,g2[1])
  }else{
    worktable(g1[0]-1.75,g1[1],'book');bench(g1[0]-1.75,g1[1]+1.3)
    shade(g2[0]+2.15,g2[1],0xbd9b74);worktable(g2[0]+2.15,g2[1],'bread')
  }
  function shutter(x:number,z:number){
    moveFrame(x,heightAt(x,z),z,0)
    for(const sx of [-1,1]){
      part('box',sx*.79,1.14,-.02,.18,2.28,.28,0x958570,'stone')
      part('box',sx*.73,1.17,.045,.07,2.17,.08,0x665c4f,'metal')
    }
    part('box',0,2.24,-.04,1.79,.25,.32,0xa7967d,'stone')
    part('box',0,1.10,-.11,1.34,2.10,.09,0x635e50,'bark')
    localBlock(0,1.18,0,1.80,2.4,.33)
    const facade=buffers
    buffers=new Map();moveFrame()
    // The shutter rolls up around its top edge when the family opens the shop.
    for(let j=0;j<12;j++)part('box',0,-1.72+j*.14,-.002,1.34,.13,.10,j%3?0x84918a:0x8b958c,'metal',.07)
    part('box',0,-1.74,.094,.34,.05,.06,0x9c997f,'metal')
    rollingShutter=new THREE.Group()
    rollingShutter.position.set(x,heightAt(x,z)+2.12,z)
    group.add(rollingShutter);bake(buffers,rollingShutter);buffers=facade
  }
  function windowStation(x:number,z:number){
    moveFrame(x,heightAt(x,z),z,-.16)
    const blue=0x587a80, wall=0xcab79c
    part('box',0,.41,0,2.35,.82,.39,wall,'stone')
    part('box',0,2.21,0,2.35,.28,.39,wall,'stone')
    for(const side of [-1,1]){
      part('box',side*.93,1.44,0,.48,1.28,.39,wall)
      part('box',side*.63,1.44,.04,.09,1.27,.10,blue,'bark')
      part('box',side*.45,1.44,.18,.32,1.23,.060,blue,'bark',0,side*.42)
      for(let j=0;j<5;j++)part('box',side*.45,.96+j*.205,.22,.30,.034,.06,0x718b86,'bark',0,side*.42)
    }
    part('box',0,.84,.09,1.56,.10,.50,0xd1c4a9,'stone')
    localBlock(0,1.17,0,2.35,2.35,.43);moveFrame()
  }
  function rollingChair(x:number,z:number){
    moveFrame(x,heightAt(x,z),z,.3)
    for(const side of [-1,1]){
      part('ring',side*.37,.38,0,.78,.78,.92,0x4e504b,'metal',0,Math.PI/2)
      part('ring',side*.397,.38,0,.65,.65,.57,0x969588,'metal',0,Math.PI/2)
      for(let j=0;j<10;j++){const a=j*Math.PI/5;beam([side*.37,.38,0],[side*.37,.38+.33*Math.sin(a),.33*Math.cos(a)],.014,0xb4b1a3)}
      beam([side*.26,.25,.35],[side*.26,.96,-.27],.043,0x969a8c)
      part('rod',side*.26,.12,.36,.20,.069,.20,0x62635b,'metal',0,0,Math.PI/2)
      part('box',side*.285,.65,.012,.06,.056,.37,0x70746a,'metal')
    }
    part('box',0,.47,-.015,.51,.076,.47,0x687970,'cloth')
    part('box',0,.73,-.255,.51,.47,.045,0x69786e,'cloth',-.08)
    part('box',0,.16,.455,.40,.043,.20,0x707870,'metal')
    localBlock(0,.44,0,.82,.94,.96);moveFrame()
  }
  if(index===0){
    landmarks[1]=[g1[0]-1.6,g1[1]];landmarks[2]=[g2[0]+2.3,g2[1]-.80];shutter(...landmarks[2])
  }else if(index===2){
    landmarks[2]=[g2[0]+1.9,g2[1]]
  }else if(index===3){
    landmarks[0]=[g0[0]+1.80,g0[1]];landmarks[2]=[g2[0]+2.3,g2[1]]
  }else if(index===4){
    landmarks[0]=[g0[0]-1.57,g0[1]];landmarks[1]=[g1[0]-1.64,g1[1]]
    const [bx,bz]=landmarks[0]
    moveFrame(bx,heightAt(bx,bz),bz)
    part('box',0,.23,0,.80,.46,.61,0xa49275,'bark')
    part('box',0,.64,0,.43,.32,.29,0x5a655c,'metal')
    part('box',0,.82,0,.45,.055,.31,0x98927b,'metal')
    for(const a of [-1,1])part('rod',a*.14,.88,0,.064,.09,.064,0xb29575,'metal')
    beam([-.09,.83,.045],[-.09,.95,.045],.035,0x747569)
    beam([-.09,.95,.045],[.09,.95,.045],.035,0x747569)
    beam([.09,.95,.045],[.09,.83,.045],.035,0x747569)
    localBlock(0,.33,0,.81,.67,.62);moveFrame()
    const [lx,lz]=landmarks[1];lamp(lx,lz,1,false)
    collision(lx,lz,.18,4.6,.18)
    courtyardLamp=new THREE.Group()
    const lens=new THREE.Mesh(new THREE.BoxGeometry(.37,.065,.21),new THREE.MeshBasicMaterial({color:0xffe0a0}))
    lens.position.set(lx-.8,heightAt(lx,lz)+4.525,lz);register(lens,false,false);courtyardLamp.add(lens)
    const glow=new THREE.PointLight(0xffbe70,32,16,1.8);glow.position.copy(lens.position);glow.position.y-=.15
    courtyardLamp.add(glow);courtyardLamp.visible=false;group.add(courtyardLamp)
  }else if(index===5){
    landmarks[0]=[g0[0]+1.85,g0[1]];landmarks[1]=[g1[0]+1.4,g1[1]]
    rollingChair(...landmarks[1])
  }else if(index===6){
    landmarks[0]=[g0[0]-1.47,g0[1]];landmarks[2]=[g2[0]+1.84,g2[1]+1.1]
    const [xx,zz]=landmarks[0];moveFrame(xx,heightAt(xx,zz),zz)
    part('box',0,.44,0,.61,.87,.5,0x958168,'bark')
    part('box',0,.91,0,.66,.07,.53,0xa89778,'bark')
    part('box',0,.98,0,.25,.06,.20,0xb08a59,'metal')
    part('tank',0,1.06,0,.10,.12,.10,0xb38d60,'metal')
    part('round',0,1.14,0,.145,.13,.145,0x9b784f,'metal')
    localBlock(0,.46,0,.68,.92,.55);moveFrame();windowStation(...landmarks[2])
  }else if(index===7){
    landmarks[1]=[g1[0]-1.75,g1[1]];landmarks[2]=[g2[0]+2.15,g2[1]-.80];shutter(...landmarks[2])
  }
  const nicheX=optional[0]+Math.sign(optional[0])*1.18,nicheZ=optional[1]
  moveFrame(nicheX,heightAt(nicheX,nicheZ),nicheZ)
  // The low shelf stays in the scene after its personal keepsake is collected.
  part('box',0,.76,0,.84,.085,.51,0xa48f71,'bark')
  for(const s of [-1,1])part('box',s*.31,.35,0,.12,.71,.40,0x8b7a62,'bark')
  localBlock(0,.38,0,.85,.82,.52);moveFrame()
  if(index===0 || index===7){
    // A permanent ceramic mural in the family courtyard. The artwork has no damage state.
    const x=-cfg.street+.15,z=8.9,y=heightAt(x,z)
    moveFrame(x,y,z,Math.PI*.36)
    part('box',0,.14,0,3.43,.28,.84,0xb3a38b,'stone')
    part('box',0,1.26,0,3.08,2.37,.29,0xc7b392,'stone')
    part('box',0,2.47,0,3.29,.15,.45,0xd0bd9e,'stone')
    const tex=canvasTexture(512,c=>{
      c.fillStyle='#425b58';c.fillRect(0,0,512,512)
      c.strokeStyle='#a78b5a';c.lineWidth=7;c.strokeRect(12,12,488,488)
      c.lineWidth=2;c.strokeRect(23,23,466,466)
      // A fan of feather eyes frames a hand-painted peacock in profile.
      for(let ring=0;ring<2;ring++)for(let j=0;j<(ring?13:9);j++){
        const steps=ring?12:8,angle=-Math.PI*.96+Math.PI*.92*j/steps,radius=ring?164:118
        const fx=252+Math.cos(angle)*radius,fy=314+Math.sin(angle)*radius
        c.save();c.translate(fx,fy);c.rotate(angle+Math.PI/2)
        c.beginPath();c.ellipse(0,0,ring?17:21,ring?45:59,0,0,Math.PI*2)
        c.fillStyle=ring?'#818d6d':'#738975';c.fill();c.strokeStyle='#b69d69';c.lineWidth=2;c.stroke()
        c.fillStyle='#ad9a62';c.beginPath();c.ellipse(0,-15,11,15,0,0,Math.PI*2);c.fill()
        c.fillStyle='#43646b';c.beginPath();c.ellipse(0,-17,6,8,0,0,Math.PI*2);c.fill()
        c.restore()
      }
      c.fillStyle='#405c69';c.strokeStyle='#c6ac75';c.lineWidth=4
      c.beginPath();c.moveTo(172,319);c.bezierCurveTo(228,283,286,337,308,274);c.bezierCurveTo(319,246,301,220,324,209);c.bezierCurveTo(343,198,354,217,343,230);c.bezierCurveTo(319,240,342,270,323,311);c.bezierCurveTo(295,356,223,356,172,319);c.closePath();c.fill();c.stroke()
      c.fillStyle='#c5ab71';c.beginPath();c.moveTo(346,216);c.lineTo(368,222);c.lineTo(345,226);c.fill()
      c.beginPath();c.arc(338,215,2.6,0,Math.PI*2);c.fill()
      c.lineWidth=3
      for(let j=-1;j<=1;j++){c.beginPath();c.moveTo(327,208);c.lineTo(320+j*6,191-Math.abs(j)*2);c.stroke();c.beginPath();c.arc(320+j*6,190-Math.abs(j)*2,3,0,Math.PI*2);c.fill()}
      c.textAlign='center';c.direction='rtl';c.fillStyle='#decc9f';c.font='bold 39px serif';c.fillText('السلام لأرض شنكال',256,407,420)
      c.direction='ltr';c.font='21px serif';c.fillText('Aştî ji bo Şingalê',256,449)
      c.strokeStyle='rgba(49,51,43,.29)';c.lineWidth=1.5
      for(let j=0;j<=512;j+=32){c.beginPath();c.moveTo(j,0);c.lineTo(j,512);c.moveTo(0,j);c.lineTo(512,j);c.stroke()}
      for(let j=0;j<1600;j++){c.fillStyle=j%2?'rgba(236,218,178,.16)':'rgba(62,49,34,.10)';c.fillRect(rng()*512,rng()*512,rng()*2.5+1,rng()*2+1)}
    });textures.add(tex)
    const mural=new THREE.Mesh(new THREE.PlaneGeometry(2.74,1.96),new THREE.MeshStandardMaterial({map:tex,roughness:.74}))
    mural.position.set(0,1.31,.157).applyMatrix4(fMat);mural.rotation.y=frame.angle;register(mural)
    localBlock(0,1.25,0,3.30,2.54,.85);moveFrame()
  }
  foliage()
  const keepsake=new THREE.Group()
  keepsake.name='ذكرى عائلية'
  const worldBuffers=buffers
  buffers=new Map<string,BufferGroup>()
  keepsake.position.set(nicheX-optional[0],heightAt(nicheX,nicheZ)-heightAt(...optional)+.805,nicheZ-optional[1])
  if(index===0){
    part('ring',-.09,.048,0,.19,.20,.36,0xc2a679,'metal',Math.PI/2)
    beam([-.02,.035,0],[.21,.035,.044],.036,0xbba077)
    for(const xx of [.14,.20])beam([xx,.038,.036],[xx,.037,.093],.038,0xbba077)
    beam([-.16,.045,-.025],[-.25,.045,-.11],.025,0xae594b,'cloth');beam([-.25,.045,-.11],[-.34,.042,-.086],.024,0xb9604f,'cloth')
  }else if(index===1||index===3||index===4){
    const base=index===3?0x9c5e52:index===1?0x6b8880:0x9e8975
    for(let j=0;j<3;j++)part('box',(j-1)*.016,.036+j*.056,0,.62-j*.022,.072,.35-j*.018,base,'cloth')
    for(let j=0;j<5;j++)part('box',-.21+j*.10,.186,0,.026,.009,.32,0xc9b796,'cloth')
    for(let j=0;j<10;j++)part('box',-.26+j*.055,.125,.18,.022,.03,.084,0xbbac90,'cloth',.13)
  }else if(index===2||index===6){
    part('box',0,.024,0,.56,.045,.39,index===6?0x68878b:0xdcc9a3,index===6?'bark':'cloth')
    if(index===2){
      beam([-.15,.048,.07],[-.15,.048,-.04],.014,0x7b8b8c);beam([-.15,.048,-.04],[-.053,.048,-.12],.015,0xb37467)
      beam([-.053,.048,-.12],[.044,.048,-.04],.015,0xb37467);beam([.044,.048,-.04],[.044,.048,.07],.014,0x82938d)
      part('rod',.16,.049,-.081,.072,.008,.072,0xd0ad62,'cloth')
    }else{
      const boardTex=canvasTexture(128,c=>{c.fillStyle='#718784';c.fillRect(0,0,128,128);c.fillStyle='#e7d5aa';c.font='bold 38px serif';c.textAlign='center';c.fillText('صفّنا',64,78,110)})
      textures.add(boardTex)
      const board=new THREE.Mesh(new THREE.PlaneGeometry(.50,.35),new THREE.MeshStandardMaterial({map:boardTex,roughness:.94}))
      board.rotation.x=-Math.PI/2;board.position.y=.05;register(board);keepsake.add(board)
    }
  }else if(index===5){
    for(const s of [-1,1]){
      part('ring',s*.085,.034,-.10,.139,.152,.35,0xb48b61,'metal',Math.PI/2)
      beam([s*.069,.034,-.053],[-s*.105,.035,.17],.033,0xb7b4a2)
    }
    part('rod',0,.053,.022,.041,.025,.041,0xa17c54,'metal')
  }else{
    beam([-.27,.04,.12],[.27,.054,-.11],.021,0x888267,'bark')
    for(let j=0;j<7;j++){const u=j/7;for(const side of [-1,1])part('round',-.23+u*.46,.05+u*.015,.12-u*.19+side*.05,.12,.024,.058,side<0?0x879676:0x687e66,'foliage',0,side*.52)}
  }
  function bake(draw:Map<string,BufferGroup>,to:THREE.Group){
   for(const [key,b] of draw){
    const g=new THREE.BufferGeometry()
    g.setAttribute('position',new THREE.Float32BufferAttribute(b.pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.normal,3))
    g.setAttribute('color',new THREE.Float32BufferAttribute(b.color,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));g.setIndex(b.indices)
    g.computeBoundingSphere();const m=register(new THREE.Mesh(g,b.mat),!key.startsWith('earth')&&!key.startsWith('glass'))
    m.name=key
    if(to!==group)to.add(m)
   }
   draw.clear()
  }
  bake(worldBuffers,group);bake(buffers,keepsake);Object.values(sources).forEach(g=>g.dispose())
  const flags:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshStandardMaterial>[]=[]
  if(index===0||index===7){
    // Original sun banner for the family's peaceful gathering.
    const tex=canvasTexture(256,c=>{
      c.fillStyle='#e4ddbe';c.fillRect(0,0,256,256)
      c.fillStyle='#b3833d';c.beginPath()
      for(let j=0;j<42;j++){const a=j*Math.PI/21, r=j%2?35:63;c.lineTo(128+Math.cos(a)*r*.78,128+Math.sin(a)*r)}
      c.closePath();c.fill();c.beginPath();c.ellipse(128,128,20,27,0,0,Math.PI*2);c.fillStyle='#e5b457';c.fill()
      c.fillStyle='#8d5543';c.fillRect(0,9,256,7);c.fillRect(0,240,256,7)
    });textures.add(tex)
    const m=new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide,roughness:.98})
    const g=new THREE.PlaneGeometry(1.36,.74,10,4);g.translate(.68,0,0)
    const flag=new THREE.Mesh(g,m)
    flag.position.set(-cfg.street+.08,heightAt(-cfg.street,-20)+5.33,-20);flag.rotation.y=-.17;register(flag,true);flags.push(flag)
  }
  // Baked contact shading remains visible on devices that switch shadow maps off.
  const contactMap=canvasTexture(64,c=>{
    const gradient=c.createRadialGradient(32,32,1,32,32,32)
    gradient.addColorStop(0,'rgba(255,255,255,.96)');gradient.addColorStop(.55,'rgba(255,255,255,.73)');gradient.addColorStop(1,'rgba(255,255,255,0)')
    c.fillStyle=gradient;c.fillRect(0,0,64,64)
  });textures.add(contactMap)
  const groundContacts=blockers.filter(b=>b.getSize(point).x>.35 && b.getSize(point).z>.35 && b.min.y<heightAt((b.min.x+b.max.x)/2,(b.min.z+b.max.z)/2)+.2)
  const contactGeometry=new THREE.PlaneGeometry(1,1);contactGeometry.rotateX(-Math.PI/2)
  const contactMaterial=new THREE.MeshBasicMaterial({map:contactMap,color:0x393128,opacity:cfg.night?.21:.29,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})
  const contacts=new THREE.InstancedMesh(contactGeometry,contactMaterial,groundContacts.length)
  groundContacts.forEach((b,j)=>{
    b.getCenter(position);const x=position.x,z=position.z
    position.y=heightAt(x,z)+.045
    const dx=heightAt(x+.5,z)-heightAt(x-.5,z),dz=heightAt(x,z+.5)-heightAt(x,z-.5)
    rotation.setFromUnitVectors(up,norm.set(-dx,1,-dz).normalize())
    b.getSize(scale);scale.set(scale.x*1.43+.4,1,scale.z*1.43+.4)
    contacts.setMatrixAt(j,transform.compose(position,rotation,scale))
  })
  contacts.computeBoundingSphere();register(contacts,false,false)
  const particleTexture=canvasTexture(64,c=>{
    const gradient=c.createRadialGradient(32,32,0,32,32,32)
    gradient.addColorStop(0,'rgba(255,255,255,.90)');gradient.addColorStop(.22,'rgba(255,255,255,.63)');gradient.addColorStop(.70,'rgba(255,255,255,.13)');gradient.addColorStop(1,'rgba(255,255,255,0)')
    c.fillStyle=gradient;c.fillRect(0,0,64,64)
  });textures.add(particleTexture)
  const count=quality<1?36:quality>1?105:68, dustPositions=new Float32Array(count*3)
  for(let i=0;i<count;i++){dustPositions[i*3]=(rng()-.5)*55;dustPositions[i*3+1]=.25+rng()*8;dustPositions[i*3+2]=(rng()-.5)*59}
  const dustGeometry=new THREE.BufferGeometry(),dustAttribute=new THREE.BufferAttribute(dustPositions,3).setUsage(THREE.DynamicDrawUsage)
  dustGeometry.setAttribute('position',dustAttribute);dustGeometry.computeBoundingSphere()
  const dustMat=new THREE.PointsMaterial({map:particleTexture,color:cfg.night?0xe2ca99:0xe4cb9e,size:cfg.night?.073:.085,opacity:cfg.night?.58:.37,transparent:true,depthWrite:false})
  group.add(new THREE.Points(dustGeometry,dustMat));materials.add(dustMat);geometrySet.add(dustGeometry)
  const haze:THREE.Sprite[]=[]
  if(cfg.damage>.42){
    const smokeMat=new THREE.SpriteMaterial({map:particleTexture,color:cfg.night?0x7a7980:0x8c8278,opacity:.12,depthWrite:false,transparent:true})
    materials.add(smokeMat)
    for(let j=0;j<(quality===0?5:10);j++){
      const puff=new THREE.Sprite(smokeMat);puff.position.set(19+j*.50,5.6+j*.62,-29.5)
      puff.scale.setScalar(3.4+j*.39);group.add(puff);haze.push(puff)
    }
  }
  let lastParticle=0
  const setStage=(stage:number)=>{
    completedGoals=stage
    if(courtyardLamp)courtyardLamp.visible=stage>=2
  }
  const update=(t:number,dt:number)=>{
    if(rollingShutter)rollingShutter.scale.y=THREE.MathUtils.damp(rollingShutter.scale.y,completedGoals>=3?.04:1,4,dt)
    for(const flag of flags){
      const p=flag.geometry.attributes.position
      for(let i=0;i<p.count;i++){const u=p.getX(i)/1.36;p.setZ(i,u*(.105*Math.sin(u*8-t*3.6)+.053*Math.sin(u*14+p.getY(i)*3-t*3)))}
      p.needsUpdate=true
    }
    lastParticle+=dt
    if(lastParticle>.065){
      const elapsed=Math.min(lastParticle,.2);lastParticle=0
      for(let i=0;i<count;i++){
        const ix=i*3
        dustPositions[ix]+=elapsed*(.35+cfg.weather*.45)
        dustPositions[ix+1]+=Math.sin(t*.5+i)*elapsed*.05
        if(dustPositions[ix]>29)dustPositions[ix]=-29
      }
      dustAttribute.needsUpdate=true
      haze.forEach((p,j)=>{
        const u=(j*.104+t*.037)%1
        p.position.set(19+u*5.+Math.sin(u*6)*.42,5.6+u*7.6,-29.5+u*.75)
        p.scale.setScalar(3.5+u*4.3)
      })
    }
  }
  const dispose=()=>{
    for(const item of group.children)if(item instanceof THREE.InstancedMesh)item.dispose()
    geometrySet.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.clear()
  }
  return {group, blockers, heightAt, spawn, objectives, landmarks, optional, keepsake, encounters, bounds, sky:cfg.sky, fog:cfg.fog, sunlight:cfg.sunlight, night:!!cfg.night,setStage,update,dispose}
}
