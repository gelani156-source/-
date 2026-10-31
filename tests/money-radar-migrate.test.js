import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
// crypto provided by Node 22
import {fresh,validateBackup} from '../domain.js';
import {mergeMoneyRadar,inspectMoneyRadar} from '../money-radar-migrate.js';
test('migrate full Money Radar, idempotent and valid',()=>{
 const s=fresh();s.accounts.push({id:'acc',name:'Карта',currency:'RUB',type:'debit',initial:0});
 const d={transactions:[{id:'x',date:'2026-10-10',type:'expense',amount:200,category:'Продукты',section:'Повседневные',note:'Магазин'},{id:'y',date:'2026-10-11',type:'income',amount:15000,category:'Зарплата',note:'Зарплата'}],loans:[{id:1,name:'Петя',originalAmount:1000,remainingAmount:600,isOld:true,transactionId:'x'}],goals:[{id:1,name:'Поездка',target:100000,saved:5000}],recurring:[{id:1,name:'Ипотека',day:15,amount:35000,section:'Обязательные',category:'Жильё'}],templates:[{id:2,name:'Кофе',amount:200,category:'Кафе'}],sectionBudgets:{'Обязательные':45000,'Повседневные':30000,'Образ жизни':15000},initialBalance:3000};
 const raw={format:'money-radar-stack-full',moneyRadarOriginal:d};
 assert.equal(inspectMoneyRadar(raw).counts.loans,1);
 const opts={accountId:'acc',budgetMonth:'2026-10',importInitial:false};
 const one=mergeMoneyRadar(s,raw,opts);validateBackup(one.state);assert.equal(one.report.transactions,2);assert.equal(one.state.loans[0].remaining,60000);assert.equal(one.state.budgets['2026-10'][0],4500000);assert.equal(one.state.accounts[0].initial,0);
 const two=mergeMoneyRadar(one.state,raw,{...opts,budgetMonth:null});validateBackup(two.state);assert.equal(two.report.transactions,0);assert.equal(two.report.loans,0);assert.equal(two.report.goals,0);assert.equal(two.report.recurring,0);
});
test('previously imported operation with same date/amount/note not duplicated',()=>{
 const s=fresh();const c=s.categories[0];s.accounts.push({id:'a',name:'Карта',currency:'RUB',type:'debit',initial:0});s.transactions.push({id:'old',date:'2026-10-10',type:'expense',note:'Магазин',categoryId:c.id,splits:[{accountId:'a',amount:-20000}],created:''});
 const result=mergeMoneyRadar(s,{transactions:[{id:3,date:'2026-10-10',type:'expense',amount:200,note:'Магазин',category:'Продукты'}]},{accountId:'a'});assert.equal(result.report.duplicates,1);assert.equal(result.state.transactions.length,1);
});
