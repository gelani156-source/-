import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../domain.js';

function setup(){
 const s=D.fresh();
 s.settings.rates.USD=0.5;
 s.accounts=['a','b','c'].map(id=>({id,name:id,currency:'USD',type:'debit',initial:0}));
 return s;
}
function operation(s,type,splits){return {id:D.uid(),type,date:'2026-10-01',categoryId:s.categories[0].id,splits};}

test('signed conversion rounds halves symmetrically, including negative balances',()=>{
 const s=setup();
 for(const n of [1,3,5,101])assert.equal(D.rub(s,-n,'USD'),-D.rub(s,n,'USD'));
 assert.equal(D.rub(s,-1,'USD'),-1);
 assert.equal(D.rub(s,0,'USD'),0);
 s.accounts[0].initial=-1;
 assert.equal(D.total(s),-1);
});
test('operation conversion is invariant under same-currency splits',()=>{
 const s=setup();
 for(const type of ['expense','income']){
  const sign=type==='expense'?-1:1;
  const one=operation(s,type,[{accountId:'a',amount:sign*3}]);
  const split=operation(s,type,[{accountId:'a',amount:sign},{accountId:'b',amount:sign},{accountId:'c',amount:sign}]);
  D.validateTx(s,one);D.validateTx(s,split);
  assert.equal(D.txRub(s,one),2);assert.equal(D.txRub(s,split),2);
  assert.equal(['a','b','c'].reduce((n,id)=>n+D.txRubForAccount(s,split,id),0),2);
  assert.equal(D.txRubForAccount(s,split,'a'),1);
  assert.equal(D.txRubForAccount(s,split,'b'),1);
  assert.equal(D.txRubForAccount(s,split,'c'),0);
  split.splits.reverse();assert.equal(D.txRubForAccount(s,split,'a'),1);
  assert.equal(D.txRubForAccount(s,split,'missing'),0);
  s.transactions=[split];const stats=D.stats(s,'2026-10','2026-10-01');
  assert.equal(stats[type],2);
 }
});
test('mixed currency transfers are converted independently per currency',()=>{
 const s=setup();s.accounts[1].currency='RUB';
 const t=operation(s,'transfer',[{accountId:'a',amount:-1},{accountId:'b',amount:1}]);
 D.validateTx(s,t);assert.equal(D.txRub(s,t),2);
 assert.equal(D.txRubForAccount(s,t,'a'),1);assert.equal(D.txRubForAccount(s,t,'b'),1);
});
test('legacy recurring links survive detail and schedule edits but not type change or deletion',()=>{
 const s=setup(),r={id:'r',name:'Bill',amount:3,day:1,accountId:'a',categoryId:s.categories[0].id,before:1};
 s.recurring=[r];const t={...operation(s,'expense',[{accountId:'a',amount:-3}]),recurringId:'r',recurringMonth:'2026-10'};s.transactions=[t];
 assert.equal(D.unpaid(s,'2026-10').length,0);
 t.date='2026-11-02';t.splits=[{accountId:'b',amount:-2}];r.amount=10;r.accountId='c';
 assert.equal(D.unpaid(s,'2026-10').length,0);
 assert.equal(D.unpaid(s,'2026-11').length,1);
 assert.doesNotThrow(()=>D.validateBackup(s));
 t.type='income';t.splits[0].amount=2;assert.equal(D.unpaid(s,'2026-10').length,1);
 assert.equal(D.free(s,'2026-10'),-4);
 t.type='transfer';t.splits=[{accountId:'a',amount:-2},{accountId:'b',amount:2}];assert.equal(D.unpaid(s,'2026-10').length,1);
 t.type='expense';t.splits=[{accountId:'a',amount:-2}];t.deleted=true;assert.equal(D.unpaid(s,'2026-10').length,1);
 t.deleted=false;assert.equal(D.unpaid(s,'2026-10').length,0);
});
