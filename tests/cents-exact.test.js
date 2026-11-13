import test from 'node:test';
import assert from 'node:assert/strict';
import {cents} from '../domain.js';

test('decimal input maps to integer kopecks exactly, including signs and boundaries',()=>{
 for (let i=0;i<10000;i++) {
  const text=`${Math.floor(i/100)}.${String(i%100).padStart(2,'0')}`;
  assert.equal(cents(text),i);
  assert.equal(cents('-'+text),i===0?0:-i);
 }
 assert.equal(cents(' 000 001,2 '),120);
 assert.equal(cents('10000000000.00'),1000000000000);
 assert.equal(cents('-10000000000.00'),-1000000000000);
 assert.throws(()=>cents('10000000000.01'),/велика/);
 assert.throws(()=>cents('999999999999999999999999999999'),/велика/);
 for(const text of ['1.001','1.','1e3','+1','','.5']) assert.throws(()=>cents(text));
});
