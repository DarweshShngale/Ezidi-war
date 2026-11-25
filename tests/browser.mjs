// Production browser regression. The temporary HTTP fixture also exercises a Pages-style subpath.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname, resolve, relative } from 'node:path';
import { once } from 'node:events';
import assert from 'node:assert/strict';
const dist=resolve('dist'),prefix='/Ezidi-war/';
const mime={'.html':'text/html','.js':'application/javascript','.svg':'image/svg+xml','.css':'text/css','.woff2':'font/woff2','.ttf':'font/ttf','.webp':'image/webp','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(!path.startsWith(prefix))throw Error();
 const file=resolve(dist,decodeURIComponent(path.slice(prefix.length))||'index.html');
 if(relative(dist,file).startsWith('..'))throw Error();
 res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.statusCode=404;res.end()}});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port+prefix;
const binary=process.env.CHROMIUM_PATH;
const browser=await chromium.launch({executablePath:binary||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const capture=process.env.SCREENSHOT_DIR;
const errors=[],results={};if(capture)await mkdir(capture,{recursive:true});
const snap=async(page,name)=>{if(capture)await page.screenshot({path:join(capture,name+'.jpg'),quality:88})};
async function watch(context){
 const page=await context.newPage();page.setDefaultTimeout(30000);
 page.on('pageerror',e=>{errors.push(e.message);console.error(e)});page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon')){errors.push(m.text());console.error(m.text())}});
 await page.goto(base);await page.locator('[data-go="start"]').waitFor();await page.evaluate(()=>document.fonts.ready);return page;
}
const getSave=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('shingal.resistance.profile.v1')));
try{
 const ctx=await browser.newContext({viewport:{width:1360,height:840}}),pg=await watch(ctx);
 assert.equal(await pg.locator('html').getAttribute('dir'),'rtl');
 await snap(pg,'menu');await pg.locator('[data-go="chapters"]').click();assert.equal(await pg.locator('.locked').count(),7);await pg.locator('[data-go="back"]').click();
 await pg.locator('[data-go="settings"]').click();await pg.locator('[data-pref="quality"]').selectOption('0');await pg.locator('[data-go="tab-controls"]').click();await pg.locator('[data-go="bind-heal"]').click();await pg.keyboard.press('KeyJ');
 assert.equal((await getSave(pg)).prefs.keys.heal,'KeyJ');await pg.locator('[data-go="back"]').click();
 const start=performance.now();await pg.locator('[data-go="start"]').click();await pg.locator('[data-go="enter"]').waitFor();
 results.firstChapterReadyMs=Math.round(performance.now()-start);await pg.locator('[data-go="enter"]').click();await pg.locator('#h-distance').waitFor();await snap(pg,'gameplay');
 results.renderer=await pg.evaluate(()=>{const c=document.createElement('canvas'),gl=c.getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)});
 results.desktop=await pg.evaluate(()=>new Promise(ok=>{let frames=0,start=performance.now();const f=t=>{frames++;if(t-start>=3000)ok({frames,seconds:+((t-start)/1000).toFixed(2),fps:+(frames*1000/(t-start)).toFixed(1)});else requestAnimationFrame(f)};requestAnimationFrame(f)}));
 console.log('Desktop sample',JSON.stringify(results));await snap(pg,'desktop-ready');await pg.keyboard.down('KeyW');await pg.waitForFunction(()=>!document.querySelector('#h-prompt').hidden&&document.querySelector('#h-prompt').textContent.includes('تحدّث'),null,{timeout:60000}).catch(async e=>{console.log('Movement failure',await pg.locator('body').innerText(),await getSave(pg));await snap(pg,'movement-failure');throw e});await pg.keyboard.up('KeyW');await pg.keyboard.press('KeyE');await pg.waitForFunction(()=>document.getElementById('h-stage').textContent.includes('٢'));
 await pg.keyboard.press('Space');await pg.keyboard.press('KeyC');await pg.keyboard.press('Escape');await pg.locator('[data-go="save"]').click();
 const ck=await getSave(pg);assert.equal(ck.run.stage,1);assert.ok(ck.run.z<17);await pg.reload();await pg.locator('[data-go="continue"]').click();await pg.locator('#h-stage').waitFor();await pg.waitForFunction(()=>document.getElementById('h-stage').textContent.includes('٢'));
 await pg.keyboard.press('Escape');await pg.locator('[data-go="main"]').click();
 await pg.evaluate(async()=>{await navigator.serviceWorker.ready});await ctx.setOffline(true);await pg.reload();await pg.locator('[data-go="continue"]').click();await pg.locator('#h-stage').waitFor();await ctx.setOffline(false);
 await ctx.close();results.checkpoint=true;results.offline=true;
 for(const [device,width,height,dpr] of [['iphone',844,390,3],['android',915,412,2.625]]){
 const c=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:dpr});
 const page=await watch(c);await page.locator('[data-go="settings"]').tap();await page.locator('[data-pref="quality"]').selectOption('0');await page.locator('[data-go="back"]').tap();await page.locator('[data-go="start"]').tap();await page.locator('[data-go="enter"]').tap();await page.locator('[data-touch="stick"]').waitFor();const pad=await page.locator('[data-touch="stick"]').boundingBox();assert.ok(pad);
 const cdp=await c.newCDPSession(page);const x=pad.x+pad.width/2,y=pad.y+pad.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-pad.height*.47,id:1}]});
 // Keep the joystick pressed while the second finger turns the camera.
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:y-pad.height*.47,id:1},{x:width*.55,y:height*.52,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-pad.height*.47,id:1},{x:width*.58,y:height*.54,id:2}]});
 results[device]=await page.evaluate(()=>new Promise(ok=>{let n=0,start=performance.now();const f=t=>{n++;if(t-start>3000)ok({fps:+(n*1000/(t-start)).toFixed(1),viewport:[innerWidth,innerHeight]});else requestAnimationFrame(f)};requestAnimationFrame(f)}));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.locator('[data-touch="jump"]').tap();await page.locator('[data-touch="crouch"]').tap();await snap(page,'gameplay-'+device);
 await page.locator('[data-go="pause"]').tap();const save=await getSave(page);assert.ok(save.run.z<24);assert.notEqual(save.run.yaw,0);
 await c.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results,null,2));
}finally{await browser.close();await new Promise(ok=>server.close(ok))}
