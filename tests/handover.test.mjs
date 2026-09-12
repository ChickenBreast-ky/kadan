import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Handover } from '../src/handover.mjs';
import { openTaskIds, workEntries } from '../src/handover-state.mjs';
import { buildTree, guardedSend } from '../src/cli.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
function fixture(options={}) {
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'kadan-handover-'));
 const hierarchy=path.join(home,'parents.json'),context=path.join(home,'context.md');
 fs.writeFileSync(hierarchy,JSON.stringify({'p-감독':'@user','p-작업자':'p-감독','else-감독':'@user'}));
 fs.writeFileSync(context,'승인된 범위와 현재 카드');
 const rows=[{kind:'start',role:'p-감독',session:'kadan-p-감독',panePid:10,floor:'tmux',cmd:'codex',cwd:home},
  {kind:'send',role:'p-감독',session:'kadan-p-감독',taskId:'card-a',by:'사람'},
  {kind:'send',role:'p-작업자',session:'kadan-p-작업자',taskId:'card-b',by:'p-감독'}];
 const live=new Map([['kadan-p-감독',10],['kadan-p-작업자',20]]);
 const sends=[],stops=[];const env={KADAN_ROLE:'비서'};
 const h=new Handover({home,env,readEntries:()=>rows,record:e=>rows.push(e),watchAlive:()=>true,
  floor:{name:'tmux',alive:s=>live.has(s),pid:s=>live.get(s),stop:s=>{stops.push(s);if(!options.stopFails)live.delete(s)}},
  start:(role,cmd,cwd)=>{if(options.startFails)throw new Error('start failed');live.set(`kadan-${role}`,30);rows.push({kind:'start',role,session:`kadan-${role}`,panePid:30,cmd,cwd})},
  send:(role,message)=>{sends.push({role,message});if(options.activationFails&&message.startsWith('인계 전환'))throw new Error('send uncertain')}
 });
 const begin=()=>h.begin('p-감독',{to:'p-감독-2',hierarchy,context,atBoundary:true});
 const accept=s=>{env.KADAN_ROLE=s.to;const r=path.join(home,'receipt.json');fs.writeFileSync(r,JSON.stringify({taskIds:s.taskIds,evidencePaths:[context],nextAction:'기존 card-a 확인 후 card-b 검수'}));return h.accept(s.id,r)};
 const loaded=s=>rows.push({kind:'hierarchy-loaded',path:hierarchy,hash:sha(fs.readFileSync(hierarchy)),pid:100});
 return {h,home,hierarchy,context,rows,live,sends,stops,env,begin,accept,loaded};
}
test('09-07 후임 생성/인수만으로 선임 종료하지 않는다; watch 확인 뒤 카드와 하위 관계를 이전한다',()=>{
 const f=fixture();const s=f.begin();assert.equal(s.phase,'prepared');assert.equal(f.stops.length,0);
 assert.throws(()=>f.h.finish(s.id,{timeout:0}),/인수 확인/);
 f.accept(s);f.env.KADAN_ROLE='비서';assert.equal(f.h.finish(s.id,{timeout:0}).phase,'routes-pending');assert.equal(f.stops.length,0);
 f.loaded(s);const result=f.h.finish(s.id,{timeout:0});assert.equal(result.phase,'complete');
 assert.deepEqual(f.stops,['kadan-p-감독']);assert.equal(f.live.get('kadan-p-작업자'),20);
 const graph=JSON.parse(fs.readFileSync(f.hierarchy));assert.equal(graph['p-작업자'],'p-감독-2');assert.equal(graph['else-감독'],'@user');
 assert.deepEqual(openTaskIds(f.rows,'p-감독'),[]);assert.deepEqual(openTaskIds(f.rows,'p-감독-2'),['card-a']);
 assert.equal(f.rows.find(e=>e.kind==='send'&&e.taskId==='card-a').role,'p-감독');
 assert.equal(workEntries(f.rows).find(e=>e.kind==='send'&&e.taskId==='card-a').by,'사람');
 const tree=buildTree(f.rows,Object.fromEntries([...f.live].map(([s,pid])=>[s,{pid}])));
 const roles=tree.flatMap(b=>b.roles);assert.deepEqual(roles.find(r=>r.role==='p-감독').cards,[]);
 assert.equal(roles.find(r=>r.role==='p-감독-2').cards[0].taskId,'card-a');
 const count=f.sends.length;f.h.finish(s.id);assert.equal(f.sends.length,count);assert.equal(f.stops.length,1);
});
test('09-07 생성 실패/사용중 후임/경계 미확인은 선임을 보존한다',()=>{
 const f=fixture({startFails:true});assert.throws(f.begin,/선임 보존/);assert.equal(f.stops.length,0);
 const g=fixture();g.begin();assert.throws(g.begin,/사용 중|과거 사용/);
 assert.throws(()=>g.h.begin('p-감독',{to:'p-new'}),/at-boundary/);
});
test('09-07 다른 역할의 accept와 PID 바뀐 후임, 빈 근거를 거부한다',()=>{
 const f=fixture();const s=f.begin();assert.throws(()=>f.h.accept(s.id,'/tmp/no'),/지정 후임/);
 f.live.set('kadan-p-감독-2',31);assert.throws(()=>f.accept(s),/PID/);assert.equal(f.stops.length,0);
});
test('09-07 준비 이후 새 카드/승인/관계표가 바뀌면 종료하지 않는다',()=>{
 for(const change of ['task','context','graph']){
  const f=fixture();const s=f.begin();f.accept(s);f.env.KADAN_ROLE='비서';
  if(change==='task')f.rows.push({kind:'send',role:'p-감독',taskId:'new'});
  if(change==='context')fs.appendFileSync(f.context,'changed');
  if(change==='graph')fs.appendFileSync(f.hierarchy,' ');
  assert.throws(()=>f.h.finish(s.id,{timeout:0}),/변경/);assert.equal(f.stops.length,0);
 }
});
test('09-07 routes 대기 중 abort는 원래 관계를 복원하고 양쪽 세션을 보존한다',()=>{
 const f=fixture();const s=f.begin();f.accept(s);f.env.KADAN_ROLE='비서';f.h.finish(s.id,{timeout:0});
 assert.equal(f.h.abort(s.id).phase,'aborted');assert.equal(fs.readFileSync(f.hierarchy,'utf8'),s.originalHierarchy);
 assert.equal(f.stops.length,0);assert.ok(f.live.has('kadan-p-감독-2'));
});
test('09-07 선임 자기 종료와 선임 종료실패는 후임 활성화로 넘어가지 않는다',()=>{
 const f=fixture({stopFails:true});const s=f.begin();f.accept(s);f.env.KADAN_ROLE=s.from;
 assert.throws(()=>f.h.finish(s.id,{timeout:0}),/자기 종료/);f.env.KADAN_ROLE='비서';f.h.finish(s.id,{timeout:0});f.loaded(s);
 assert.throws(()=>f.h.finish(s.id,{timeout:0}),/종료 미확인/);assert.ok(!f.sends.some(x=>x.message.startsWith('인계 전환 완료')));
});
test('09-07 활성화 전송 불확실은 반복 finish로 중복 전송하지 않는다',()=>{
 const f=fixture({activationFails:true});const s=f.begin();f.accept(s);f.env.KADAN_ROLE='비서';f.h.finish(s.id,{timeout:0});f.loaded(s);
 assert.throws(()=>f.h.finish(s.id,{timeout:0}),/uncertain/);const n=f.sends.length;
 assert.throws(()=>f.h.finish(s.id),/activation-pending/);assert.equal(f.sends.length,n);
});
test('09-07 반복 인계와 같은 카드ID의 다른 역할 책임을 분리한다',()=>{
 const rows=[{kind:'send',role:'a',session:'kadan-a',taskId:'x'}, {kind:'send',role:'b',taskId:'x'},
  {kind:'handover',phase:'transferred',from:'a',to:'c',taskIds:['x']},
  {kind:'handover',phase:'transferred',from:'c',to:'d',taskIds:['x']},{kind:'done',role:'b',taskId:'x'}];
 assert.deepEqual(openTaskIds(rows,'d'),['x']);assert.deepEqual(openTaskIds(rows,'a'),[]);
});

