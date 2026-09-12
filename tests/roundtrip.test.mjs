// 실전 왕복 시험 — 진짜 tmux 세션을 만들고 메시지를 밀어넣어 출력에서 마커를 회수한다.
// 사고 1·7(죽은 터미널 주소, 명단 경로 갈라짐)의 재발을 이 시험이 막는다. 2026-08-30.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function waitForSignal(socket, channel, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const child = spawn("tmux", ["-L", socket, "wait-for", channel], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`tmux wait-for 시한 초과: ${channel}`));
    }, timeoutMs);
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`tmux wait-for 실패(${code}): ${stderr.trim()}`));
    });
  });
}

async function waitForShellReady(tmux, socket, session) {
  const channel = `shell-ready-${session}`;
  const signal = waitForSignal(socket, channel);
  const tmuxBin = spawnSync("which", ["tmux"], { encoding: "utf8" }).stdout.trim();
  const command = `${tmuxBin} -L ${socket} wait-for -S ${channel}; exec /bin/sh`;
  const respawned = tmux(["respawn-pane", "-k", "-t", session, command]);
  if (respawned.status !== 0) throw new Error(`tmux shell 준비 실패: ${respawned.stderr}`);
  await signal;
}

test("tmux 왕복: 세션 생성 → 전달 → 캡처 → DONE 마커 회수", async (t) => {
  if (spawnSync("tmux", ["-V"]).status !== 0) return t.skip("tmux 없음");
  const socket = `kadan-selftest-${process.pid}`;
  process.env.KADAN_SOCKET = socket;
  process.env.KADAN_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "kadan-lite-rt-"));
  const cli = await import("../src/cli.mjs");
  const { tmux, sessionName, hasSession, capturePane, stripAnsi, findDoneMarkers } = cli;
  const session = sessionName("셀프시험");

  t.after(() => tmux(["kill-server"]));

  // 세션 생성(명령 없이 기본 셸)
  const created = tmux(["new-session", "-d", "-s", session, "-x", "200", "-y", "50"]);
  assert.equal(created.status, 0, `생 실패: ${created.stderr}`);
  assert.equal(hasSession(session), true, "생성 직후 has-session이 거짓");
  await waitForShellReady(tmux, socket, session);

  // 메시지 밀어넣기 — send 명령과 같은 stdin 버퍼 경로
  const channel = `marker-${process.pid}`;
  const signal = waitForSignal(socket, channel);
  const message = `echo "KADAN:DONE selftest-1 ok"; tmux -L ${socket} wait-for -S ${channel}`;
  const buf = "kadan-send";
  const loaded = tmux(["load-buffer", "-b", buf, "-"], message);
  assert.equal(loaded.status, 0);
  assert.equal(tmux(["paste-buffer", "-b", buf, "-t", session]).status, 0);
  assert.equal(tmux(["send-keys", "-t", session, "Enter"]).status, 0);

  await signal;
  const markers = findDoneMarkers(stripAnsi(capturePane(session)));
  assert.deepEqual(markers, [{ taskId: "selftest-1", result: "ok" }]);
});

test("감독이 사람 눈 없이 발령 전 화면을 판정한다 — card-15 실측에서 깨진 창을 확인했다고 적었다(2026-08-30 검수): capturePane 하단 5줄", async (t) => {
  if (spawnSync("tmux", ["-V"]).status !== 0) return t.skip("tmux 없음");
  const socket = `kadan-read-selftest-${process.pid}`;
  process.env.KADAN_SOCKET = socket;
  process.env.KADAN_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "kadan-lite-read-"));
  const cli = await import(`../src/cli.mjs?read=${process.pid}`);
  const { tmux, sessionName, capturePane, stripAnsi, tailLines } = cli;
  const session = sessionName("화면읽기");

  t.after(() => tmux(["kill-server"]));
  assert.equal(tmux(["new-session", "-d", "-s", session, "-x", "200", "-y", "5"]).status, 0);
  await waitForShellReady(tmux, socket, session);

  const channel = `read-marker-${process.pid}`;
  const signal = waitForSignal(socket, channel);
  const message = `printf "첫줄\\n둘째줄\\nKADAN:DONE read-selftest ok\\n"; tmux -L ${socket} wait-for -S ${channel}`;
  assert.equal(tmux(["load-buffer", "-b", "kadan-read", "-"], message).status, 0);
  assert.equal(tmux(["paste-buffer", "-b", "kadan-read", "-t", session]).status, 0);
  assert.equal(tmux(["send-keys", "-t", session, "Enter"]).status, 0);

  await signal;
  assert.match(tailLines(stripAnsi(capturePane(session)), 5), /KADAN:DONE read-selftest ok/);
});

test("새 tmux 서버에 카단 설정이 적용된다 — 상태줄 없음·접두사 없음(2026-08-30 card-13.1)", async (t) => {
  if (spawnSync("tmux", ["-V"]).status !== 0) return t.skip("tmux 없음");
  // cli 모듈은 ESM 캐시 때문에 이 파일의 첫 시험이 잠근 소켓 이름을 그대로 쓴다.
  // 같은 값을 다시 잠가 소켓을 재활용한다 — 서버는 kill-server 뒤 새로 부팅된다.
  process.env.KADAN_SOCKET = `kadan-selftest-${process.pid}`;
  process.env.KADAN_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "kadan-lite-conf-"));
  const cli = await import("../src/cli.mjs");
  const { tmux, sessionName, ensureTmuxConf } = cli;
  // cmdStart와 같은 순서다: 설정 보장 → new-session(이 호출이 서버를 부팅한다).
  ensureTmuxConf();
  const session = sessionName("설정점검");
  const created = tmux(["new-session", "-d", "-s", session, "-x", "200", "-y", "50"]);
  assert.equal(created.status, 0, `생 실패: ${created.stderr}`);
  t.after(() => tmux(["kill-server"]));
  assert.equal(tmux(["show-options", "-g", "status"]).stdout.trim(), "status off");
  assert.equal(tmux(["show-options", "-g", "prefix"]).stdout.trim(), "prefix None");
});
