// Bump this version with every shell release, including changes to index.html or its assets.
const VERSION='stack-shell-v2.2.7';
const CACHE=VERSION+'-'+self.registration.scope;
const ASSETS=['./','./index.html','./style.css?v=2.2.7','./app.js?v=2.2.7','./domain.js?v=2.2.7','./db.js?v=2.2.7','./voice.js?v=2.2.7','./currency.js?v=2.2.7','./backup.js?v=2.2.7','./money-radar-migrate.js?v=2.2.7','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(ASSETS.map(url=>new Request(new URL(url,self.registration.scope),{cache:'reload'})));})());});
// Do not force activation or claim existing clients: an old page must keep its old shell.
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('stack-shell-')&&name.endsWith('-'+self.registration.scope)&&name!==CACHE)await caches.delete(name);})());});
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(self.registration.scope))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);if(event.request.mode==='navigate'){
 // Serve the installed HTML with its matching assets, not a newer network HTML.
 const shell=await cache.match('./index.html');if(shell)return shell;
 try{return await fetch(event.request,{cache:'no-store'});}catch{return Response.error();}}
 const saved=await cache.match(event.request);if(saved)return saved;try{const res=await fetch(event.request);if(res.ok){try{await cache.put(event.request,res.clone());}catch{ /* A full or unavailable cache must not break an online response. */ }}return res;}catch{return Response.error();}})());});
