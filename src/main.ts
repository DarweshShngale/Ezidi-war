import './style.css';
import {titleScene} from './artwork';
import {missions} from './story';
import {Sound} from './sound';
import {SAVE_KEY,actions,defaultKeys,recommendedQuality,unlocked,finish,restore,type Action,type Run} from './profile';
import {home,shell,btn,ico,art,ar,keyName,chapters,briefing,help,settings,about,achievementPanel} from './menu';
import {hudShell,hudUpdate} from './hud';
import {touchControls} from './touch';
import type {Game} from './game';
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const root=$('#app');root.innerHTML='<div id="backdrop"></div><canvas id="title-stage" aria-hidden="true"></canvas><div class="shade"></div><section id="home"></section><canvas id="game-stage" tabindex="-1" aria-label="مشهد اللعب ثلاثي الأبعاد"></canvas><div id="hud"></div><div id="touch"></div><div id="overlay"></div>';
const rec=recommendedQuality(navigator.hardwareConcurrency||4,(navigator as Navigator&{deviceMemory?:number}).deviceMemory??4,devicePixelRatio);
let stored:string|null=null;try{stored=localStorage.getItem(SAVE_KEY)}catch{}
const p=restore(stored,rec);const sound=new Sound();sound.setLevels(p.prefs.music,p.prefs.dialogue,p.prefs.effects);sound.setMuted(p.prefs.muted);
let game:Game|undefined,view='home',tab='display',binding:Action|''='',editor=false,panelFrom='home',pending=0,chapterReturn='chapters',busy=false,introAge=0,introPage=0,last=performance.now(),touchMode=matchMedia('(pointer:coarse)').matches;
let subtitle='',subtitleEnd=0,toastTimer=0,finishedRun:Run|undefined,persistenceFailed=false,autoClock=0;
const front=$('#home'),overlay=$('#overlay'),hud=$('#hud'),touch=$('#touch');const drawTitle=titleScene($('#title-stage'),'./art/overlook.webp');
function toast(s:string){const el=$('#toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>el.classList.remove('show'),2600)}
function write(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(p));return true}catch{if(!persistenceFailed){persistenceFailed=true;toast('تعذّر الحفظ على هذا الجهاز')}return false}}
function save(r:Run){if(r.health<=0||r.stage>2)return;p.run=structuredClone(r);write()}
function renderHome(){front.innerHTML=home(p)}
function panel(v:string,html:string){view=v;overlay.innerHTML=html;front.inert=v!=='home';hud.inert=v!=='play';const d=overlay.querySelector<HTMLElement>('[role="dialog"]');if(d){d.tabIndex=-1;d.focus({preventScroll:true})}}
function showHome(){if(game){game.dispose();game=undefined;const c=$<HTMLCanvasElement>('#game-stage');c.replaceWith(c.cloneNode(false));wireCanvas()}sound.quiet();document.body.dataset.mode='home';document.body.classList.remove('touching','editing');editor=false;hud.innerHTML=touch.innerHTML='';renderHome();panel('home','')}
function unlockAudio(){sound.unlock();sound.setMuted(p.prefs.muted)}
function say(s:string){subtitle=s;subtitleEnd=performance.now()+Math.max(4800,s.length*90);sound.speak(s);updateLine()}
function updateLine(){const el=$('#h-line');if(el){el.textContent=subtitle;el.hidden=!subtitle||performance.now()>subtitleEnd}}
function mobile(){touch.innerHTML='';document.body.classList.toggle('touching',touchMode&&view==='play');if(touchMode&&view==='play')touchControls(touch,p,()=>game,false,write,()=>{})}
function pointerRelease(){if(document.pointerLockElement)document.exitPointerLock()}
function exitPlay(){game?.release();if(game)game.active=false;hud.hidden=true;touch.innerHTML='';pointerRelease()}
function pause(){if(view!=='play'&&view!=='pause')return;if(view==='play'&&game){save(game.run);sound.quiet()}view='pause';exitPlay();panel('pause',shell('إيقاف مؤقت',game?missions[game.run.index].title:'شنكال',`<div class="objective-list"><div>${ico('diamond')}${game?missions[game.run.index].goals[game.run.stage]?.label:''}</div></div>${btn('resume','استئناف اللعب','gold','play')}${btn('save','حفظ التقدم','plain','save')}${btn('settings','الإعدادات','plain','settings-2')}${btn('help','طريقة اللعب','plain','gamepad-2')}${btn('main','العودة إلى القائمة الرئيسية','plain','home')}`))}
function resume(fresh=false){if(!game)return;panel('play','');hud.hidden=false;game.release();game.active=true;game.intro=false;sound.mood(game.run.index);if(fresh){game.start();say(missions[game.run.index].dialogue[0]);toast('بدأت المهمة')}mobile();hudUpdate(game,p.prefs);$('#game-stage').focus({preventScroll:true});updateLine()}
function ending(r:Run){finishedRun=r;finish(p,r);write();view='complete';exitPlay();sound.mood(r.index);sound.fx('finish');const m=missions[r.index];say(m.ending);panel('complete',shell(r.index===7?'فجر شنكال':'اكتملت المهمة',m.title,`<img class="brief-art" src="${art(r.index)}" alt=""><p>${m.ending}</p><div class="objective-list"><div>${ico('trophy')} إنجاز · ${m.achievement}</div><div>${ico('clock-3')} زمن المهمة · ${ar(r.seconds)} ثانية</div><div>${ico('shield')} ناجون · ${ar(r.rescues)}</div><div>${ico('bookmark')} الذكرى العائلية · ${r.optional?'جُمعت':'لم تُجمع'}</div><div>${ico('star')} خبرة الفصل · ${ar(100+r.rescues*25+(r.optional?50:0))}</div></div><div class="panel-actions">${r.index<7?btn('next','المهمة التالية','gold','play'):btn('credits','ختام الحكاية','gold','book-open')}${btn('main','العودة إلى القائمة الرئيسية')}</div>`))}
function failed(){view='failed';exitPlay();sound.quiet();panel('failed',shell('فشلت المهمة','نقطة الحفظ',`<p>سقط آزاد قبل الوصول إلى الهدف. يمكنك العودة إلى آخر نقطة حفظ.</p><div class="panel-actions">${btn('retry','إعادة المحاولة','gold','rotate-ccw')}${btn('main','العودة إلى القائمة الرئيسية')}</div>`))}
async function launch(index:number,previous:Run|null){
 if(busy||index>unlocked(p))return;busy=true;unlockAudio();sound.quiet();if(game){game.dispose();game=undefined;const c=$<HTMLCanvasElement>('#game-stage');c.replaceWith(c.cloneNode(false));wireCanvas()}exitPlay();panel('loading','<div class="veil"><div class="loader" role="status" aria-label="جارٍ تحميل المرحلة"></div></div>');await new Promise<void>(ok=>requestAnimationFrame(()=>requestAnimationFrame(()=>ok())));
 try{const {Game}=await import('./game');game=new Game($('#game-stage'),index,previous,p.prefs,sound,{save,finish:ending,fail:failed,notify:toast,line:say,hud:g=>{hudUpdate(g,p.prefs);updateLine()}});
 document.body.dataset.mode='game';hud.innerHTML=hudShell();autoClock=0;subtitle='';if(previous){resume()}else{introAge=0;introPage=0;const m=missions[index];sound.mood(index);panel('intro',`<section class="intro-frame" aria-label="مقدمة المهمة"><small>الفصل ${ar(index+1)} / ٨ · ${m.place}</small><h2>${m.title}</h2><p id="intro-line">${m.intro[0]}</p>${btn('enter','دخول المرحلة','gold','play')}</section>`);sound.speak(m.intro[0])}
 }catch(e){console.error(e);showHome();panel('error',shell('تعذّر تشغيل المشهد','تشغيل اللعبة',`<p>يحتاج المشهد إلى WebGL 2 وتسريع الرسوم. تحقّق من إعدادات المتصفح ثم أعد المحاولة.</p>${btn('main','العودة إلى القائمة الرئيسية','gold')}`))}finally{busy=false;last=performance.now()}
}
function launchRequest(i:number){pending=i;if(p.run){panel('replace',shell('البدء من جديد',missions[i].title,`<p>سيحلّ بدء هذا الفصل محل نقطة الحفظ الحالية في «${missions[p.run.index].title}». ستبقى إنجازات الفصول المكتملة محفوظة.</p><div class="panel-actions">${btn('confirm-launch','بدء الفصل','gold')}${btn('main','إلغاء')}</div>`))}else void launch(i,null)}
function showSettings(){panel('settings',settings(p,rec,tab,binding))}
function back(){if(editor){editor=false;touch.innerHTML='';document.body.classList.remove('editing');showSettings();return}if(binding){binding='';showSettings();return}
 if(view==='play'){pause();return}if(view==='pause'){resume();return}if(view==='brief'){if(chapterReturn==='home')showHome();else panel('chapters',chapters(p));return}if(view==='settings'||view==='help'){if(panelFrom==='pause'){view='pause';pause();return}}
 if(view==='intro'){resume(true);return}if(view==='loading'||view==='complete'||view==='failed')return;showHome()}
