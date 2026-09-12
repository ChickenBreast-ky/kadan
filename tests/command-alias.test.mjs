import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { main } from "../src/cli.mjs";

const cliPath = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));

test("dashboard는 wall의 별명이다 — kadan dashboard로도 관제 화면이 열린다", () => {
  const logs = [];
  const original = console.log;
  console.log = (...parts) => logs.push(parts.join(" "));
  try {
    main(["wall", "--help"]);
    main(["dashboard", "--help"]);
  } finally {
    console.log = original;
  }
  assert.equal(logs.length, 2);
  assert.equal(logs[1], logs[0]);
  assert.match(logs[0], /사용법: kadan wall/);
});

test("심볼릭 링크로 불러도 명령이 실행된다 — npm link 뒤 kadan이 조용히 아무것도 안 하면 안 된다(2026-09-06)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kadan-link-"));
  const linkPath = path.join(dir, "kadan");
  fs.symlinkSync(cliPath, linkPath);
  try {
    for (const command of ["wall", "dashboard"]) {
      const out = execFileSync(process.execPath, [linkPath, command, "--help"], {
        encoding: "utf8",
      });
      assert.match(
        out,
        /사용법: kadan wall/,
        `${command} --help 출력이 비어 있으면 안 된다`,
      );
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
