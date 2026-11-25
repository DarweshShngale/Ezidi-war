import * as T from 'three';
import {buildWorld} from './world';
import {createActor} from './actors';
import {missions} from './story';
import {Sound} from './sound';
import {newRun,type Run,type Prefs} from './profile';
import {blocked,slide,clipSegment,dist,steer} from './physics';

type Character=ReturnType<typeof createActor>;
type World=ReturnType<typeof buildWorld>;
type Npc={actor:Character,id:number,home:[number,number],hp:number,state:'idle'|'patrol'|'alert'|'retreat'|'surrender',timer:number,fire:number,hit:number,pace:number};
type Hooks={save:(r:Run)=>void,finish:(r:Run)=>void,fail:()=>void,notify:(s:string)=>void,line:(s:string)=>void,hud:(g:Game)=>void};
const clamp=T.MathUtils.clamp;
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const capacities=[12,6];
export class Game{
 renderer:T.WebGLRenderer; scene=new T.Scene();camera=new T.PerspectiveCamera(52,1,.12,450);world:World;hero:Character;run:Run;
 stageProp=new T.Group(); optionalProp=new T.Group(); pickups:T.Group[]=[];goalPerson?:Character;people:Character[]=[];enemies:Npc[]=[];
 held=new Set<string>();stride=0;joy={x:0,y:0};pitch=.08;aim=false;crouch=false;fireHeld=false;touchSprint=false;active=false;intro=true;
 vertical=0;alt=0;standing=0;climbing=false;cooldown=0;reloadTime=0;flash=0;hurt=0;gesture=0;elapsed=0;fps=0;pressure=0;hudClock=0;lastAi=0;frameSample=0;frames=0;slow=0;near='';nearIndex=-1;nextLine=22;fpsSamples:number[]=[];
 private light:T.DirectionalLight;private cameraReady=false;private heroAngle=0;private cinematic=0;
 private fxPool:{mesh:T.Mesh,t:number,total:number,vel:T.Vector3}[]=[];private fxCursor=0;private disposable:(T.Material|T.BufferGeometry)[]=[];private opts:Prefs;private callback:Hooks;private sound:Sound;
 private marker=V();
 constructor(canvas:HTMLCanvasElement,index:number,previous:Run|null,prefs:Prefs,sound:Sound,hooks:Hooks){
  this.opts=prefs;this.sound=sound;this.callback=hooks;this.renderer=new T.WebGLRenderer({canvas,antialias:prefs.quality>=2,powerPreference:'high-performance',alpha:false});
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;
  this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.setClearColor(0x95a6a4);
  this.world=buildWorld(index,prefs.quality);this.scene.add(this.world.group);const w=this.world;
  this.scene.background=new T.Color(w.sky);this.scene.fog=new T.FogExp2(w.fog,w.night?.011:.0058);
  this.scene.add(new T.HemisphereLight(w.night?0xadbee3:0xf8f0da,w.night?0x474451:0x82735f,w.night?1.6:2.1));
  this.light=new T.DirectionalLight(w.sunlight,w.night?1.15:2.4);this.light.position.set(-34,46,-42);this.light.castShadow=true;
  const sh=this.light.shadow;sh.camera.left=sh.camera.bottom=-26;sh.camera.right=sh.camera.top=26;sh.camera.near=1;sh.camera.far=135;sh.bias=-.00055;sh.normalBias=.035;
  this.scene.add(this.light,this.light.target);this.quality();
  this.run=previous?structuredClone(previous):newRun(index,...w.spawn);this.hero=createActor('hero');this.scene.add(this.hero.group);
  if(blocked(this.run.x,w.heightAt(this.run.x,this.run.z),this.run.z,.34,w.blockers)){[this.run.x,this.run.z]=w.spawn}
  this.heroAngle=this.run.yaw;this.standing=w.heightAt(this.run.x,this.run.z);
  this.scene.add(this.stageProp,this.optionalProp);this.setGoal();this.optionalProp.add(w.keepsake);
  this.locate(this.optionalProp,...w.optional);this.optionalProp.visible=!this.run.optional;
  for(let i=0;i<2;i++){const base=i===0?w.spawn:w.objectives[1];const pos=this.freeSpot(base[0]+2.1,base[1]+1.5);
   const p=new T.Group();this.addKit(p);this.locate(p,...pos);p.visible=!this.run.supplies.includes(i);this.scene.add(p);this.pickups.push(p)}
  const count=index===0?0:Math.min(w.encounters.length,1+Math.floor((index+1)/2));
  for(let i=0;i<count;i++){if(this.run.defeated.includes(i))continue;const a=createActor('hostile',i);this.locate(a.group,...w.encounters[i]);this.scene.add(a.group);this.enemies.push({actor:a,id:i,home:w.encounters[i],hp:2+(index>5?1:0),state:'idle',timer:2+i*.7,fire:0,hit:0,pace:0})}
  const near=w.spawn;for(let i=0;i<(index===0?2:1);i++){const a=createActor('civilian',index+i+1);let [x,z]=this.freeSpot(near[0]+(i?3:-2.6),near[1]-1.5);this.locate(a.group,x,z);a.group.rotation.y=i?2:-1;this.scene.add(a.group);this.people.push(a)}
  const geo=new T.IcosahedronGeometry(.07,0),material=new T.MeshBasicMaterial({color:0xfcce82});this.disposable.push(geo,material);
  for(let i=0;i<22;i++){const mesh=new T.Mesh(geo,material);mesh.visible=false;this.scene.add(mesh);this.fxPool.push({mesh,t:0,total:0,vel:V()})}
  this.resize();this.tick(0);
 }
 private locate(o:T.Object3D,x:number,z:number){o.position.set(x,this.world.heightAt(x,z),z)}
 private freeSpot(x:number,z:number):[number,number]{for(let radius=0;radius<5;radius+=.6)for(let a=0;a<6.28;a+=.7){const xx=x+Math.sin(a)*radius,zz=z+Math.cos(a)*radius;if(!blocked(xx,this.world.heightAt(xx,zz),zz,.42,this.world.blockers))return [xx,zz]}return [...this.world.spawn]}
 private addKit(parent:T.Group){
  const mat=new T.MeshStandardMaterial({color:0x648477,roughness:.83}),trim=new T.MeshStandardMaterial({color:0x463a2b,roughness:.68});
  this.disposable.push(mat,trim);
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>{const geo=new T.BoxGeometry(w,h,d);this.disposable.push(geo);const mesh=new T.Mesh(geo,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh)};
  box(0,.19,0,.58,.36,.38,mat);box(0,.38,0,.48,.04,.31,trim);box(0,.2,-.20,.25,.045,.02,trim);box(0,.2,-.21,.05,.21,.02,trim);
 }
 private setGoal(){
  this.world.setStage(this.run.stage);
  if(this.goalPerson){this.stageProp.remove(this.goalPerson.group);this.goalPerson.dispose();this.goalPerson=undefined}
  this.stageProp.clear();const g=missions[this.run.index].goals[this.run.stage];this.locate(this.stageProp,...this.world.objectives[this.run.stage]);
  if(['talk','rescue','shelter'].includes(g.kind)){this.goalPerson=createActor('civilian',this.run.index+this.run.stage);this.goalPerson.group.rotation.y=Math.PI;this.stageProp.add(this.goalPerson.group)}

 }
 quality(){const q=this.opts.quality;this.renderer.setPixelRatio(Math.min(devicePixelRatio,[.8,1.1,1.55,2][q]));this.renderer.shadowMap.enabled=q>0;
  this.light.shadow.mapSize.setScalar(q>=3?2048:1024);this.light.shadow.map?.dispose();this.light.shadow.map=null;this.renderer.toneMappingExposure=this.world.night?1.12:1.0}
 resize(){const width=innerWidth,height=innerHeight;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix()}
 look(dx:number,dy:number,touch=false){if(!this.active)return;const s=(touch?this.opts.touchSensitivity:this.opts.sensitivity)*.003;this.run.yaw-=dx*s;this.pitch=clamp(this.pitch+dy*s,-.68,.95)}
 start(){this.intro=false;this.active=true;this.release();this.cameraReady=false;this.callback.save(this.run)}
 release(){this.held.clear();this.joy={x:0,y:0};this.aim=false;this.fireHeld=false;this.touchSprint=false}
 action(name:string){
  if(!this.active)return;
  const r=this.run;if(name==='reload'&&!this.reloadTime&&r.ammo<capacities[r.tool]&&r.reserve>0){this.reloadTime=1.55;this.sound.fx('reload')}
  if(name==='crouch')this.crouch=!this.crouch;
  if(name==='jump'&&this.alt<=.01){this.vertical=5.5;this.alt=.015;this.climbing=false;const nx=r.x-Math.sin(r.yaw)*.78,nz=r.z-Math.cos(r.yaw)*.78;
   const floor=this.world.heightAt(r.x,r.z);const step=this.world.blockers.find(b=>nx>=b.min.x-.1&&nx<=b.max.x+.1&&nz>=b.min.z-.1&&nz<=b.max.z+.1&&b.max.y>this.standing+.24&&b.max.y-floor<1.35);
   if(step){this.vertical=6.25;this.climbing=true}}
  if(name==='heal'&&r.kits&&r.health<100){r.kits--;r.health=Math.min(100,r.health+50);this.sound.fx('pick');this.callback.notify('استُخدمت حقيبة الإسعاف');this.callback.save(r)}
  if(name==='weapon'&&r.index>0){const old=r.ammo;r.tool=1-r.tool;r.reserve+=old;r.ammo=Math.min(capacities[r.tool],r.reserve);r.reserve-=r.ammo;this.reloadTime=0;this.callback.notify(r.tool?'مطلق النبض':'بندقية الحارس')}
  if(name==='interact')this.interact();
 }
 private sense(){const r=this.run,d=(p:T.Object3D)=>dist(r.x,r.z,p.position.x,p.position.z);
 this.near='';this.nearIndex=-1;if(d(this.stageProp)<2.7){this.near='goal';return}if(this.optionalProp.visible&&d(this.optionalProp)<2.5){this.near='optional';return}
 this.nearIndex=this.pickups.findIndex(p=>p.visible&&d(p)<2);if(this.nearIndex>=0)this.near='kit';
 }
 private interact(){
  this.sense();const r=this.run,m=missions[r.index];this.gesture=1;
  if(this.near==='optional'){r.optional=true;this.optionalProp.visible=false;this.callback.line(m.memory);this.sound.fx('pick');this.callback.notify('عُثر على ذكرى عائلية');this.callback.save(r)}
  if(this.near==='kit'){this.pickups[this.nearIndex].visible=false;r.supplies.push(this.nearIndex);r.kits=Math.min(9,r.kits+1);r.reserve=Math.min(240,r.reserve+18);this.sound.fx('pick');this.callback.notify('جُمعت مؤن وإسعافات');this.callback.save(r)}
  if(this.near==='goal'){const g=m.goals[r.stage];if(g.kind==='rescue'||g.kind==='shelter'){r.rescues++;this.callback.notify('تم إنقاذ المدنيين')}
   this.callback.line(g.line);this.sound.fx('rescue');r.stage++;
   if(r.stage===3){this.world.setStage(3);this.active=false;this.release();this.callback.finish(structuredClone(r));return}
   this.setGoal();this.callback.save(r);this.callback.notify('نقطة حفظ جديدة')}
  this.sense()
 }
 private sparks(p:T.Vector3,count:number){for(let i=0;i<count;i++){const o=this.fxPool[this.fxCursor++%this.fxPool.length];o.t=o.total=.18+Math.random()*.23;o.mesh.position.copy(p);o.mesh.scale.setScalar(.5+Math.random());o.mesh.visible=true;o.vel.set((Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3)}}
 private shoot(){
  if(this.run.index===0||this.reloadTime||this.cooldown)return;const r=this.run;
  if(!r.ammo){this.action('reload');this.cooldown=.3;return}
  this.cooldown=r.tool?.65:.23;this.flash=.15;r.ammo--;r.shots++;this.sound.fx('shot');
  if(this.opts.vibrate&&matchMedia('(pointer:coarse)').matches)navigator.vibrate?.(20);
  const start=this.camera.position,dir=this.camera.getWorldDirection(V()),far=start.clone().addScaledVector(dir,86);let best=86*clipSegment(start,far,this.world.blockers,0);let target:Npc|undefined;
  const intersection=(group:T.Object3D)=>{const pt=group.getWorldPosition(V()).add(V(0,1.12,0)),delta=pt.sub(start),d=delta.dot(dir);return d>0&&delta.addScaledVector(dir,-d).length()<(r.tool?.88:.68)?d:Infinity};
  // Civilian silhouettes absorb the effect; only active hostile entities can take damage.
  for(const c of [...this.people,...(this.goalPerson?[this.goalPerson]:[])])best=Math.min(best,intersection(c.group));
  for(const n of this.enemies){if(n.state==='surrender')continue;const d=intersection(n.actor.group);if(d<best){best=d;target=n}}
  this.sparks(start.clone().addScaledVector(dir,best),target?6:3);
  if(target){target.hp-=r.tool?2:1;target.hit=.32;target.state=target.hp<=0?'surrender':'retreat';target.timer=2.2;if(target.hp<=0){r.defeated.push(target.id);target.pace=0;this.callback.notify('استسلم الخصم')}}
  for(const n of this.enemies)if(n.state==='idle'||n.state==='patrol'){n.state='alert';n.timer=.9}
 }
 private ai(dt:number){const r=this.run;
 for(const n of this.enemies){const p=n.actor.group.position;if(n.state==='surrender')continue;n.timer-=dt;
  const d=dist(p.x,p.z,r.x,r.z);const eye=V(p.x,p.y+1.4,p.z),to=V(r.x,this.standing+(this.crouch?.84:1.45),r.z);
  const visible=d<(this.crouch?12:19)+r.index*.45&&clipSegment(eye,to,this.world.blockers,.025)>.98;
  if(n.state==='retreat'&&n.timer<=0){n.state='patrol';n.timer=1.8}
  if(n.state!=='retreat'&&visible&&n.state!=='alert'){n.state='alert';n.timer=[2.9,2.1,1.45][this.opts.difficulty]}
  if(n.state==='alert'&&!visible){n.state='patrol';n.timer=1.75}
  if(n.state==='idle'&&n.timer<=0){n.state='patrol';n.timer=3}
  let tx=n.home[0]+Math.sin(this.elapsed*.22+n.id)*3,tz=n.home[1]+Math.cos(this.elapsed*.18+n.id)*2.7;
  n.pace=n.state==='patrol'?.74:0;
  if(n.state==='retreat'){tx=p.x+(p.x-r.x);tz=p.z+(p.z-r.z);n.pace=2.15}
  if(n.state==='alert'){tx=r.x;tz=r.z;n.pace=d>9?1.16:0;n.actor.group.rotation.y=Math.atan2(p.x-r.x,p.z-r.z);
   if(n.timer<=0){n.fire=.19;n.timer=[3.4,2.8,2.25][this.opts.difficulty]+Math.random();this.sound.fx('shot',clamp((p.x-r.x)/15,-.9,.9));
   const chance=[.32,.47,.63][this.opts.difficulty]*(this.crouch?.57:1)*(this.stride>4?.65:1);
   if(Math.random()<chance){r.health=Math.max(0,r.health-([7,10,13][this.opts.difficulty]+Math.floor(r.index/3)));this.hurt=.35;this.sound.fx('hit');if(!r.health){this.active=false;this.release();this.callback.fail();return}}}}
  if(n.pace){const [dx,dz]=steer(p.x,p.z,tx,tz,p.y,this.world.blockers,n.id%2?1:-1);const [x,z]=slide(p.x,p.z,dx*n.pace*dt,dz*n.pace*dt,p.y,this.world.bounds,this.world.blockers);this.locate(n.actor.group,x,z);if(n.state!=='alert')n.actor.group.rotation.y=Math.atan2(-dx,-dz)}
 }}
 private updatePlayer(dt:number){
  const r=this.run,k=this.opts.keys,h=this.held,w=this.world;let x=+h.has(k.right)-+h.has(k.left)+this.joy.x,z=+h.has(k.up)-+h.has(k.down)-this.joy.y;const len=Math.hypot(x,z);if(len>1){x/=len;z/=len}
  const sprint=(h.has(k.sprint)||this.touchSprint)&&!this.crouch&&!this.aim;this.stride=(sprint?6.35:this.crouch?1.65:this.aim?2.1:3.65)*Math.min(1,len);
  const sin=Math.sin(r.yaw),cos=Math.cos(r.yaw),speed=(sprint?6.35:this.crouch?1.65:this.aim?2.1:3.65);
  const dx=(x*cos-z*sin)*speed*dt,dz=(-x*sin-z*cos)*speed*dt;
  if(len>.02||this.climbing){[r.x,r.z]=slide(r.x,r.z,dx-(this.climbing?sin*1.9*dt:0),dz-(this.climbing?cos*1.9*dt:0),this.standing,w.bounds,w.blockers)}
  const ground=w.heightAt(r.x,r.z);let surface=ground;
  for(const b of w.blockers)if(b.max.y<=this.standing+.15&&b.max.y>surface&&r.x>b.min.x-.02&&r.x<b.max.x+.02&&r.z>b.min.z-.02&&r.z<b.max.z+.02)surface=b.max.y;
  if(this.alt||this.vertical||this.standing>surface+.1){this.vertical-=13.6*dt;this.standing+=this.vertical*dt;this.alt=Math.max(0,this.standing-surface);if(this.standing<=surface){this.standing=surface;this.vertical=0;this.alt=0;this.climbing=false}}
  else this.standing=surface;
  const target=this.aim||this.fireHeld?r.yaw:len>.02?Math.atan2(-dx,-dz):this.heroAngle;
  this.heroAngle+=Math.atan2(Math.sin(target-this.heroAngle),Math.cos(target-this.heroAngle))*(1-Math.exp(-13*dt));
  this.cooldown=Math.max(0,this.cooldown-dt);this.flash=Math.max(0,this.flash-dt);this.hurt=Math.max(0,this.hurt-dt);this.gesture=Math.max(0,this.gesture-dt);
  if(this.reloadTime){this.reloadTime=Math.max(0,this.reloadTime-dt);if(!this.reloadTime){const qty=Math.min(capacities[r.tool]-r.ammo,r.reserve);r.ammo+=qty;r.reserve-=qty}}
  if(this.fireHeld)this.shoot();this.pressure+=this.stride*dt;if(this.pressure>2.05&&!this.alt){this.sound.fx(r.index===3?'rock':'step');this.pressure=0}
  this.lastAi+=dt;if(this.lastAi>=.1){this.ai(this.lastAi);this.lastAi=0}this.sense();
  if(this.near!==''||r.stage>0)this.nextLine=Infinity;else if(r.seconds>this.nextLine){this.callback.line(missions[r.index].dialogue[0]);this.nextLine=Infinity}
 }
 private setCamera(dt:number){const r=this.run;const anchor=V(r.x,this.standing+(this.crouch?1.12:1.67),r.z);
  const y=r.yaw+(this.intro?.22*Math.cos(this.cinematic*.28):0),back=this.aim?2.08:this.intro?5.0:3.65,side=this.aim?.52:.64;
  const fwd=V(-Math.sin(y)*Math.cos(this.pitch),-Math.sin(this.pitch),-Math.cos(y)*Math.cos(this.pitch));
  const offset=V(Math.cos(y)*side,0,-Math.sin(y)*side);
  const wanted=anchor.clone().addScaledVector(fwd,-back).add(offset);wanted.y+=this.aim?.06:.39;
  const camera=this.camera,dtMix=1-Math.exp(-14*dt);
  const candidate=this.cameraReady?camera.position.clone().lerp(wanted,dtMix):wanted;
  const length=clipSegment(anchor,candidate,this.world.blockers,.23);camera.position.copy(anchor).lerp(candidate,length);camera.position.y=Math.max(camera.position.y,this.world.heightAt(camera.position.x,camera.position.z)+.24);
  camera.lookAt(anchor.clone().add(offset).addScaledVector(fwd,15));this.cameraReady=true;
  const fov=this.aim?39:55;if(Math.abs(camera.fov-fov)>.03){camera.fov+=(fov-camera.fov)*dtMix;camera.updateProjectionMatrix()}
 }
 tick(delta:number){const dt=Math.max(0,Math.min(.075,delta));this.elapsed+=dt;this.cinematic+=dt;
  if(this.active){this.run.seconds+=delta;this.updatePlayer(dt)}
  if(this.run.stage>=3)return;
  const p=this.hero.group.position,r=this.run;p.set(r.x,this.standing,r.z);this.hero.group.rotation.y=this.heroAngle;
  this.hero.update(dt,{speed:this.active?this.stride:0,sprint:this.stride>4,crouch:this.crouch,aim:this.aim,fire:this.flash*6,reload:this.reloadTime?Math.sin(this.reloadTime/1.55*Math.PI):0,hit:this.hurt*2,interact:this.gesture,jump:Math.min(1,this.alt),climb:this.climbing});
  this.goalPerson?.update(dt,{speed:0,interact:this.gesture});for(const a of this.people)a.update(dt,{speed:0});
  for(const n of this.enemies){n.fire=Math.max(0,n.fire-dt);n.hit=Math.max(0,n.hit-dt);n.actor.update(dt,{speed:this.active?n.pace:0,aim:n.state==='alert',fire:n.fire*5,hit:n.hit*3,surrender:n.state==='surrender'})}
  for(const fx of this.fxPool)if(fx.t>0){fx.t-=dt;fx.vel.y-=5*dt;fx.mesh.position.addScaledVector(fx.vel,dt);fx.mesh.visible=fx.t>0}
  this.light.target.position.set(r.x,0,r.z);this.light.position.set(r.x-34+Math.sin(this.elapsed/90)*2,46,r.z-42);
  this.setCamera(dt);this.world.update(this.elapsed,dt);this.renderer.render(this.scene,this.camera);
  this.frames++;this.frameSample+=delta;if(this.frameSample>=1){this.fps=this.frames/this.frameSample;this.frames=0;this.frameSample=0;if(this.active){this.fpsSamples.push(this.fps);if(this.fpsSamples.length>90)this.fpsSamples.shift();this.slow=this.fps<26?this.slow+1:0;
   if(this.slow>=3&&this.renderer.getPixelRatio()>.56){this.renderer.setPixelRatio(Math.max(.55,this.renderer.getPixelRatio()*.85));this.slow=0}}}
  this.hudClock+=dt;if(this.hudClock>.065&&this.active){this.hudClock=0;this.callback.hud(this)}
 }
 goalScreen(){const [x,z]=this.world.landmarks[this.run.stage];this.marker.set(x,this.world.heightAt(x,z)+(this.goalPerson?2.45:1.85),z);this.marker.project(this.camera);return this.marker}
 dispose(){this.release();this.active=false;this.hero.dispose();this.goalPerson?.dispose();this.people.forEach(a=>a.dispose());this.enemies.forEach(n=>n.actor.dispose());this.world.dispose();this.disposable.forEach(a=>a.dispose());this.light.dispose();this.scene.clear();this.renderer.dispose();this.renderer.forceContextLoss()}
}
