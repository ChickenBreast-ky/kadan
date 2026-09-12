// 판정 명령 stdout에 잡음이 섞이면 전부 모름이 된다 — 2026-09-06 실측 흉터.
// 실제 codex는 호출하지 않는다. 가짜 명령으로 stdout 모양만 재현한다.
import test from "node:test";
import assert from "node:assert/strict";
import { executeJudge } from "../src/watch-judge.mjs";

test("판정 명령 출력에 잡음이 섞이면 전 판정이 모름으로 죽는다 — 2026-09-06 실측", () => {
  const noisy = executeJudge(
    "printf 'hook: Stop Completed\n입력대기\ntokens used\n57\n'"
  );
  assert.equal(noisy, "모름");
});

test("낱말만 내보내는 명령은 그대로 인정된다", () => {
  const clean = executeJudge("printf '입력대기'");
  assert.equal(clean, "입력대기");
});

test("종료 코드가 0이 아니면 모름", () => {
  const failed = executeJudge("printf '입력대기'; exit 1");
  assert.equal(failed, "모름");
});
