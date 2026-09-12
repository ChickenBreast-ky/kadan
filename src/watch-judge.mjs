import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  applyJudgeVerdict,
  buildJudgeInput,
  judgeDue,
  parseJudgeVerdict,
} from "./watch.mjs";

// 예전 공개 함수 호환용. 실제 kadan watch는 WatchAI/watch-report 경로만 사용한다.
export function executeJudge(command, input, spawn = spawnSync) {
  return executeJudgeResult(command, input, spawn).verdict;
}

const digest = value => createHash('sha256').update(value).digest('hex');

export function executeJudgeResult(command, input, spawn = spawnSync) {
  const startedAt = Date.now();
  let result;
  try {
    result = spawn(command, {
      shell: true,
      input,
      encoding: "utf8",
      timeout: 90_000,
    });
  } catch (error) {
    result = {error};
  }
  const stdout = String(result.stdout ?? '');
  const stderr = String(result.stderr ?? '');
  const parsed = parseJudgeVerdict(stdout);
  const reason = result.error?.code === 'ETIMEDOUT' ? 'timeout'
    : result.error || result.status !== 0 ? 'call-failed'
    : stdout.trim() === '모름' ? 'ai-unknown'
    : parsed === '모름' ? 'invalid-output' : 'ok';
  return {
    verdict: reason === 'ok' ? parsed : '모름', reason,
    inputDigest:digest(input ?? ''), outputDigest:digest(stdout),
    outputBytes:Buffer.byteLength(stdout),
    // 자유 응답/에러 원문은 원장에 복제하지 않는다.
    response:/^(?:\[[^\]]+\] )?(?:진행중|입력대기|정체|죽음|모름)$/u.test(stdout.trim()) ? stdout.trim() : null,
    exitCode:Number.isInteger(result.status) ? result.status : null,
    signal:result.signal ?? null, durationMs:Date.now()-startedAt,
    model:stderr.match(/^KADAN_JUDGE_MODEL=([\w./-]+)$/mu)?.[1] ?? null,
    evidencePath:stderr.match(/^KADAN_JUDGE_LOG_DIR=(\/[^\r\n]+)$/mu)?.[1] ?? null,
  };
}

export function judgeStallAlerts({
  alerts,
  observations,
  judgeStates,
  judgeCmd,
  now,
  cooldownMs,
  spawn,
  record = () => {},
}) {
  const verdicts = new Map();
  for (const alert of alerts) {
    if (!alert.id.startsWith("stall:")) continue;
    let judged = judgeStates.get(alert.session);
    if (judgeDue(judged?.at, now, cooldownMs)) {
      const screen = observations.get(alert.session)?.screen ?? "";
      judged = {
        at: now,
        ...executeJudgeResult(judgeCmd, buildJudgeInput(screen), spawn),
      };
      judgeStates.set(alert.session, judged);
      try {
        record({kind:'watch-judgment',by:'watch',role:alert.role,session:alert.session,...judged});
      } catch { console.error('감시AI 판정 기록 실패'); }
    }
    verdicts.set(alert.session, judged.verdict);
  }
  return applyJudgeVerdict(alerts, verdicts).map(alert => alert.judgeVerdict ? {
    ...alert, judgeReason:judgeStates.get(alert.session)?.reason,
  } : alert);
}

export function eligibleStallAlerts(alerts,states,afterMs){
 return alerts.filter(a=>!a.id.startsWith('stall:')||(states.get(a.session)?.unchangedMs??0)>=afterMs);
}
