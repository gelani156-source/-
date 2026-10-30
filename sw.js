// Bump VERSION whenever any application file changes.
const VERSION='stack-shell-v1.1.0';
const CACHE=VERSION+'-'+self.registration.scope;
const ASSETS=['./','./index.html','./style.css','./app.js','./domain.js','./db.js','./voice.js','./currency.js','./backup.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('stack-shell-')&&name.endsWith('-'+self.registration.scope)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;event.respondWith((async()=>{const cache=await caches.open(CACHE);if(event.request.mode==='navigate')return (await cache.match('./index.html'))||fetch(event.request);return (await cache.match(event.request))||fetch(event.request);})());});
