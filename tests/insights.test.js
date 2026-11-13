import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localInsights} from '../insights.js';

const fixture=()=>({accounts:[{id:'a',currency:'USD'},{id:'b',currency:'USD'},{id:'r',currency:'RUB'}],categories:[{id:'food',section:1},{id:'rent',section:0}],settings:{rates:{RUB:1,USD:1.5}},budgets:{'2026-03':[1000,300,0]},transactions:[]});
const tx=(date,type,amount,categoryId='food',extra={})=>({date,type,categoryId,splits:[{accountId:'r',amount}],...extra});

test('equal windows, leap year, future, transfers and deleted records',()=>{
 const s=fixture();s.transactions=[tx('2024-03-01','expense',-100),tx('2024-02-01','income',1000),tx('2024-01-31','expense',-200),tx('2024-01-01','expense',-999),tx('2024-03-02','expense',-500),tx('2024-02-28','transfer',-999),tx('2024-02-28','expense',-999,'food',{deleted:true})];
 const before=JSON.stringify(s),r=localInsights(s,'2024-03-01');
 assert.deepEqual(r.current,{from:'2024-02-01',to:'2024-03-01',income:1000,expense:100,count:2});
 assert.deepEqual(r.previous,{from:'2024-01-02',to:'2024-01-31',income:0,expense:200,count:1});
 assert.equal(JSON.stringify(s),before);
});
test('budget overspend uses whole operation, core conversion and only actual month-to-date',()=>{
 const s=fixture();s.transactions=[{date:'2026-03-02',type:'expense',categoryId:'food',splits:[{accountId:'a',amount:-101},{accountId:'b',amount:-100}]},tx('2026-03-03','expense',-1),tx('2026-03-04','expense',-500),tx('2026-02-28','expense',-9999),tx('2026-03-01','expense',-2000,'rent',{deleted:true}),tx('2026-03-01','income',2000)];
 const r=localInsights(s,'2026-03-03');assert.deepEqual(r.overspent,[{section:1,amount:303,budget:300}]);assert.equal(r.current.income,2000);assert.equal(r.current.expense,10302);
});
test('zero budget is not treated as an overspend, and invalid date rejected',()=>{
 const s=fixture();s.transactions=[tx('2026-03-01','expense',-100,'rent')];s.budgets['2026-03']=[0,0,0];assert.deepEqual(localInsights(s,'2026-03-01').overspent,[]);assert.throws(()=>localInsights(s,'2026-02-30'),/дата/);
});

test('current expense categories use core conversion, exclude transfers, future and deleted, and preserve input',()=>{
 const s=fixture(); s.transactions=[tx('2026-03-03','expense',-20,'food'),tx('2026-03-02','expense',-30,'rent'),tx('2026-03-01','expense',-10,'food'),tx('2026-03-04','expense',-999,'rent'),tx('2026-03-03','transfer',-999,'food'),tx('2026-03-03','expense',-999,'food',{deleted:true}),{date:'2026-03-03',type:'expense',categoryId:'rent',splits:[{accountId:'a',amount:-100}]}];
 const before=structuredClone(s), r=localInsights(s,'2026-03-03');
 assert.deepEqual(r.categoryExpenses,[{categoryId:'rent',amount:180},{categoryId:'food',amount:30}]); assert.deepEqual(s,before);
});
