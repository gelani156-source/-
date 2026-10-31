import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {fresh,txRub,txRubForAccount,uid} from '../domain.js';
test('analytics by account allocates split expense to selected account only',()=>{
 const s=fresh();s.accounts=[{id:'a',initial:0,currency:'RUB',type:'debit',name:'A'},{id:'b',initial:0,currency:'RUB',type:'debit',name:'B'}];
 const t={id:uid(),type:'expense',date:'2026-10-31',categoryId:s.categories[0].id,splits:[{accountId:'a',amount:-7500},{accountId:'b',amount:-2500}]};
 assert.equal(txRub(s,t),10000);assert.equal(txRubForAccount(s,t,'a'),7500);assert.equal(txRubForAccount(s,t,'b'),2500);
});
