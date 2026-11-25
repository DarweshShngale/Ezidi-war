export const SAVE_KEY = 'shingal.resistance.profile.v1';
export const actions = {up:'تقدّم',down:'تراجع',left:'يسار',right:'يمين',sprint:'ركض سريع',jump:'قفز / تسلّق',crouch:'انحناء',interact:'تفاعل',reload:'تلقيم',heal:'إسعاف',weapon:'تبديل السلاح'} as const;
export type Action = keyof typeof actions;
export const defaultKeys: Record<Action,string> = {up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',sprint:'ShiftLeft',jump:'Space',crouch:'KeyC',interact:'KeyE',reload:'KeyR',heal:'KeyH',weapon:'Digit2'};
export type Prefs = {difficulty:number,quality:number,sensitivity:number,touchSensitivity:number,music:number,dialogue:number,effects:number,vibrate:boolean,keys:Record<Action,string>,buttons:Record<string,[number,number]>,muted:boolean};
export type Run = {index:number,stage:number,x:number,z:number,yaw:number,health:number,ammo:number,reserve:number,tool:number,kits:number,optional:boolean,rescues:number,seconds:number,shots:number,defeated:number[],supplies:number[]};
export type Result = {seconds:number,optional:boolean,rescues:number,shots:number};
export type Profile = {version:1,prefs:Prefs,run:Run|null,results:Record<number,Result>};
export const finite = (n:unknown, fallback:number, lo:number, hi:number) => typeof n==='number' && Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):fallback;
const rangeInt=(n:unknown,f:number,l:number,h:number)=>Math.floor(finite(n,f,l,h));
export function recommendedQuality(cores:number,ram:number,pixelRatio:number){return cores<=4||ram<=3?0:cores<=6||ram<=4||pixelRatio>2?1:cores>=12&&ram>=8?3:2}
export function newProfile(quality=1):Profile{return {version:1,prefs:{difficulty:1,quality,sensitivity:1,touchSensitivity:1,music:.45,dialogue:.85,effects:.75,vibrate:true,keys:{...defaultKeys},buttons:{},muted:false},run:null,results:{}}}
export function newRun(index:number,x:number,z:number):Run{return {index,stage:0,x,z,yaw:0,health:100,ammo:12,reserve:60,tool:0,kits:2,optional:false,rescues:0,seconds:0,shots:0,defeated:[],supplies:[]}}
export function unlocked(p:Profile){let n=0;while(n<7&&p.results[n])n++;return n}
export function xp(p:Profile){return Object.values(p.results).reduce((a,r)=>a+100+r.rescues*25+(r.optional?50:0),0)}
export function finish(p:Profile,r:Run){const old=p.results[r.index];p.results[r.index]={seconds:Math.min(old?.seconds??Infinity,r.seconds),optional:r.optional||!!old?.optional,rescues:Math.max(r.rescues,old?.rescues??0),shots:r.shots};p.run=null}
export function restore(raw:string|null,quality:number):Profile{
 const p=newProfile(quality);if(!raw)return p;
 try{
 const v=JSON.parse(raw);if(v?.version!==1)return p;
 const s=v.prefs??{};const out=p.prefs;
 out.difficulty=rangeInt(s.difficulty,1,0,2);out.quality=rangeInt(s.quality,quality,0,3);
 for(const k of ['music','dialogue','effects'] as const)out[k]=finite(s[k],out[k],0,1);
 for(const k of ['sensitivity','touchSensitivity'] as const)out[k]=finite(s[k],1,.3,2.5);
 for(const k of ['vibrate','muted'] as const)if(typeof s[k]==='boolean')out[k]=s[k];
 for(const k of Object.keys(defaultKeys) as Action[])if(typeof s.keys?.[k]==='string'&&/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Control(Left|Right)|Space|Enter|Backspace|Alt(Left|Right))$/.test(s.keys[k]))out.keys[k]=s.keys[k];
 for(const [k,pos] of Object.entries(s.buttons??{}))if(Array.isArray(pos)&&pos.length===2)out.buttons[k]=[finite(pos[0],50,4,96),finite(pos[1],60,8,92)];
 for(let i=0;i<8;i++){const a=v.results?.[i];if(!a||!Number.isFinite(a.seconds))break;p.results[i]={seconds:finite(a.seconds,0,0,1e7),rescues:rangeInt(a.rescues,0,0,3),shots:rangeInt(a.shots,0,0,1e6),optional:a.optional===true}}
 const r=v.run;if(r&&Number.isInteger(r.index)&&r.index>=0&&r.index<=unlocked(p)&&Number.isFinite(r.x)&&Number.isFinite(r.z)){
 const n=newRun(r.index,finite(r.x,0,-500,500),finite(r.z,0,-500,500));n.yaw=finite(r.yaw,0,-1e9,1e9);n.stage=rangeInt(r.stage,0,0,2);n.health=finite(r.health,100,1,100);n.ammo=rangeInt(r.ammo,12,0,24);n.reserve=rangeInt(r.reserve,60,0,240);n.kits=rangeInt(r.kits,2,0,9);n.tool=rangeInt(r.tool,0,0,1);n.optional=r.optional===true;n.rescues=rangeInt(r.rescues,0,0,3);n.seconds=finite(r.seconds,0,0,1e7);n.shots=rangeInt(r.shots,0,0,1e6);for(const k of ['defeated','supplies'] as const)if(Array.isArray(r[k]))n[k]=[...new Set<number>(r[k].filter((i:unknown)=>typeof i==='number'&&Number.isInteger(i)&&i>=0&&i<64))];p.run=n}
 }catch{/* A corrupt or incompatible record starts a new local profile. */}return p;
}