function route(id:string){
 if(busy)return;unlockAudio();
 if(id==='full'){if(document.fullscreenElement)void document.exitFullscreen();else if(document.documentElement.requestFullscreen)void document.documentElement.requestFullscreen().catch(()=>toast('تعذّر ملء الشاشة في هذا المتصفح'));else toast('لملء الشاشة، افتح اللعبة من الشاشة الرئيسية');return}
 if(id==='sound'){p.prefs.muted=!p.prefs.muted;sound.setMuted(p.prefs.muted);if(!p.prefs.muted)sound.mood(-1);write();renderHome();return}
 if(id==='main'){if(view==='pause'&&game)save(game.run);showHome();return}if(id==='back'){back();return}
 if(id==='start'){launchRequest(0);return}if(id==='continue'||id==='retry'){if(p.run)void launch(p.run.index,structuredClone(p.run));return}
 if(id==='chapters'){panel('chapters',chapters(p));return}
 if(id==='chapter-card'||id.startsWith('chapter-')){const i=id==='chapter-card'?(p.run?.index??unlocked(p)):Number(id.slice(8));if(i<=unlocked(p)){chapterReturn=view;panel('brief',briefing(i))}return}
 if(id.startsWith('launch-')){launchRequest(Number(id.slice(7)));return}if(id==='confirm-launch'){void launch(pending,null);return}
 if(id==='enter'){resume(true);return}if(id==='pause'){pause();return}if(id==='resume'){resume();return}if(id==='save'&&game){save(game.run);if(!persistenceFailed)toast('تم حفظ التقدم');return}
 if(id==='next'&&finishedRun){void launch(finishedRun.index+1,null);return}
 if(id==='credits'){panel('credits',shell('البيت مفتوح','ختام الحكاية',`<img class="brief-art" src="${art(7)}" alt=""><p>وضعت روجين دفترها على منضدة الدكّان. أضاف كل عائد اسمه، وترك مكانًا لمن سيأتي غدًا.</p><p>إلى من حفظوا أسماء جيرانهم ومفاتيح بيوتهم.</p>${btn('main','العودة إلى القائمة الرئيسية','gold')}`));return}
 if(id==='achievements'){panel('achievements',achievementPanel(p));return}if(id==='about'){panel('about',about());return}
 if(id==='help'||id==='settings'){panelFrom=view==='pause'?'pause':'home';if(id==='help')panel('help',help(p));else{binding='';showSettings()}return}
 if(id.startsWith('tab-')){tab=id.slice(4);binding='';showSettings();return}if(id.startsWith('bind-')){binding=id.slice(5) as Action;showSettings();toast('اضغط المفتاح الجديد، أو Escape للإلغاء');return}
 if(id==='layout'){editor=true;overlay.innerHTML='';document.body.classList.add('editing');touchControls(touch,p,()=>game,true,write,back)}
}
document.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-go]');if(b&&!b.disabled)route(b.dataset.go!)});
document.addEventListener('input',e=>{const el=e.target as HTMLInputElement,key=el.dataset.pref;if(!key)return;
 if(key==='vibrate')p.prefs.vibrate=el.checked;else if(['quality','difficulty','sensitivity','touchSensitivity','music','dialogue','effects'].includes(key)){const v=Number(el.value);p.prefs[key as 'quality']=v;const out=$('output[for="'+el.id+'"]');if(out)out.textContent=ar(v*100)+'٪';if(key==='quality')game?.quality();sound.setLevels(p.prefs.music,p.prefs.dialogue,p.prefs.effects)}write()});
