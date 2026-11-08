import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function download('),source.indexOf('function checkBackup('));
assert.ok(code.startsWith('async function download(')&&code.includes('async function secureBackup('));
function harness({size=1,answers=[]}={}){
  const state={settings:{lastBackup:'2000-01-01T00:00:00.000Z'}};
  let callback,clicks=0,renders=0,changes=0;
  const prompts=[],messages=[];
  const context={state,Blob,Date,JSON,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
    document:{createElement:()=>({click(){clicks++;}})},setTimeout(){},
    confirm:msg=>{prompts.push(msg);return answers.shift()??false;},
    D:{today:()=> '2026-11-08'},backupSnapshot:()=>({settings:{...state.settings},data:'x'.repeat(size)}),
    backupSummary(){},encryptBackup:async()=>({data:'x'.repeat(size)}),
    modal:(title,html,fn)=>{callback=fn;},field:()=>'',saveButton:()=>'',close(){},
    change:async fn=>{changes++;fn(state);},render:()=>{renders++;},toast:msg=>messages.push(msg)};
  vm.runInNewContext(code,context);
  return {context,state,prompts,messages,get clicks(){return clicks;},get changes(){return changes;},get renders(){return renders;},
    async secure(){await context.secureBackup();await callback({get:()=> 'password123'});}};
}
for(const kind of ['plain','secure']){
  test(`${kind}: emergency download never confirms or updates lastBackup`,async()=>{
    const h=harness({size:20*1024*1024,answers:[true,true]});
    await (kind==='plain'?h.context.backup():h.secure());
    assert.equal(h.clicks,1);assert.equal(h.prompts.length,1);assert.equal(h.changes,0);
    assert.equal(h.state.settings.lastBackup,'2000-01-01T00:00:00.000Z');
    const reminder=source.match(/\$\{(state\.settings\.backupReminderDays!==0&&\([^\n]+?\))\?`<div class="stack2-alert"/);
    assert.ok(reminder,'actual reminder predicate exists');
    assert.equal(vm.runInNewContext(reminder[1],{state:h.state,Date}),true);
    assert.match(h.messages.at(-1),/напоминание/);
  });
  test(`${kind}: cancelling emergency download does not update lastBackup`,async()=>{
    const h=harness({size:20*1024*1024,answers:[false]});
    await (kind==='plain'?h.context.backup():h.secure());
    assert.equal(h.clicks,0);assert.equal(h.changes,0);assert.equal(h.prompts.length,1);
  });
  for(const confirmed of [false,true])test(`${kind}: normal download, confirmation ${confirmed}`,async()=>{
    const h=harness({answers:[confirmed]});await (kind==='plain'?h.context.backup():h.secure());
    assert.equal(h.clicks,1);assert.equal(h.prompts.length,1);assert.equal(h.changes,confirmed?1:0);
    assert.equal(h.state.settings.lastBackup==='2000-01-01T00:00:00.000Z',!confirmed);
  });
}
test('20 MiB boundary uses UTF-8 blob size',async()=>{
  const h=harness({answers:[true]});
  assert.equal(await h.context.download('x'.repeat(20*1024*1024),'limit.json'),'downloaded');
  assert.equal(h.prompts.length,0);
  assert.equal(await h.context.download('x'.repeat(20*1024*1024-1)+'я','large.json'),'emergency');
  assert.equal(h.prompts.length,1);
});
