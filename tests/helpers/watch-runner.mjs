import {setImmediate} from 'node:timers/promises';
import {runWatch as run} from '../../src/watch-runner.mjs';

// 기존 가짜 시계 시험은 sleep 명령에서 회차를 넘긴다. AI 완료도 회차 사이에 처리한다.
export function runWatch(options) {
  return run({...options,sleep:async ms=>{
    await setImmediate();
    options.spawn('sleep',[String(ms/1000)]);
  }});
}
