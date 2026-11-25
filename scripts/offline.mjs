import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) => (e.isDirectory() ? collect(dir + '/' + e.name) : dir + '/' + e.name)),
    )
  ).flat();
}
const files = (await collect('dist')).filter((f) => !f.endsWith('/sw.js')).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(file));
const assets = files.map((f) => './' + f.slice(5));
const code = `
const scope=new URL(self.registration.scope).pathname;
const prefix='shingal:'+scope+':';
const cacheName=prefix+'${hash.digest('hex').slice(0, 16)}';
const resources=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(resources))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(prefix)&&name!==cacheName)await caches.delete(name);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(scope))return;
 event.respondWith((async()=>{const cache=await caches.open(cacheName);if(request.mode==='navigate')return (await cache.match(new URL('index.html',self.registration.scope)))||fetch(request);return (await cache.match(request))||fetch(request)})());
});
`;
await writeFile('dist/sw.js', code);
console.log('Offline cache:', files.length, 'files');
