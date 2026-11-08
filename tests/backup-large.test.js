import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../domain.js';
import {encryptBackup, decryptBackup} from '../backup.js';

test('large encrypted backup roundtrips with standard Base64', async () => {
  const value = fresh();
  value.accounts.push({id:'a', name:'Карта', currency:'RUB', type:'debit', initial:0});
  for (let i = 0; i < 1200; i++) {
    value.transactions.push({
      id:`tx-${i}`, type:'expense', date:'2026-10-30',
      categoryId:value.categories[0].id,
      splits:[{accountId:'a', amount:-100}],
      note:`Операция ${i}: ${'покупка 🛒 '.repeat(30)}`
    });
  }
  assert.ok(new TextEncoder().encode(JSON.stringify(value)).length > 500_000);
  const password = 'надёжный пароль 123';
  const encrypted = await encryptBackup(value, password);
  assert.ok(encrypted.data.length > 500_000);
  assert.equal(Buffer.from(encrypted.data, 'base64').toString('base64'), encrypted.data);
  assert.deepEqual(await decryptBackup(encrypted, password), value);
  await assert.rejects(decryptBackup(encrypted, 'неверный пароль'), /Неверный пароль/);
});
