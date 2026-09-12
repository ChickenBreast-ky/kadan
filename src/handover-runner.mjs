// 인수와 watch 반영만 유한 대기한다. 작업 카드의 승인/시한을 바꾸지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runnerFile = fileURLToPath(import.meta.url);
const terminal = new Set(['complete', 'failed', 'timed-out', 'aborted']);
const pidAlive = pid => { try { return Number.isInteger(Number(pid)) && Number(pid) > 0 && (process.kill(Number(pid), 0), true); } catch { return false; } };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function save(file, value) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', {mode:0o600});
  fs.renameSync(tmp, file);
}
function failure(error) {
  return {message:error.message, ...(error.code ? {code:error.code} : {})};
}

export class HandoverRunner {
  constructor(handover, {notify, spawnProcess = spawn} = {}) {
    this.h = handover; this.notify = notify; this.spawnProcess = spawnProcess;
  }
  paths(id) {
    const dir = this.h.file(id).replace(/\.json$/, '.runner');
    return {dir, config:path.join(dir, 'config.json'), result:path.join(dir, 'result.json'),
      owner:path.join(dir, 'owner.json'), pid:path.join(dir, 'pid.json')};
  }
  prepare(from, {waitTimeout = 1800, notify = this.h.env.KADAN_ROLE || '비서'} = {}) {
    if (this.h.env.KADAN_ROLE === from) throw new Error('선임 자기 종료 금지: 외부 지휘자가 자동 인계를 시작하거나 --manual 사용');
    const started = this.h.now(), deadline = started + waitTimeout * 1000;
    if (typeof waitTimeout !== 'number' || !Number.isFinite(waitTimeout) || waitTimeout <= 0 || !Number.isFinite(deadline) || deadline > 8.64e15)
      throw new Error('wait-timeout은 양의 유한 초: 인수와 watch 전체 대기 상한');
    if (typeof notify !== 'string' || !/^(?:@user|[\p{L}\p{N}_-]+)$/u.test(notify)) throw new Error('유효한 --notify 수신자 필요');
    const target = {role:notify, transport:notify === '비서' ? 'mailbox' : notify === '@user' ? 'user' : 'session'};
    if (target.transport === 'session') {
      const start = this.h.lastStart(notify);
      const pid = start?.panePid ?? start?.rottiePid;
      if (pid == null) throw new Error('최종 수신자 start/PID 기록 없음');
      this.h.identity(notify, pid); target.pid = String(pid);
    }
    return {initiator:this.h.env.KADAN_ROLE || '', target, waitTimeout,
      startedAt:new Date(started).toISOString(), deadlineAt:new Date(deadline).toISOString()};
  }
  start(id, config) {
    const s = this.h.status(id), p = this.paths(id);
    if (config.initiator === s.from) throw new Error('선임 자기 종료 금지');
    if (s.phase !== 'prepared' || s.error) throw new Error(`자동 인계 시작 불가: ${s.phase}`);
    try { fs.mkdirSync(p.dir, {mode:0o700}); } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      throw new Error(`인계 runner가 이미 예약/실행됨: ${id}; status 확인, 잠금 자동 회수 없음`);
    }
    save(p.config, {...config, id});
    save(p.result, {id, status:'starting', phase:s.phase, pid:null,
      startedAt:config.startedAt, deadlineAt:config.deadlineAt,
      notification:{status:'not-attempted', recipient:config.target.role, ...(config.target.pid ? {pid:config.target.pid} : {})}});
    // argv에는 ID만, 환경은 상속한다. 파이프/IPC를 남기지 않아 부모 종료와 독립이다.
    try {
      const child = this.spawnProcess(process.execPath, [runnerFile, id], {
        detached:true, stdio:'ignore', cwd:this.h.home,
        env:{...this.h.env, KADAN_HOME:this.h.home},
      });
      child.once('error', error => this.launchFailed(id, error));
      if (!child.pid) throw new Error('runner 프로세스 생성 실패: PID 없음');
      save(p.pid, {pid:child.pid});
      child.unref();
    } catch (error) {
      this.launchFailed(id, error);
      throw new Error(`인계 ${id} runner 시작 실패; 결과: ${p.result}`);
    }
    const result = this.status(id);
    if (result.runner.pidAlive && ['starting','waiting-accept','waiting-watch'].includes(result.runner.status))
      result.nextAction = '별도 프로그램이 후임 인수와 전환을 이어갑니다. 상태를 반복 조회하지 말고 응답을 끝내세요. 완료/문제는 지정 수신자에게 1회 통지됩니다.';
    return result;
  }
  launchFailed(id, error) {
    const p = this.paths(id);
    // 비동기 spawn error도 영속한다. 이미 실행된 runner의 결과를 덮지 않는다.
    if (fs.existsSync(p.owner)) return;
    const result = read(p.result);
    if (result.status === 'failed') return;
    result.status = 'failed'; result.failureStage = 'launch'; result.error = failure(error);
    result.endedAt = new Date(this.h.now()).toISOString();
    save(p.result, result);
    this.deliver(id, read(p.config), result);
  }
  status(id) {
    const s = this.h.status(id), p = this.paths(id);
    // 전체 관계표/실행 명령은 보존 파일에서만 읽는다.
    const {originalHierarchy, command, ...summary} = s;
    summary.statePath = this.h.file(id);
    if (!fs.existsSync(p.dir)) return {...summary, runner:null};
    let result;
    try { result = read(p.result); } catch (error) { result = {status:'unknown', error:failure(error)}; }
    const pid = result.pid ?? (fs.existsSync(p.pid) ? read(p.pid).pid : null);
    const alive = pidAlive(pid);
    summary.runner = {...result, pid, pidAlive:alive, resultPath:p.result};
    if (!terminal.has(result.status) && pid && !alive) summary.runner.status = 'interrupted';
    if (result.notification?.status === 'sending' && !alive)
      summary.runner.notification = {...result.notification, status:'unknown', delivery:'unknown'};
    return summary;
  }
  run(id) {
    const p = this.paths(id), config = read(p.config);
    const result = read(p.result);
    if (terminal.has(result.status)) throw new Error(`인계 runner 종결/중복 실행 금지: ${id}`);
    // 이 파일은 종료 후에도 보존한다. 중복 실행과 불확실 송신의 재시도를 막는다.
    try { fs.writeFileSync(p.owner, JSON.stringify({pid:process.pid}), {flag:'wx', mode:0o600}); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      throw new Error(`인계 runner 중복 실행 금지: ${id}; owner 보존`);
    }
    result.pid = process.pid;
    // source 자기종료 제한은 detached 프로세스에서도 원래 호출자 기준이다.
    this.h.env = {...this.h.env, KADAN_ROLE:config.initiator};
    try {
      let lastStatus;
      while (true) {
        const s = this.h.status(id);
        result.phase = s.phase;
        if (s.from === config.initiator) throw new Error('선임 자기 종료 금지');
        if (s.phase === 'complete' || s.phase === 'aborted') { result.status = s.phase; break; }
        if (!['prepared','accepted','routes-pending'].includes(s.phase) || s.error)
          throw new Error(`자동 재실행 불가: ${s.phase}; 현재 상태에서 수동 복구 필요`);
        if (this.h.now() >= Date.parse(config.deadlineAt)) {
          result.status = 'timed-out'; result.error = {code:'HANDOVER_WAIT_TIMEOUT', message:'인수/watch 대기 상한 도달; 선임 보존, 수동 복구 가능'}; break;
        }
        this.h.identity(s.to, s.newPid); this.h.sourceIdentity(s);
        result.status = s.phase === 'prepared' ? 'waiting-accept' : 'waiting-watch';
        if (lastStatus !== result.status) { save(p.result, result); lastStatus = result.status; }
        if (s.phase !== 'prepared') {
          try {
            const next = this.h.finish(id, {timeout:0});
            const changed = result.phase !== next.phase || Boolean(result.waiting);
            delete result.waiting;
            result.phase = next.phase;
            if (next.phase === 'complete') { result.status = 'complete'; result.childNotices = next.childNotices; break; }
            if (changed) save(p.result, result);
          } catch (error) {
            // 알려진 짧은 호출 경합만 전체 상한 안에서 대기. stale lock도 강제 제거하지 않는다.
            if (error.code !== 'HANDOVER_LOCKED') throw error;
            if (result.waiting !== error.message) { result.waiting = error.message; save(p.result, result); }
          }
        }
        this.h.sleep(Math.min(1000, Math.max(0, Date.parse(config.deadlineAt) - this.h.now())));
      }
    } catch (error) {
      result.status = 'failed'; result.error = failure(error);
      try { result.phase = this.h.status(id).phase; } catch { /* 마지막 확인 상태 보존 */ }
    }
    result.endedAt = new Date(this.h.now()).toISOString();
    save(p.result, result);
    this.deliver(id, config, result);
    return result;
  }
  deliver(id, config, result) {
    const p = this.paths(id);
    if (result.notification.status !== 'not-attempted') return;
    result.notification = {status:'sending', recipient:config.target.role,
      ...(config.target.pid ? {pid:config.target.pid} : {}), attemptedAt:new Date(this.h.now()).toISOString()};
    save(p.result, result); // 전송 전에 표시: 이후 중단되면 unknown이며 재전송하지 않는다.
    try {
      const receipt = this.notify(config.target,
        `인계 프로그램 종결: ${id}. ${result.status}; 인계 상태 ${result.phase}. 결과: ${p.result}`);
      result.notification = {...result.notification, status:receipt?.status || 'sent', delivery:'sent',
        ...(receipt?.mailId ? {mailId:receipt.mailId} : {})};
    } catch (error) {
      result.notification = {...result.notification, status:'failed', delivery:error.delivery || 'unknown', error:failure(error)};
    }
    save(p.result, result);
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(runnerFile)) {
  // 동적 import 실패도 ID에 연결해 남긴다. stdout/stderr에 환경/오류 원문을 흘리지 않는다.
  let imported = false;
  import('./cli.mjs').then(({createHandoverRunner}) => {
    imported = true;
    const result = createHandoverRunner().run(process.argv[2]);
    process.exitCode = result.status === 'complete' && ['sent','stored'].includes(result.notification.status) ? 0 : 1;
  }).catch(error => {
    const id = process.argv[2];
    if (/^[a-f0-9-]{36}$/.test(id) && (process.env.KADAN_HOME||process.env.KADAN_LITE_HOME)) {
      const dir = path.join(process.env.KADAN_HOME||process.env.KADAN_LITE_HOME, 'handovers', `${id}.runner`);
      // 중복 호출은 첫 실행의 파일에 손대지 않는다.
      if (!fs.existsSync(path.join(dir, 'owner.json'))) {
        try {
          const file = path.join(dir, 'result.json'), result = read(file);
          if (result.status === 'starting') {
            save(file, {...result, status:'failed', failureStage:imported ? 'runner-start' : 'bootstrap-import',
              error:failure(error), endedAt:new Date().toISOString(),
              notification:{status:'not-attempted', reason:'runner 초기화 실패: 통지 기능을 실행하지 못함'}});
          }
        } catch { /* 저장 불가를 성공으로 출력하지 않는다. */ }
      }
    }
    process.exitCode = 1;
  });
}
