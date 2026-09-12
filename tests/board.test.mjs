// 판 이름·감독 주소 — 첫 '-' 앞 규칙이 foo-api·foo-web을 한 판으로 묶고
// card47-검수자-2의 판을 잃었다 (2026-09-05 card-49).
import { test } from "node:test";
import assert from "node:assert/strict";
import { boardFromRole } from "../src/board.mjs";
import { assessSupervisorIdle } from "../src/watch-supervisor.mjs";
import { routeAlert } from "../src/watch.mjs";
import { collectRoles } from "../src/watch-runner.mjs";

test("판 이름은 직무 조각 앞이다 — foo-api·foo-web이 한 판으로 묶이고 card47-검수자-2는 판을 잃었다(2026-09-05)(card-49)", () => {
  assert.equal(boardFromRole("foo-api-감독"), "foo-api");
  assert.equal(boardFromRole("foo-web-감독"), "foo-web");
  assert.equal(boardFromRole("p-작업자"), "p");
  assert.equal(boardFromRole("card47-검수자-2"), "card47");
  assert.equal(boardFromRole("p-감독-2"), "p");
  assert.equal(boardFromRole("p-2기감독"), "p");
  assert.equal(boardFromRole("kyle-test"), "kyle");
  assert.equal(boardFromRole("감독"), null);
  assert.equal(boardFromRole(null), null);

  const now = Date.parse("2026-09-05T12:32:00.000Z");
  const alerts = assessSupervisorIdle(
    [
      {
        t: "2026-09-05T12:00:00.000Z",
        kind: "send",
        role: "foo-api-작업자",
        taskId: "card-a",
      },
      {
        t: "2026-09-05T12:00:00.000Z",
        kind: "send",
        role: "foo-web-작업자",
        taskId: "card-b",
      },
      {
        t: "2026-09-05T12:01:00.000Z",
        kind: "done",
        role: "foo-web-작업자",
        taskId: "card-b",
        result: "ok",
      },
    ],
    new Map([
      [
        "kadan-foo-api-감독",
        {
          role: "foo-api-감독",
          alive: true,
          digest: "same",
          unchangedMs: 32 * 60 * 1_000,
        },
      ],
      [
        "kadan-foo-web-감독",
        {
          role: "foo-web-감독",
          alive: true,
          digest: "same",
          unchangedMs: 32 * 60 * 1_000,
        },
      ],
    ]),
    now,
    30 * 60 * 1_000
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].kind, "놀고 있음");
  assert.equal(alerts[0].role, "foo-api-감독");
  assert.equal(alerts[0].session, "kadan-foo-api-감독");
});

test("교대한 후임 감독을 살아 있는 세션에서 찾는다 — 고정 <판>-감독 주소가 낡았다(card-49)", () => {
  const alert = {
    id: "death:kadan-p-작업자",
    kind: "죽음",
    level: "RED",
    role: "p-작업자",
    session: "kadan-p-작업자",
  };
  assert.equal(
    routeAlert(
      alert,
      new Map(),
      new Set(["kadan-p-2기감독", "kadan-슈퍼"]),
      "슈퍼"
    ),
    "p-2기감독"
  );
  assert.equal(
    routeAlert(alert, new Map(), new Set(["kadan-슈퍼"]), "슈퍼"),
    "슈퍼"
  );
  assert.equal(
    routeAlert(
      alert,
      new Map(),
      ["kadan-p-2기감독", "kadan-p-감독"],
      "슈퍼"
    ),
    "p-2기감독"
  );
  assert.equal(
    routeAlert(
      alert,
      new Map(),
      ["kadan-p-감독", "kadan-p-2기감독"],
      "슈퍼"
    ),
    "p-감독"
  );
  assert.equal(
    routeAlert(
      alert,
      new Map(),
      ["kadan-p-감독-2", "kadan-p-검수자-2"],
      "슈퍼"
    ),
    "p-감독-2"
  );
});

test("collectRoles는 살아 있는 세션을 최신 start 먼저 넘긴다(card-49)", () => {
  const floor = {
    list() {
      return [
        { session: "kadan-p-감독", alive: true, pid: "1" },
        { session: "kadan-p-2기감독", alive: true, pid: "2" },
      ];
    },
    read() {
      return "화면";
    },
  };
  const { liveSessions, observations } = collectRoles(floor, [
    {
      t: "2026-09-05T10:00:00.000Z",
      kind: "start",
      role: "p-감독",
      session: "kadan-p-감독",
    },
    {
      t: "2026-09-05T12:00:00.000Z",
      kind: "start",
      role: "p-2기감독",
      session: "kadan-p-2기감독",
    },
  ]);
  assert.equal([...liveSessions][0], "kadan-p-2기감독");
  assert.equal(observations.get("kadan-p-2기감독").startedAt, "2026-09-05T12:00:00.000Z");
  assert.equal(observations.get("kadan-p-감독").startedAt, "2026-09-05T10:00:00.000Z");
});
