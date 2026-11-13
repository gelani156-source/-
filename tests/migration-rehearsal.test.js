import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh, balance} from '../domain.js';
import {rehearseMigration} from '../migration-rehearsal.js';

function fixture() {
  const s = fresh();
  s.accounts = [
    {id:'a', name:'Карта', currency:'RUB', type:'debit', initial:12345},
    {id:'b', name:'Наличные', currency:'RUB', type:'cash', initial:0},
    {id:'c', name:'Валюта', currency:'USD', type:'debit', initial:10000}
  ];
  const categoryId = s.categories[0].id;
  s.transactions = [
    {id:'1', type:'income', date:'2026-01-01', categoryId, splits:[{accountId:'a',amount:101}]},
    {id:'2', type:'expense', date:'2026-01-02', categoryId, splits:[{accountId:'a',amount:-40},{accountId:'b',amount:-10}]},
    {id:'3', type:'transfer', date:'2026-01-03', splits:[{accountId:'a',amount:-100},{accountId:'b',amount:100}]},
    {id:'4', type:'transfer', date:'2026-01-04', splits:[{accountId:'a',amount:-9000},{accountId:'c',amount:100}]},
    {id:'5', type:'expense', date:'2026-01-05', categoryId, deleted:true, splits:[{accountId:'a',amount:-999}]}
  ];
  s.extra = {futureField:['untouched', 12]};
  return s;
}
test('репетиция сохраняет все поля и балансы, не меняя источник', () => {
  const s=fixture(), before=structuredClone(s);
  const result=rehearseMigration(s);
  assert.deepEqual(s,before); assert.deepEqual(result.candidate,before);
  for (const row of result.balances) assert.equal(row.minor,balance(s,row.id));
  assert.deepEqual(result.balances.map(x=>x.minor),[3306,90,10100]);
  result.candidate.extra.futureField[0]='changed'; assert.deepEqual(s,before);
});
test('изменение любых данных и ошибки мигратора не затрагивают исходник', () => {
  const s=fixture(), before=structuredClone(s);
  assert.throws(()=>rehearseMigration(s, x=>{x.extra.futureField.pop(); return x;}),/изменила данные/);
  assert.throws(()=>rehearseMigration(s, x=>{x.accounts[0].initial=0; throw Error('interrupted');}),/interrupted/);
  assert.throws(()=>rehearseMigration(s, async x=>x),/синхронно/);
  assert.deepEqual(s,before);
});
test('повреждённая копия и потерянная операция отклоняются', () => {
  const s=fixture();
  assert.throws(()=>rehearseMigration(s,x=>{x.transactions.pop();return x;}),/изменила данные/);
  s.transactions[0].splits[0].accountId='missing';
  assert.throws(()=>rehearseMigration(s));
});
test('промежуточное переполнение отклоняется даже при безопасном остатке', () => {
  const s=fixture(); s.accounts=[s.accounts[0]]; s.accounts[0].initial=0; s.transactions=[];
  for(let i=0;i<9008;i++) s.transactions.push({id:String(i),type:'income',date:'2026-01-01',categoryId:s.categories[0].id,splits:[{accountId:'a',amount:1000000000000}]});
  for(let i=0;i<9008;i++) s.transactions.push({id:'n'+i,type:'expense',date:'2026-01-01',categoryId:s.categories[0].id,splits:[{accountId:'a',amount:-1000000000000}]});
  assert.throws(()=>rehearseMigration(s),/Небезопасный промежуточный баланс/);
});
