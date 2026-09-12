import test from 'node:test';
import assert from 'node:assert/strict';
import {ProgressWatch} from '../src/watch-progress.mjs';
const minute=60_000;
function fixture(){const card={key:'p/a',id:'a',status:'assigned',workType:'execution',activity:'running',role:'p-작업자',title:'제품 등록'};const args={cards:[card],entries:[{kind:'send',role:card.role,taskId:'a'}],observations:new Map([['kadan-p-작업자',{alive:true,pid:1,expectedPid:1,screen:'failure attempt 1'}]]),now:0,enabled:true};return {w:new ProgressWatch(),args,card};}
test('움직이는 화면도 30분에 비교 자료를 한 번 만들며 직접 판정·발송하지 않는다',()=>{
 const f=fixture();assert.equal(f.w.select(f.args),null);f.args.now=29*minute;f.args.observations.get('kadan-p-작업자').screen='attempt 8';assert.equal(f.w.select(f.args),null);
 f.args.now=30*minute;const request=f.w.select(f.args);assert.equal(request.source,'progress');assert.equal(request.input.previous,'failure attempt 1');assert.equal(request.input.current,'attempt 8');assert.equal(request.taskId,'a');assert.equal(request.verdict,undefined);
 f.w.started(request.session,request.input.current,f.args.now);
 f.args.now=31*minute;assert.equal(f.w.select(f.args),null);f.args.now=60*minute;assert(f.w.select(f.args));
});
test('결과 대기·조율·완료·슈퍼·PID 불일치·실행 완료·AI 미설정은 제외한다',()=>{
 for(const modify of [f=>f.card.activity='waiting',f=>f.card.workType='coordination',f=>f.card.status='done',f=>f.card.role='p-슈퍼감독-2',f=>f.args.observations.get('kadan-p-작업자').pid=2,f=>f.args.entries.push({kind:'done',role:f.card.role,taskId:'a'}),f=>f.args.enabled=false]){
 const f=fixture();modify(f);f.w.select(f.args);f.args.now=90*minute;assert.equal(f.w.select(f.args),null);
 }
});
test('한 주기 한 대상, 정체 후보 우선, 재시작은 새 관찰부터',()=>{
 const f=fixture();f.args.cards.push({...f.card,key:'p/b',id:'b'});f.args.entries.push({kind:'send',role:f.card.role,taskId:'b'});f.w.select(f.args);f.args.now=30*minute;f.args.blockedSessions=new Set(['kadan-p-작업자']);assert.equal(f.w.select(f.args),null);f.args.blockedSessions.clear();assert(f.w.select(f.args));f.w.started('kadan-p-작업자','현재 화면',f.args.now);assert.equal(f.w.select(f.args),null);assert.equal(new ProgressWatch().select(f.args),null);
});