for(const stage of ['prepare','activate']) test(`후임 ${stage} 직전 PID 교체는 새 세대로 전달하지 않는다`,()=>{
 const f=fixture();let attempts=0;
 const guarded=(role,message,expectedPid)=>{
  if((stage==='prepare'&&message.startsWith('인수 준비'))||(stage==='activate'&&message.startsWith('인계 전환 완료'))){
   assert.equal(expectedPid,'30');f.live.set(`kadan-${role}`,31);
  }
  guardedSend({floor:{...f.h.floor,pid:s=>String(f.live.get(s)),send:()=>{attempts++;}},
   session:`kadan-${role}`,role,message,recordedPid:expectedPid,env:{KADAN_HOME:f.home},
   readEntries:()=>f.rows,record:e=>f.rows.push(e),saveBody:()=>{}});
 };
 f.h.send=guarded;
 if(stage==='prepare'){
  assert.throws(f.begin,/다른 프로세스/);assert.equal(attempts,0);assert.equal(f.stops.length,0);
 }else{
  const s=f.begin();f.accept(s);f.env.KADAN_ROLE='비서';f.h.finish(s.id,{timeout:0});f.loaded(s);
  assert.throws(()=>f.h.finish(s.id,{timeout:0}),/다른 프로세스/);
  assert.equal(attempts,1);assert.equal(f.h.status(s.id).phase,'activation-pending');
 }
});

test('명시 종료 선임 복구: 과거 시작 기록으로 인계하고 하위는 유지',()=>{
 const f=fixture(); f.live.delete('kadan-p-감독');
 assert.throws(f.begin,/생존/);
 const s=f.h.begin('p-감독',{to:'p-감독-2',hierarchy:f.hierarchy,context:f.context,atBoundary:true,sourceEnded:true});
 f.accept(s);f.env.KADAN_ROLE='비서';f.h.finish(s.id,{timeout:0});f.loaded(s);
 assert.equal(f.h.finish(s.id,{timeout:0}).phase,'complete');
 assert.equal(f.live.get('kadan-p-작업자'),20);assert.equal(f.stops.length,0);
});
test('종료 선임 옵션은 살아있는 선임이나 다시 나타난 세션을 거부한다',()=>{
 const f=fixture();const opts={to:'p-감독-2',hierarchy:f.hierarchy,context:f.context,atBoundary:true,sourceEnded:true};
 assert.throws(()=>f.h.begin('p-감독',opts),/다시 나타남/);
 f.live.delete('kadan-p-감독');const s=f.h.begin('p-감독',opts);f.accept(s);f.env.KADAN_ROLE='비서';
 f.live.set('kadan-p-감독',99);assert.throws(()=>f.h.finish(s.id,{timeout:0}),/다시 나타남/);assert.equal(f.stops.length,0);
});
