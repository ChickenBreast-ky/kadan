import { test } from "node:test";
import assert from "node:assert/strict";
import { collectResources } from "../src/watch-resource.mjs";

test("linux는 /proc/meminfo로 메모리·스왑을 읽는다 — 비macOS는 전부 모름·AMBER였다(2026-09-05)(card-50)", () => {
  const meminfo = `
MemTotal:       16000000 kB
MemAvailable:    3200000 kB
SwapTotal:       2000000 kB
SwapFree:        1500000 kB
  `.trim();

  const result = collectResources(
    () => { throw new Error("spawn은 호출되면 안 된다"); },
    {
      platform: "linux",
      readFile: () => meminfo,
      loadavg: () => [1, 2.5, 3],
      cpus: () => Array.from({ length: 8 }),
    }
  );

  assert.equal(result.current.freePercent, 20);
  assert.equal(result.current.memory, "warning");
  assert.ok(Math.abs(result.current.swapUsed - 488.28) < 0.01);
  assert.equal(result.current.load5, 2.5);
  assert.equal(result.current.ncpu, 8);
  assert.equal(result.ncpu, 8);
});

test("미지원 OS는 여전히 모름이다 — 안 보던 자원이 22.5GB 스왑을 만들었다(2026-08-09)(card-50)", () => {
  const result = collectResources(
    () => { throw new Error("spawn은 호출되면 안 된다"); },
    {
      platform: "freebsd",
      readFile: () => { throw new Error("ENOENT"); },
      loadavg: () => [1, 2, 3],
      cpus: () => Array.from({ length: 4 }),
    }
  );

  assert.equal(result.current.memory, "unknown");
  assert.equal(result.current.freePercent, null);
  assert.equal(result.current.swapUsed, null);
  assert.equal(result.current.load5, null);
  assert.equal(result.current.ncpu, null);
});

test("linux인데 readFile throw도 모름이다(card-50)", () => {
  const result = collectResources(
    () => { throw new Error("spawn은 호출되면 안 된다"); },
    {
      platform: "linux",
      readFile: () => { throw new Error("ENOENT"); },
      loadavg: () => [1, 2, 3],
      cpus: () => Array.from({ length: 4 }),
    }
  );

  assert.equal(result.current.memory, "unknown");
  assert.equal(result.current.freePercent, null);
  assert.equal(result.current.swapUsed, null);
  assert.equal(result.current.load5, null);
  assert.equal(result.current.ncpu, null);
});

test("darwin은 기존 명령을 그대로 쓴다(card-50)", () => {
  const calls = [];
  const result = collectResources((command, args) => {
    calls.push({ command, args });
    if (command === "memory_pressure") {
      return {
        status: 0,
        stdout: "System-wide memory free percentage: 30%",
      };
    }
    if (args.includes("vm.swapusage")) {
      return { status: 0, stdout: "total = 1024.00M used = 256.00M free = 768.00M" };
    }
    return { status: 0, stdout: "" };
  }, { platform: "darwin" });

  assert.equal(result.current.memory, "normal");
  assert.equal(result.current.freePercent, 30);
  assert.equal(result.current.swapUsed, 256);
  // sysctl loadavg/hw.ncpu는 호출되지 않아야 함
  assert.ok(!calls.some((c) => c.command === "sysctl" && (c.args.includes("vm.loadavg") || c.args.includes("hw.ncpu"))));
});
