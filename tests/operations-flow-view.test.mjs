import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeOperationsFlow} from '../src/operations-flow-view.mjs';

const snapshot=(states,status='open',handovers=[{accepted:true,phase:'accepted'}])=>({
 work:{status},executions:states.map(reportState=>({reportState})),handovers,errors:[],
});

test('완료 보고가 모여도 중앙 미마감과 인수 수락을 별도로 설명한다',()=>{
 const data=snapshot(['ok','ok']),before=structuredClone(data),summary=summarizeOperationsFlow(data);
 assert.match(summary.title,/완료 보고는 모였고.*마감은 남아/);
 assert.equal(summary.central,'미마감');assert.equal(summary.accepted,1);
 assert.deepEqual(data,before);
});

test('실패·일부 보고·완료 미확인을 성공한 실행 수에 합산하지 않는다',()=>{
 const summary=summarizeOperationsFlow(snapshot(['ok','failed','partial','unreported']));
 assert.equal(summary.count.ok,1);assert.equal(summary.total,4);
 assert.match(summary.title,/실패 보고 1개/);
 assert.match(summary.report,/1 \/ 4/);assert.match(summary.reportDetail,/완료 미확인 1개/);
 assert.doesNotMatch(summary.reportDetail,/진행 중|남은 작업/);
});

test('중앙 마감 뒤에도 모르는 실행·인수 상태를 숨기지 않는다',()=>{
 const summary=summarizeOperationsFlow(snapshot(['ok','unknown'],'done',null));
 assert.equal(summary.central,'업무 마감');assert.equal(summary.handover,'인수 상태 모름');
 assert.match(summary.title,/확인하지 못했습니다/);assert.equal(summary.tone,'warning');
});

test('연결 부재는 오류가 아니며 수락 기록으로 전환 완료를 추정하지 않는다',()=>{
 const empty=summarizeOperationsFlow(snapshot([],'open',[]));
 assert.equal(empty.tone,'neutral');assert.equal(empty.handover,'인수 연결 미확인');
 const aborted=summarizeOperationsFlow(snapshot(['unreported'],'open',[{accepted:true,phase:'aborted'}]));
 assert.equal(aborted.accepted,1);assert.doesNotMatch(aborted.title+aborted.handover,/인수 완료|전환 완료/);
 const stale=summarizeOperationsFlow(snapshot(['ok'],'open',[{accepted:true,error:'인수 파일 없음'}]));
 assert.equal(stale.handoverUnknown,true);assert.match(stale.title,/확인하지 못했습니다/);
});

test('보류와 취소를 마감 대기 또는 실패로 바꾸지 않는다',()=>{
 for(const [status,text] of [['hold','보류'],['cancelled','취소']]){
  const summary=summarizeOperationsFlow(snapshot(['ok'],status));
  assert.match(summary.title,new RegExp(text));assert.equal(summary.tone,'neutral');
  assert.doesNotMatch(summary.title,/마감은 남아|실패/);
 }
});
