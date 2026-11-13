import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../domain.js';
import {inspectHealth} from '../health.js';

function sample() {
 const s=fresh();
 s.accounts=[{id:'a',name:'A',currency:'RUB',type:'debit',initial:100}];
 s.transactions=[{id:'t',type:'expense',date:'2026-01-01',categoryId:s.categories[0].id,splits:[{accountId:'a',amount:-10}]}];
 return s;
}
test('valid synthetic state is unchanged',()=>{
 const s=sample(), before=structuredClone(s);
 assert.deepEqual(inspectHealth(s),{valid:true,unsafeBalances:0});
 assert.deepEqual(s,before);
});
test('invalid references and duplicate IDs fail without modifying data',()=>{
 const s=sample();s.transactions[0].splits[0].accountId='missing';
 const before=structuredClone(s);
 assert.deepEqual(inspectHealth(s),{valid:false,unsafeBalances:0});assert.deepEqual(s,before);
 s.transactions=[];s.accounts.push({...s.accounts[0]});assert.equal(inspectHealth(s).valid,false);
});
test('unsafe aggregate is detected exactly and deleted transactions are excluded',()=>{
 const s=sample();s.transactions=[];
 for(let i=0;i<9008;i++)s.transactions.push({id:String(i),type:'income',date:'2026-01-01',categoryId:s.categories[0].id,splits:[{accountId:'a',amount:1e12}]});
 assert.equal(inspectHealth(s).unsafeBalances,1);
 s.transactions.push({id:'opposite',type:'expense',date:'2026-01-01',categoryId:s.categories[0].id,splits:[{accountId:'a',amount:-1e12}]});
 assert.equal(inspectHealth(s).unsafeBalances,1); // Final sum is safe; intermediate is not.
 for(const tx of s.transactions)tx.deleted=true;
 assert.equal(inspectHealth(s).unsafeBalances,0);
});
