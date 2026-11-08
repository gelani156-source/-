import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const code=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const scope='https://test.invalid/stack/';
const htmlAssets=[...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi)].map(m=>m[1]);
const js=htmlAssets.find(url=>/app\.js(?:\?|$)/.test(url));
const css=htmlAssets.find(url=>/style\.css(?:\?|$)/.test(url));

// A small CacheStorage model: exact URL matching including search parameters.
function harness({storage=new Map(),url=scope,failAsset}={}) {
  const events={},calls=[],deleted=[];
  let online=true,putFails=false,forced=0,claims=0;
  const key=req=>new URL(typeof req==='string'?req:req.url,url).href;
  const response=(body,ok=true)=>({body,ok,clone(){return response(body,ok);}});
  const caches={
    async open(name){
      if(!storage.has(name))storage.set(name,new Map());
      const entries=storage.get(name);
      return {
        async addAll(assets){
          const staged=[];
          for(const asset of assets){
            assert.ok(asset instanceof Request);
            assert.equal(asset.cache,'reload','precache bypasses stale HTTP cache');
            const relative='./'+new URL(asset.url).pathname.slice(new URL(url).pathname.length)+new URL(asset.url).search;
            if(relative===failAsset)throw Error('precache failed');
            staged.push([key(asset),response(relative==='./index.html'?html:`asset:${relative}`)]);
          }
          for(const [k,v] of staged)entries.set(k,v);
        },
        async match(req){return entries.get(key(req));},
        async put(req,res){if(putFails)throw Error('quota');entries.set(key(req),res);}
      };
    },
    async keys(){return [...storage.keys()];},
    async delete(name){deleted.push(name);return storage.delete(name);}
  };
  const self={registration:{scope:url},location:{origin:new URL(url).origin},
    addEventListener:(type,fn)=>events[type]=fn,
    skipWaiting:async()=>{forced++;},clients:{claim:async()=>{claims++;}}};
  const fetch=async req=>{calls.push(key(req));if(!online)throw Error('offline');return response(`network:${key(req)}`);};
  vm.runInNewContext(code,{URL,Request,Response,caches,self,fetch});
  return {storage,calls,deleted,events,response,
    offline(){online=false;}, online(){online=true;}, failPuts(){putFails=true;},
    get forced(){return forced;},get claims(){return claims;},
    async lifecycle(type){let promise;events[type]({waitUntil:p=>{promise=p;}});assert.ok(promise);return promise;},
    async request(path,{method='GET',mode='cors'}={}){let promise;events.fetch({request:{url:new URL(path,url).href,method,mode},respondWith:p=>{promise=p;}});return promise;}
  };
}

test('precache uses actual index URLs and serves a complete shell offline',async()=>{
  assert.ok(js && css,'index must reference app.js and style.css');
  assert.match(js,/\?/);assert.match(css,/\?/);
  const h=harness();await h.lifecycle('install');await h.lifecycle('activate');h.offline();
  const page=await h.request('./?from=offline',{mode:'navigate'});
  assert.equal(page.body,html);
  for(const asset of [js,css,...['domain.js','db.js','voice.js','currency.js','backup.js','money-radar-migrate.js'].map(name=>`./${name}?v=2.2.7`),'./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png']){
    assert.equal((await h.request(asset)).body,`asset:${asset}`,asset);
  }
  assert.equal(h.calls.length,0,'offline shell must not need the network');
  assert.equal((await h.request('./app.js?v=not-cached')).type,'error','query strings remain distinct');
});

test('updates wait for old clients and failed precache leaves the previous shell intact',async()=>{
  const storage=new Map([['stack-shell-v-old-'+scope,new Map([[new URL('./index.html',scope).href,{body:'old html'}]])]]);
  const failed=harness({storage,failAsset:css});
  await assert.rejects(failed.lifecycle('install'),/precache failed/);
  assert.equal(storage.get('stack-shell-v-old-'+scope).get(new URL('./index.html',scope).href).body,'old html');
  assert.equal(failed.forced,0);assert.equal(failed.claims,0);
  const h=harness({storage});await h.lifecycle('install');
  assert.equal(h.forced,0);assert.equal(h.claims,0);
  assert.ok(storage.has('stack-shell-v-old-'+scope),'old shell survives until activation');
  await h.lifecycle('activate');assert.equal(storage.has('stack-shell-v-old-'+scope),false);
  assert.equal(h.claims,0);
  assert.equal((await h.request('./',{mode:'navigate'})).body,html,'network HTML cannot replace installed shell');
  assert.equal(h.calls.length,0);
});

test('activation and fetch remain isolated to the registration scope',async()=>{
  const other='https://test.invalid/other/';
  const storage=new Map([['unrelated',new Map()],['stack-shell-v0-'+scope,new Map()],['stack-shell-v0-'+other,new Map()]]);
  const a=harness({storage}),b=harness({storage,url:other});
  await a.lifecycle('install');await b.lifecycle('install');await a.lifecycle('activate');
  assert.deepEqual(a.deleted,['stack-shell-v0-'+scope]);
  assert.ok(storage.has('stack-shell-v0-'+other));assert.ok(storage.has('unrelated'));
  b.offline();assert.equal((await b.request(js)).body,`asset:${js}`);
  assert.equal(await a.request('https://other.invalid/stack/app.js'),undefined);
  assert.equal(await a.request('https://test.invalid/other/app.js'),undefined);
  assert.equal(await a.request('./app.js',{method:'POST'}),undefined);
});

test('missing offline navigation returns an error; cache write failure preserves online response',async()=>{
  const h=harness();await h.lifecycle('install');
  const current=[...h.storage.keys()][0];h.storage.get(current).delete(new URL('./index.html',scope).href);
  h.offline();assert.equal((await h.request('./',{mode:'navigate'})).type,'error');
  h.online();assert.equal((await h.request('./',{mode:'navigate'})).body,`network:${scope}`);
  h.failPuts();assert.equal((await h.request('./extra.js')).body,`network:${scope}extra.js`);
});

test('legacy cache cannot supply old app, CSS or module URLs to the new shell',async()=>{
  const modules=['app.js','domain.js','db.js','voice.js','currency.js','backup.js','money-radar-migrate.js'];
  const legacy=new Map([...modules,'style.css'].map(name=>[new URL('./'+name,scope).href,'old']));
  const h=harness({storage:new Map([['stack-shell-v2.2.5-'+scope,legacy]])});
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const db=await readFile(new URL('../db.js',import.meta.url),'utf8');
  const backup=await readFile(new URL('../backup.js',import.meta.url),'utf8');
  const dependencies=[...app.matchAll(/from ['"](\.\/[^'"]+\.js\?v=[^'"]+)['"]/g),...db.matchAll(/from ['"](\.\/[^'"]+\.js\?v=[^'"]+)['"]/g),...backup.matchAll(/from ['"](\.\/[^'"]+\.js\?v=[^'"]+)['"]/g)].map(m=>m[1]);
  assert.equal(dependencies.length,8);
  for(const asset of [js,css,...dependencies])assert.equal(legacy.has(new URL(asset,scope).href),false,asset);
  await h.lifecycle('install');h.offline();
  for(const asset of [js,css,...dependencies])assert.equal((await h.request(asset)).body,`asset:${asset}`,asset);
});
