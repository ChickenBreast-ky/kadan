import test from "node:test";
import assert from "node:assert/strict";
import { buildTree, renderTree, startDisplay } from "../src/cli.mjs";
import { renderWallHtml } from "../src/wall.mjs";

const collectedAt = new Date("2026-09-06T03:00:00.000Z");

function board({ workerFamily = "gpt", reviewerFamily = "claude", workerModel = "gpt-6-astra", reviewerModel = "claude-opus-5" } = {}) {
  return {
    name: "c67",
    roles: [
      {
        role: "c67-작업자",
        session: "kadan-c67-작업자",
        window: "rottie",
        lastActivityAt: "2026-09-06T02:10:00.000Z",
        life: { state: "alive", pidState: "match" },
        cards: [],
        harness: "codex",
        model: workerModel,
        family: workerFamily,
      },
      {
        role: "c67-검수자",
        session: "kadan-c67-검수자",
        window: "hidden",
        lastActivityAt: "2026-09-06T02:11:00.000Z",
        life: { state: "alive", pidState: "match" },
        cards: [],
        harness: "claude",
        model: reviewerModel,
        family: reviewerFamily,
      },
    ],
  };
}

test("원장 start에 실행기·모델이 없으면 모름으로 적는다 — 빈칸이나 추측 금지(card-67)", () => {
  assert.deepEqual(startDisplay(undefined), { harness: "모름", model: "모름", family: "모름" });
  assert.deepEqual(startDisplay({}), { harness: "모름", model: "모름", family: "모름" });
  const tree = buildTree([
    { kind: "start", role: "c67-작업자", session: "kadan-c67-작업자", window: "rottie" },
  ]);
  const role = tree[0].roles[0];
  assert.equal(role.harness, "모름");
  assert.equal(role.model, "모름");
  assert.equal(role.family, "모름");
  assert.match(renderTree(tree), /모름 · 모름 · 모름/);
});

test("작업자와 검수자 계열이 다르면 표에 두 계열이 각각 보이고 강조는 없다(card-67)", () => {
  const html = renderWallHtml({
    tree: [board()],
    collectedAt,
    ledgerPath: "/tmp/kadan/ledger.jsonl",
    ledgerLines: 2,
    error: null,
    all: true,
  });
  assert.match(html, /codex · gpt-6-astra · gpt/);
  assert.match(html, /claude · claude-opus-5 · claude/);
  assert.doesNotMatch(html, /pill changed/);
});

test("같은 판의 작업자와 검수자 계열이 같으면 눈에 띄게 표시한다(card-67)", () => {
  const html = renderWallHtml({
    tree: [board({ workerFamily: "gpt", reviewerFamily: "gpt", reviewerModel: "gpt-5.4" })],
    collectedAt,
    ledgerPath: "/tmp/kadan/ledger.jsonl",
    ledgerLines: 2,
    error: null,
    all: true,
  });
  assert.match(html, /<span class="pill changed">gpt<\/span>/);
  assert.equal([...html.matchAll(/pill changed/g)].length, 2);
});

test("model이 없는 옛 역할은 모름으로 보이고 강조하지 않는다(card-67)", () => {
  const html = renderWallHtml({
    tree: [
      {
        name: "c67",
        roles: [
          {
            role: "c67-작업자",
            session: "kadan-c67-작업자",
            window: "rottie",
            lastActivityAt: "2026-09-06T02:10:00.000Z",
            life: { state: "alive", pidState: "match" },
            cards: [],
            harness: "모름",
            model: "모름",
            family: "모름",
          },
          {
            role: "c67-검수자",
            session: "kadan-c67-검수자",
            window: "hidden",
            lastActivityAt: "2026-09-06T02:11:00.000Z",
            life: { state: "alive", pidState: "match" },
            cards: [],
            harness: "claude",
            model: "claude-opus-5",
            family: "claude",
          },
        ],
      },
    ],
    collectedAt,
    ledgerPath: "/tmp/kadan/ledger.jsonl",
    ledgerLines: 2,
    error: null,
    all: true,
  });
  assert.match(html, /모름 · 모름 · 모름/);
  assert.match(html, /claude · claude-opus-5 · claude/);
  assert.doesNotMatch(html, /pill changed/);
});
