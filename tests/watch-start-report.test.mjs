import test from 'node:test';import assert from 'node:assert/strict';
import {assessMissingStartReports} from '../src/watch-start-report.mjs';
const at='2026-09-07T00:00:00Z',now=Date.parse(at)+6*60000,grace=5*60000;
const c={id:'c',key:'r/c',status:'assigned',role:'worker'},send={kind:'send',role:'worker',taskId:'c',t:at};
const seen=new Map([['kadan-worker',{alive:true,pid:'1',expectedPid:'1',digest:'x',screen:'working'}]]);
test('시작 보고 누락은 유예 이후에만 해당 역할·발령에 알리며 오래된 시작보고/다른 역할 완료는 무관',()=>{
 const check=(cards=[c],rows=[send],time=now)=>assessMissingStartReports(cards,rows,seen,time,grace);
 assert.equal(check([c],[send],Date.parse(at)+60000).length,0);assert.equal(check().length,1);
 assert.equal(check([{...c,activity:'running',activityRole:'worker',activityAt:at}]).length,0);
 assert.equal(check([{...c,activity:'waiting',activityRole:'worker',activityAt:at}]).length,0);
 assert.equal(check([{...c,activity:'running',activityRole:'other',activityAt:at}]).length,1);
 assert.equal(check([{...c,activity:'running',activityRole:'worker',activityAt:'2026-09-06T00:00:00Z'}]).length,1);
 assert.equal(check([c],[send,{kind:'done',role:'worker',taskId:'c'}]).length,0);
 assert.equal(check([c],[send,{kind:'done',role:'other',taskId:'c'}]).length,1);
 assert.equal(check([{...c,status:'hold'}]).length,0);assert.equal(check([c,{...c,key:'r2/c'}]).length,0);
 assert.equal(assessMissingStartReports([c],[send],new Map(),now,grace).length,0);
 assert.equal(assessMissingStartReports([c],[send],new Map([['kadan-worker',{...seen.get('kadan-worker'),screen:'KADAN:DONE c ok'}]]),now,grace).length,0);
});
test('무변화 시간 충족 후에만 AI 호출하고 같은 후보는 재판정 간격을 지킨다',async()=>{
 const {eligibleStallAlerts,judgeStallAlerts}=await import('../src/watch-judge.mjs');
 const a={id:'stall:kadan-worker',session:'kadan-worker',role:'worker',kind:'정체',level:'AMBER'};
 assert.equal(eligibleStallAlerts([a],new Map([[a.session,{unchangedMs:299999}]]),300000).length,0);
 const alerts=eligibleStallAlerts([a],new Map([[a.session,{unchangedMs:300000}]]),300000);assert.equal(alerts.length,1);
 let calls=0;const options={alerts,observations:new Map([[a.session,{screen:'wait'}]]),judgeStates:new Map(),judgeCmd:'fake',cooldownMs:300000,spawn:()=>{calls++;return{status:0,stdout:'입력대기'};}};
 assert.equal(judgeStallAlerts({...options,now:300000}).length,0);judgeStallAlerts({...options,now:400000});assert.equal(calls,1);judgeStallAlerts({...options,now:600000});assert.equal(calls,2);
});
test('감시 루프는 누락을 직속 감독에게 한 번 알리고 시작 보고 후 한 번 해소한다',async()=>{
 const {runWatch}=await import('./helpers/watch-runner.mjs');let cycle=0;const messages=[],records=[],end=new Error('end');
 const starts=['worker','boss'].map((role,i)=>({kind:'start',role,session:'kadan-'+role,panePid:String(i+1),t:at}));
 await assert.rejects(()=>runWatch({floor:{list:()=>starts.map(s=>({session:s.session,pid:s.panePid})),read:()=> 'working'},readEntries:()=>[...starts,send],readCards:()=>[{...c,...(cycle>=2?{activity:'running',activityRole:'worker',activityAt:new Date(now).toISOString()}:{})}],startReportGraceMs:grace,intervalMs:1000,stallN:100,parents:new Map([['worker','boss'],['boss','@user']]),routes:new Map(),superRole:'boss',now:()=>now+cycle*1000,record:r=>records.push(r),sendAlert:(role,text)=>messages.push({role,text}),print:()=>{},spawn:cmd=>{if(cmd==='sleep'&&++cycle===3)throw end;if(cmd==='memory_pressure')return{status:0,stdout:'System-wide memory free percentage: 80%'};if(cmd==='sysctl')return{status:0,stdout:'used = 0M'};return{status:0,stdout:''};}}),e=>e===end);
 const related=records.filter(r=>r.alertKind==='시작보고누락');assert.equal(related.length,2);assert.equal(related[0].recipient,'boss');assert.equal(related[0].delivered,true);assert.equal(related[1].resolved,true);
});
