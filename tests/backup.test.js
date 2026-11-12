import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJson, describeBackup, inspectStructure } from '../src/backup-core.mjs';
test('reads valid backup object',()=>assert.deepEqual(parseJson('{"transactions":[]}'),{transactions:[]}));
test('rejects malformed JSON',()=>assert.throws(()=>parseJson('{bad'),/Invalid JSON/));
test('rejects null and scalar backups',()=>assert.throws(()=>parseJson('null'),/Expected/));
test('counts collections without exporting transaction values',()=>{
 const r=describeBackup({transactions:[{id:'x',amount:12345678,memo:'secret note'}],accounts:[{id:'a'}]});
 assert.equal(r.topLevelArrayCounts.transactions,1);
 assert.equal(r.schemaRecognized,false);
 const str=JSON.stringify(r);
 assert.doesNotMatch(str,/12345678|secret note|"x"/);
});
test('redacts credential paths',()=>{
 const str=JSON.stringify(inspectStructure({apiToken:'secret',nested:{password:'p',safe:12}}));
 assert.doesNotMatch(str,/apiToken|password|secret/);
});
test('limits depth and entries',()=>{
 let v={}; for(let i=0;i<100;i++)v={child:v};
 const r=inspectStructure(v,{maxEntries:5}); assert.equal(r.nodes.length,5);assert.equal(r.truncated,true);
});
