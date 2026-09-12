import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CardStore} from '../src/card-store.mjs';
import {cardCommand} from '../src/card-command.mjs';

const rally={rallyId:'r1',rallyTitle:'묶음',rallyRound:'1',rallyStep:'implementation'};
function fixture(){
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'kadan-assign-rally-')),store=new CardStore(home);
 const c=store.create({repo:'repo',id:'card-a',repoPath:home,body:'# 카드',by:'감독'});
 return {home,store,c};
}

test('실행 카드는 묶음 정보 없이 수동 발령할 수 없다',()=>{
 const {store,c}=fixture();
 assert.throws(()=>store.update(c.key,{status:'assigned',scope:'로컬',board:'b',role:'r'},{revision:c.revision,note:'배정'}),/묶음 정보/);
});

test('묶음 정보와 함께라면 발령된다 — 작은 작업은 1싸이클 구현 라운드',()=>{
 const {store,c}=fixture();
 const assigned=store.update(c.key,{status:'assigned',scope:'로컬',board:'b',role:'r',...rally},{revision:c.revision,note:'배정'});
 assert.equal(assigned.rallyId,'r1');assert.equal(assigned.rallyRound,'1');assert.equal(assigned.rallyStep,'implementation');
});

test('관리·조율 카드는 묶음 없이 발령할 수 있다',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'kadan-assign-rally-')),store=new CardStore(home);
 const c=store.create({repo:'repo',id:'coord',repoPath:home,body:'# 조율',workType:'coordination',by:'감독'});
 const assigned=store.update(c.key,{status:'assigned',scope:'조율',board:'b',role:'r'},{revision:c.revision,note:'배정'});
 assert.equal(assigned.status,'assigned');
});

test('묶음 없는 기존 발령 카드의 진행 보고·메모는 계속 된다',()=>{
 const {store,c}=fixture();
 const assigned=store.update(c.key,{status:'assigned',scope:'로컬',board:'b',role:'r',...rally},{revision:c.revision,note:'배정'});
 const cleared=store.update(c.key,{rallyId:'',rallyTitle:'',rallyRound:'',rallyStep:''},{revision:assigned.revision,note:'묶음 해제'});
 assert.equal(cleared.rallyId,null);
 const running=store.update(c.key,{activity:'running'},{revision:cleared.revision,by:'r',noteKind:'progress',note:'구현 중'});
 assert.equal(running.activity,'running');
 const noted=store.update(c.key,{}, {revision:running.revision,note:'확인 메모'});
 assert.equal(noted.status,'assigned');
});

test('묶음 없는 카드는 보류 뒤 재발령 때 묶음 정보를 요구한다',()=>{
 const {store,c}=fixture();
 const assigned=store.update(c.key,{status:'assigned',scope:'로컬',board:'b',role:'r',...rally},{revision:c.revision,note:'배정'});
 const cleared=store.update(c.key,{rallyId:'',rallyTitle:'',rallyRound:'',rallyStep:''},{revision:assigned.revision,note:'묶음 해제'});
 const held=store.update(c.key,{status:'hold'},{revision:cleared.revision,note:'보류'});
 assert.throws(()=>store.update(c.key,{status:'assigned',board:'b',role:'r'},{revision:held.revision,note:'재개'}),/묶음 정보/);
});

test('CLI 발령도 같은 요구다 — card update --status assigned',()=>{
 const {home,c}=fixture();
 assert.throws(()=>cardCommand(['update',c.key],{revision:c.revision,status:'assigned',scope:'로컬',board:'b',role:'r',note:'배정'},{home,by:'감독'}),/묶음 정보/);
});
