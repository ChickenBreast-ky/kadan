import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CardStore, readFirstPaths } from "../src/card-store.mjs";

const 본문 = (읽을것) => `# card-x — 시험\n\n## 읽고 시작할 것\n${읽을것}\n\n## 범위\n- /무시/되는/경로.md\n`;
const 발령 = { status: "assigned", scope: "시험 범위", board: "판", role: "판-작업자", rallyId: "묶음", rallyTitle: "제목", rallyRound: "1", rallyStep: "implementation" };

function 카드(읽을것) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "kadan-readfirst-"));
  const store = new CardStore(home);
  const source = path.join(home, "card.md");
  fs.writeFileSync(source, 본문(읽을것));
  const created = store.create({ repo: "repo", id: "card-x", repoPath: home, sourcePath: source, by: "판-감독" });
  return { store, revision: created.revision };
}

test("읽고 시작할 것에 적힌 절대경로만 센다", () => {
  assert.deepEqual(readFirstPaths(본문("- /절대/경로/AGENTS.md — 규칙")), ["/절대/경로/AGENTS.md"]);
  assert.deepEqual(readFirstPaths(본문("- <예: /home/…/저장소/AGENTS.md — 규칙>")), []);
  assert.deepEqual(readFirstPaths(본문("- 저장소 규칙을 읽어라")), []);
  assert.deepEqual(readFirstPaths("## 범위\n- /a/b.md"), []);
  assert.deepEqual(readFirstPaths(undefined), []);
});

test("사람이 발령할 때 읽을 문서가 없으면 막는다", () => {
  const { store, revision } = 카드("- 저장소 규칙을 읽어라");
  assert.throws(
    () => store.update("repo/card-x", 발령, { revision, by: "판-감독", note: "발령", manual: true }),
    /읽고 시작할 것/
  );
  assert.equal(store.get("repo/card-x").status, "draft");
});

test("절대경로를 적으면 발령된다", () => {
  const { store, revision } = 카드("- /절대/경로/AGENTS.md — 저장소 공통 규칙");
  const card = store.update("repo/card-x", 발령, { revision, by: "판-감독", note: "발령", manual: true });
  assert.equal(card.status, "assigned");
});

test("프로그램 자동 전달은 이 검사를 거치지 않는다", () => {
  const { store, revision } = 카드("- 아직 안 적음");
  const card = store.update("repo/card-x", 발령, { revision, by: "판-감독", note: "자동 배정" });
  assert.equal(card.status, "assigned");
});

test("이미 발령된 카드의 다른 수정은 막지 않는다", () => {
  const { store, revision } = 카드("- 아직 안 적음");
  const 배정 = store.update("repo/card-x", 발령, { revision, by: "판-감독", note: "자동 배정" });
  const 완료 = store.update("repo/card-x", { status: "done" }, { revision: 배정.revision, by: "판-감독", note: "마감", manual: true });
  assert.equal(완료.status, "done");
});
