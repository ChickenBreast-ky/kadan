import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import {setImmediate} from 'node:timers/promises';
import {runWatch} from '../src/watch-runner.mjs';

const epoch=Date.parse('2026-09-09T00:00:00Z');
const roles=['w1','w2','w3','boss','top'];
const parents=new Map([['w1','boss'],['w2','boss'],['w3','boss'],['boss','top'],['top','@user']]);
const starts=roles.map((role,i)=>({kind:'start',role,session:'kadan-'+role,panePid:i+1,t:new Date(epoch).toISOString()}));
const cards=roles.slice(0,3).map(role=>({id:role,key:'r/'+role,role,status:'assigned',workType:'execution'}));
const entries=[...starts,...cards.map(c=>({kind:'send',role:c.role,taskId:c.id,t:new Date(epoch).toISOString()}))];
function resources(cmd){return {status:0,stdout:cmd==='memory_pressure'?'System-wide memory free percentage: 80%':cmd==='sysctl'?'used = 0M':''};}

test('AI가 응답하지 않아도 다른 역할의 죽음과 화면 점검은 계속한다',async()=>{
 const controller=new AbortController(),reads=[],messages=[],calls=[];let cycle=0,resourcesRead=0,cancelled=false;
 const old=os.loadavg;os.loadavg=()=>[0,0,0];
 try{await runWatch({signal:controller.signal,intervalMs:1000,stallN:1,parents,routes:new Map(),superRole:'top',
  floor:{list:()=>starts.filter(s=>!(cycle>=2&&s.role==='w2')).map(s=>({session:s.session,pid:s.panePid})),read:session=>{reads.push([cycle,session]);return 'unchanged';}},
  readEntries:()=>entries,readCards:()=>cards,now:()=>epoch+cycle*1000,judgeCmd:'fake',judgeCooldownMs:300_000,
  ai:{reports:{retire:()=>{}},run:({signal,role})=>{calls.push(role);return new Promise(resolve=>signal.addEventListener('abort',()=>{cancelled=true;resolve({ok:false,reason:'cancelled'});},{once:true}));}},
  sendAlert:(role,text)=>messages.push([cycle,role,text]),record:()=>{},print:()=>{},
  spawn:cmd=>{if(cmd==='memory_pressure')resourcesRead++;return resources(cmd);},
  sleep:async()=>{await setImmediate();if(++cycle===5)controller.abort();},
 });}finally{os.loadavg=old;}
 assert.deepEqual(calls,['w1']);assert.equal(cancelled,true);assert.equal(resourcesRead,0);
 assert(reads.some(([c,s])=>c===4&&s==='kadan-w3'));
 assert(messages.some(([c,r,m])=>c===2&&r==='boss'&&m.includes('세션 종료 의심 kadan-w2')));
 assert(!messages.some(([, ,m])=>m.includes('감시AI 점검 필요')));
});

test('AI 대기는 역할별 하나이며 순서를 지키고 시작할 때 최신 화면을 사용한다',async()=>{
 const controller=new AbortController(),calls=[];let cycle=0,running=0,peak=0,finish=null;
 const old=os.loadavg;os.loadavg=()=>[0,0,0];
 try{await runWatch({signal:controller.signal,intervalMs:1000,stallN:1,parents,routes:new Map(),superRole:'top',
  floor:{list:()=>starts.map(s=>({session:s.session,pid:s.panePid})),read:s=>s==='kadan-w2'&&cycle>=2?'fresh w2':'unchanged'},
  readEntries:()=>entries,readCards:()=>cards,now:()=>epoch+cycle*1000,judgeCmd:'fake',judgeCooldownMs:300_000,
  ai:{reports:{retire:()=>{}},run:({role,input,signal})=>{calls.push({role,screen:input.screen});peak=Math.max(peak,++running);
   return new Promise(resolve=>{let done=false;finish=()=>{if(done)return;done=true;running--;resolve({ok:true});};signal.addEventListener('abort',finish,{once:true});});}},
  sendAlert:()=>{},record:()=>{},print:()=>{},spawn:resources,
  sleep:async()=>{if([2,4,6].includes(cycle))finish?.();await setImmediate();if(++cycle===8)controller.abort();},
 });}finally{os.loadavg=old;}
 assert.equal(peak,1);assert.deepEqual(calls.map(c=>c.role),['w1','w2','w3']);
 assert.equal(calls[1].screen,'fresh w2');
});

test('대기 중 완료된 역할은 호출하지 않고 진행 중인 대상의 교대는 그 호출만 취소한다',async()=>{
 const controller=new AbortController(),calls=[],aborted=[],messages=[];let cycle=0;
 const old=os.loadavg;os.loadavg=()=>[0,0,0];
 try{await runWatch({signal:controller.signal,intervalMs:1000,stallN:1,parents,routes:new Map(),superRole:'top',
  floor:{list:()=>starts.map(s=>({session:s.session,pid:s.panePid})),read:()=> 'unchanged'},
  readEntries:()=>entries,readCards:()=>cards.map(c=>({...c,status:cycle>=2&&['w1','w2'].includes(c.role)?'done':'assigned'})),
  now:()=>epoch+cycle*1000,judgeCmd:'fake',judgeCooldownMs:300_000,
  ai:{reports:{retire:()=>{}},run:({role,signal})=>{calls.push(role);return new Promise(resolve=>signal.addEventListener('abort',()=>{aborted.push(role);resolve({ok:false,reason:'cancelled'});},{once:true}));}},
  sendAlert:(...args)=>messages.push(args),record:()=>{},print:()=>{},spawn:resources,
  sleep:async()=>{await setImmediate();if(++cycle===5)controller.abort();},
 });}finally{os.loadavg=old;}
 assert.deepEqual(calls,['w1','w3']);assert.deepEqual(aborted,['w1','w3']);
 assert(!messages.some(([,m])=>m.includes('감시AI 점검 필요')));
});
