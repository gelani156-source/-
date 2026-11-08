import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../domain.js';

function setup(currency='RUB'){
 const s=D.fresh();
 s.accounts=[{id:'a',name:'Счёт',currency,type:'debit',initial:100000}];
 s.recurring=[{id:'r',name:'Ипотека',amount:10000,day:15,accountId:'a',categoryId:s.categories[0].id,before:1}];
 return s;
}

test('фактическая оплата может совпадать с планом или отличаться от него',()=>{
 for(const [value,amount] of [['100.00',10000],['25,50',2550],['150,25',15025]]){
  const s=setup(),before=structuredClone(s.recurring[0]);
  const t=D.recordRecurringPayment(s,'r','2026-10','2026-09-30',value);
  assert.deepEqual(t.splits,[{accountId:'a',amount:-amount}]);
  assert.equal(t.recurringMonth,'2026-10');assert.equal(t.recurringId,'r');assert.equal(t.date,'2026-09-30');
  assert.deepEqual(s.recurring[0],before);assert.equal(D.unpaid(s,'2026-10').length,0);assert.equal(D.unpaid(s,'2026-11')[0].amount,10000);
  assert.equal(D.balance(s,'a'),100000-amount);assert.equal(D.stats(s,'2026-09','2026-09-30').expense,amount);
  assert.equal(D.stats(s,'2026-10','2026-10-01').expense,0);
  assert.equal(D.free(s,'2026-10'),100000-amount);assert.equal(D.free(s,'2026-11'),100000-amount-10000);
  assert.doesNotThrow(()=>D.validateBackup(s));
 }
});

test('некорректные суммы и дата не создают операцию',()=>{
 for(const value of ['0','-1','', '1.234','1e3','10000000001']){
  const s=setup();assert.throws(()=>D.recordRecurringPayment(s,'r','2026-10','2026-10-01',value));assert.equal(s.transactions.length,0);assert.equal(D.unpaid(s,'2026-10').length,1);
 }
 const s=setup();assert.throws(()=>D.recordRecurringPayment(s,'r','2026-10','2026-02-30','1'));assert.throws(()=>D.recordRecurringPayment(s,'r','2026-13','2026-10-01','1'));assert.equal(s.transactions.length,0);
});

test('повторная оплата месяца запрещена, удаление возвращает напоминание',()=>{
 const s=setup(),t=D.recordRecurringPayment(s,'r','2026-10','2026-10-01','150');
 assert.throws(()=>D.recordRecurringPayment(s,'r','2026-10','2026-10-02','1'),/уже оплачен/);assert.equal(s.transactions.length,1);
 t.deleted=true;assert.equal(D.unpaid(s,'2026-10').length,1);assert.equal(D.free(s,'2026-10'),90000);
 D.recordRecurringPayment(s,'r','2026-10','2026-10-03','100');assert.equal(D.unpaid(s,'2026-10').length,0);
});

test('валютный счёт: баланс в валюте, статистика и резерв в рублях',()=>{
 const s=setup('USD');s.settings.rates.USD=90;
 assert.equal(D.free(s,'2026-10'),8100000);
 D.recordRecurringPayment(s,'r','2026-10','2026-10-01','125,50');
 assert.equal(D.balance(s,'a'),87450);assert.equal(D.stats(s,'2026-10','2026-10-01').expense,1129500);
 assert.equal(D.free(s,'2026-10'),7870500);assert.equal(D.free(s,'2026-11'),6970500);
});
