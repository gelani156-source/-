import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../domain.js';
import {backupSnapshot,backupSummary,encryptBackup,decryptBackup} from '../backup.js';
import {fetchCBR} from '../currency.js';
test('snapshot removes PIN but maintains original',()=>{const data=fresh();data.settings.pin={salt:'secret',hash:'f'.repeat(64)};const snap=backupSnapshot(data);assert.equal(snap.settings.pin,null);assert.ok(data.settings.pin);assert.equal(backupSummary(snap).accounts,0);});
test('encrypted backup roundtrip and wrong password',async()=>{const src=fresh();const ciphertext=await encryptBackup(src,'password-123');assert.equal(ciphertext.format,'stack-encrypted');assert.equal((await decryptBackup(ciphertext,'password-123')).format,'stack');await assert.rejects(()=>decryptBackup(ciphertext,'not-the-password'))});
test('currency response validation and nominal divisor',async()=>{const old=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({Date:'2026-10-29T11:00:00Z',Valute:{USD:{Value:80,Nominal:1},EUR:{Value:900,Nominal:10}}})});try{const data=await fetchCBR();assert.equal(data.rates.EUR,90);assert.equal(data.rates.USD,80);}finally{globalThis.fetch=old;}});

import {parseText} from '../domain.js';
test('spoken amounts, thousands and income intent',()=>{assert.equal(parseText('Получил зарплату 85 тысяч').amount,8500000);assert.equal(parseText('Премия 15000').type,'income');assert.equal(parseText('Такси 430 рублей').amount,43000);assert.notEqual(parseText('Купил продукты за 850 рублей вчера').date,parseText('Купил продукты за 850 рублей').date);});
