import test from 'node:test';
import assert from 'node:assert/strict';
import {simulatePurchase} from '../simulator.js';
import {readFileSync} from 'node:fs';

test('synthetic purchase scenarios use integer minor units and keep input intact',()=>{
 const input={balance:100005,price:40001,income:20000,expenses:10000,reserve:65000};
 const original=structuredClone(input);
 assert.deepEqual(simulatePurchase(input),{now:60004,beforeLater:110005,end:70004,nowBelowReserve:true,laterBeforeBelowReserve:false,endBelowReserve:false});
 assert.deepEqual(input,original);
});
test('reserve boundary, negative balance and eventual deficit',()=>{
 let r=simulatePurchase({balance:10000,price:5000,income:0,expenses:0,reserve:5000});
 assert.equal(r.nowBelowReserve,false);assert.equal(r.endBelowReserve,false);
 r=simulatePurchase({balance:-100,price:100,income:0,expenses:0,reserve:0});
 assert.equal(r.now,-200);assert.equal(r.endBelowReserve,true);
});
test('reject bad or unsafe numbers and nonpositive price',()=>{
 const x={balance:1,price:1,income:0,expenses:0,reserve:0};
 for(const change of [{price:0},{price:-1},{income:-1},{reserve:-1},{expenses:-1},{balance:NaN},{balance:1.1},{price:1e13},{income:Infinity},{}]) {
   const v={...x,...change};if(!Object.keys(change).length)delete v.price;
   assert.throws(()=>simulatePurchase(v));
 }
});
test('offline shell caches simulator version and UI uses it without persistence',()=>{
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(sw, /simulator\.js\?v=2\.2\.9/);
 const part=app.slice(app.indexOf('function purchaseSimulator()'),app.indexOf('function goalsList()'));
 assert.match(part,/simulatePurchase\(/);assert.doesNotMatch(part,/\b(?:change|persist)\s*\(/);
 assert.match(part,/addEventListener\('input'/);
});
