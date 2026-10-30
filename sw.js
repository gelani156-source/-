const VERSION='stack-shell-v1.3.0';
const CACHE=VERSION+'-'+self.registration.scope;
const ASSETS=['./','./index.html','./style.css','./app.js','./domain.js','./db.js','./voice.js','./currency.js','./backup.js','./money-radar-migrate.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(ASSETS);await self.skipWaiting?.();})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('stack-shell-')&&name.endsWith('-'+self.registration.scope)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(self.registration.scope))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);if(event.request.mode==='navigate'){try{const res=await fetch(event.request,{cache:'no-store'});if(res.ok)await cache.put('./index.html',res.clone());return res;}catch{return await cache.match('./index.html')||Response.error();}}
 try{const res=await fetch(event.request);if(res.ok)await cache.put(event.request,res.clone());return res;}catch{return await cache.match(event.request)||Response.error();}})());});
