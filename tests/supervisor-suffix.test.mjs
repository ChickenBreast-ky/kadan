import test from "node:test";
import assert from "node:assert/strict";
import { assessRoles } from "../src/watch.mjs";

function observe(role) {
  const session = `kadan-${role}`;
  const observations = new Map([[session, {
    role, alive: true, pid: 55, expectedPid: 55,
    digest: "unchanged", screen: "waiting",
  }]]);
  let states = new Map();
  const alerts = [];
  for (let cycle = 0; cycle < 5; cycle++) {
    const result = assessRoles(states, observations, 5_000, 5_000, 2);
    states = result.states;
    alerts.push(...result.alerts);
  }
  return { state: states.get(session), alerts };
}

test("슈퍼감독만 무변화 정체에서 제외하고 감독·검수자는 동일 후보로 만든다 (2026-09-07)", () => {
  for (const role of ["슈퍼감독", "p-슈퍼감독", "p-슈퍼감독-2"]) {
    const { state, alerts } = observe(role);
    assert.equal(state.unchangedMs, 20_000, role);
    assert.equal(state.stallCount, 0, role);
    assert.deepEqual(alerts, [], role);
  }
  for (const role of ["p-감독", "검수자", "p-작업자", "p-작업자-감독보조", "p-작업자-슈퍼감독보조"]) {
    const { state, alerts } = observe(role);
    assert.equal(state.stallCount, 4, role);
    assert.equal(alerts.length, 3, role);
    assert.ok(alerts.every((alert) => alert.kind === "정체" &&
      alert.id === `stall:kadan-${role}` && alert.role === role), role);
  }
});

for (const role of ["p-감독-2", "p-검수자-2", "card47-검수자-2"]) {
  test(`${role}도 같은 무변화 정체 후보가 된다 (2026-09-07)`, () => {
    const { state, alerts } = observe(role);
    assert.equal(state.unchangedMs, 20_000, role);
    assert.equal(alerts.length, 3, role);
    assert.equal(state.stallCount, 4, role);
  });
}
