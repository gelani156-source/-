import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestCategory,fresh} from '../domain.js';
for(const [note,type,name] of [
 ['Пятёрочка 1200','expense','Продукты'],
 ['Кофейня 450','expense','Кафе'],
 ['Тренажерный зал абонемент','expense','Спорт'],
 ['Авиабилет Иркутск Москва','expense','Поездки'],
 ['АЗС 1500','expense','Транспорт'],
 ['Зарплата за октябрь','income','Зарплата'],
 ['Вернул долг','income','Возврат долга']
])test(`category suggestion ${note}`,()=>assert.equal(suggestCategory(note,type)?.name,name));
test('avoid guessing unknown descriptions',()=>assert.equal(suggestCategory('Перевод 400','expense'),null));
test('starter categories have sport and travel',()=>{const names=fresh().categories.map(c=>c.name);assert.ok(names.includes('Спорт')&&names.includes('Поездки'))});
