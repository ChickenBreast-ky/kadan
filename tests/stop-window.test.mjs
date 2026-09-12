import test from "node:test";
import assert from "node:assert/strict";
import * as cli from "../src/cli.mjs";
import * as tmux from "../src/floor-tmux.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { floor } from "../src/floor.mjs";

const base = { kind: "stop", role: "c57-작업자", session: "kadan-c57-작업자", by: "사람" };
const entry = () => cli.buildStopLedgerEntry({ role: base.role, session: base.session, env: {} });
test("baseline: stop entry retains its existing shape and pending cards", () => {
  assert.deepEqual(entry(), base);
  assert.deepEqual(cli.pendingCardsFor([{ kind: "send", role: base.role, taskId: "pending" }], base.role), ["pending"]);
});

{
  test("stop은 start가 연 로티 탭을 한 번 닫는다 — 역할이 끝나도 빈 탭이 쌓였다(2026-09-05)(card-57)", () => {
    const calls = [];
    const fields = cli.closeStartedWindow({ rottieTerminalId: "owned-tab" }, {
      env: { KADAN_ROTTIE_BIN: "/fake/rottie" }, print() {},
      closeFn: (options) => tmux.closeRottieWindow({ ...options, spawnFn: (...args) => { calls.push(args); return { status: 0 }; } }),
    });
    assert.deepEqual(calls, [["/fake/rottie", ["terminal", "close", "--terminal", "owned-tab", "--json"], { encoding: "utf8" }]]);
    assert.deepEqual({ ...entry(), ...fields }, { ...base, rottieTerminalId: "owned-tab", rottieWindowClosed: true });
  });
  test("close failure is recorded without throw or retry", () => {
    let calls = 0;
    const fields = cli.closeStartedWindow({ rottieTerminalId: "owned-tab" }, {
      env: { KADAN_ROTTIE_BIN: "/fake" }, print() {},
      closeFn: (options) => tmux.closeRottieWindow({ ...options, spawnFn: () => { calls++; return { status: 1, stdout: JSON.stringify({ error: { code: "ROTTIE_INTERNAL", message: "failed" } }) }; } }),
    });
    assert.equal(calls, 1);
    assert.deepEqual({ ...entry(), ...fields }, { ...base, rottieTerminalId: "owned-tab", rottieWindowClosed: false, rottieWindowError: "ROTTIE_INTERNAL" });
  });
  test("missing last-start tab leaves entry unchanged and never closes", () => {
    for (const start of [undefined, {}, { window: "orca-kyle" }]) {
      assert.deepEqual({ ...entry(), ...cli.closeStartedWindow(start, { env: {}, closeFn() { assert.fail("unexpected close"); }, print() { assert.fail("unexpected report"); } }) }, base);
    }
  });
  test("unset binary records skipped close", () => {
    const lines = [];
    const fields = cli.closeStartedWindow({ rottieTerminalId: "owned-tab" }, { env: {}, print: line => lines.push(line), closeFn() { assert.fail("unexpected close"); } });
    assert.equal(lines.length, 1);
    assert.deepEqual(fields, { rottieTerminalId: "owned-tab", rottieWindowClosed: false, rottieWindowError: "KADAN_ROTTIE_BIN 없음" });
  });
  test("close handles non-JSON, spawn errors and thrown errors once", () => {
    for (const result of [{ status: 7, stderr: "bad" }, { status: null, error: Object.assign(new Error("missing"), { code: "ENOENT" }) }, new Error("thrown")]) {
      let calls = 0;
      const closed = tmux.closeRottieWindow({ bin: "/fake", terminalId: "owned", spawnFn() { calls++; if (result instanceof Error) throw result; return result; } });
      assert.equal(calls, 1);
      assert.equal(closed.closed, false);
      assert.ok(closed.message);
      assert.equal(closed.code, result.status === 7 ? 7 : result.error ? "ENOENT" : "ROTTIE_CLOSE_FAILED");
    }
  });
}


test("cmdStop wires last start after floor stop and appends the close receipt", (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "kadan-c57-wiring-"));
  const previous = process.env.KADAN_HOME;
  const bin = process.env.KADAN_ROTTIE_BIN;
  process.env.KADAN_HOME = home;
  delete process.env.KADAN_ROTTIE_BIN;
  t.after(() => {
    if (previous === undefined) delete process.env.KADAN_HOME;
    else process.env.KADAN_HOME = previous;
    if (bin === undefined) delete process.env.KADAN_ROTTIE_BIN;
    else process.env.KADAN_ROTTIE_BIN = bin;
  });
  cli.appendLedger({ kind: "start", role: base.role, session: base.session, rottieTerminalId: "stale" });
  cli.appendLedger({ kind: "start", role: base.role, session: base.session, rottieTerminalId: "latest" });
  let stopped = false;
  t.mock.method(floor, "alive", () => true);
  t.mock.method(floor, "stop", session => { assert.equal(session, base.session); stopped = true; });
  t.mock.method(console, "log", () => { assert.equal(stopped, true); });
  cli.main(["stop", base.role]);
  const rows = cli.readLedger();
  assert.equal(rows.length, 3);
  assert.equal(rows.at(-1).kind, "stop");
  assert.equal(rows.at(-1).rottieTerminalId, "latest");
  assert.equal(rows.at(-1).rottieWindowClosed, false);
  assert.equal(Object.hasOwn(rows.at(-1), "window"), false);
});