window.addEventListener('keydown',e=>{
 if(editor){if(e.key==='Escape')back();return}
 if(binding){e.preventDefault();if(e.code==='Escape'){binding='';showSettings();return}if(!/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Right|Left)|Shift(Left|Right)|Control(Left|Right)|Space|Enter|Backspace|Alt(Left|Right))$/.test(e.code))return;
 const other=(Object.keys(actions) as Action[]).find(k=>p.prefs.keys[k]===e.code&&k!==binding);if(other)p.prefs.keys[other]=p.prefs.keys[binding];p.prefs.keys[binding]=e.code;binding='';write();showSettings();return}
 if(e.code==='Escape'&&!e.repeat){e.preventDefault();back();return}
 if(view==='home'&&e.code==='Enter'&&(document.activeElement===document.body||document.activeElement===front)){e.preventDefault();route('start');return}
 if(view==='play'&&game){if((Object.values(p.prefs.keys) as string[]).includes(e.code)){e.preventDefault();game.held.add(e.code);if(!e.repeat){const name=(Object.keys(defaultKeys) as Action[]).find(k=>p.prefs.keys[k]===e.code);if(name)game.action(name)}}}
 if(overlay.firstElementChild&&e.key==='Tab'){const all=[...overlay.querySelectorAll<HTMLElement>('button:enabled,select,input')];if(all.length&&((e.shiftKey&&document.activeElement===all[0])||(!e.shiftKey&&document.activeElement===all.at(-1)))){e.preventDefault();all[e.shiftKey?all.length-1:0].focus()}}
});
window.addEventListener('keyup',e=>game?.held.delete(e.code));
window.addEventListener('blur',()=>{if(view==='play')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&view==='play')pause()});
window.addEventListener('pagehide',()=>{if(game&&view==='play')save(game.run)});window.addEventListener('resize',()=>game?.resize());
let mouseDrag=false,camId=-1,cx=0,cy=0,hadLock=false;
function wireCanvas(){const canvas=$<HTMLCanvasElement>('#game-stage');canvas.oncontextmenu=e=>e.preventDefault();
 canvas.onpointerdown=e=>{if(!game||view!=='play')return;e.preventDefault();
 if(e.pointerType==='touch'||e.pointerType==='pen'){if(!touchMode){touchMode=true;mobile()}if(camId<0){camId=e.pointerId;cx=e.clientX;cy=e.clientY;canvas.setPointerCapture(e.pointerId)}}
 else{mouseDrag=true;if(!document.pointerLockElement){try{canvas.requestPointerLock?.()?.catch(()=>{})}catch{}}
 if(e.button===0)game.fireHeld=true;if(e.button===2)game.aim=true}};
 canvas.onpointermove=e=>{if(e.pointerId===camId&&game){game.look(e.clientX-cx,e.clientY-cy,true);cx=e.clientX;cy=e.clientY}};
 canvas.onpointercancel=canvas.onlostpointercapture=e=>{if(e.pointerId===camId)camId=-1};
}wireCanvas();
window.addEventListener('pointerup',e=>{if(e.pointerId===camId)camId=-1;if(e.pointerType==='mouse'&&game){mouseDrag=e.buttons>0;if(e.button===0)game.fireHeld=false;if(e.button===2)game.aim=false}});
window.addEventListener('mousemove',e=>{if(view==='play'&&game&&(document.pointerLockElement||mouseDrag))game.look(e.movementX,e.movementY)});
document.addEventListener('pointerlockchange',()=>{if(hadLock&&!document.pointerLockElement&&view==='play')pause();hadLock=!!document.pointerLockElement});
function frame(t:number){requestAnimationFrame(frame);const dt=Math.max(0,Math.min(.5,(t-last)/1000));last=t;if(document.hidden)return;if(view==='home')drawTitle(t);if(!game)return;if(view==='intro'||view==='play'){game.tick(dt);if(view==='intro'){introAge+=dt;if(introAge>5.5&&introPage===0){introPage=1;const line=missions[game.run.index].intro[1];$('#intro-line').textContent=line;sound.speak(line)}}
 if(view==='play'){autoClock+=dt;if(autoClock>15){autoClock=0;save(game.run)}}}}
renderHome();requestAnimationFrame(frame);
if(import.meta.env.PROD&&'serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').then(reg=>{reg.addEventListener('updatefound',()=>{const w=reg.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)toast('تحديث جاهز عند فتح اللعبة التالي')})})}).catch(()=>{})})}
