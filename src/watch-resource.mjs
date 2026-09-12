import fs from "node:fs";
import os from "node:os";

function commandText(command, args, spawn) {
  const result = spawn(command, args, { encoding: "utf8" });
  return result.status === 0 ? (result.stdout ?? "").trim() : null;
}

function parseMeminfo(text) {
  const lines = text.split("\n");
  const values = {};
  for (const line of lines) {
    const match = line.match(/^([^:]+):\s+(\d+)\s+kB/);
    if (match) values[match[1]] = Number(match[2]);
  }
  return values;
}

export function collectResources(
  spawn,
  {
    platform = process.platform,
    readFile = fs.readFileSync,
    loadavg = os.loadavg,
    cpus = os.cpus,
  } = {}
) {
  let freePercent = null;
  let swapUsed = null;
  let memory = "unknown";

  let load5 = null;
  let ncpu = null;

  if (platform === "darwin") {
    const memoryText = commandText("memory_pressure", ["-Q"], spawn);
    const freeMatch = memoryText?.match(
      /System-wide memory free percentage:\s*(\d+)%/
    );
    freePercent = freeMatch ? Number(freeMatch[1]) : null;

    const swapText = commandText("sysctl", ["vm.swapusage"], spawn);
    const swapMatch = swapText?.match(/used =\s*([\d.]+)M/);
    swapUsed = swapMatch ? Number(swapMatch[1]) : null;

    load5 = loadavg()[1];
    ncpu = cpus().length;
  } else if (platform === "linux") {
    try {
      const meminfoText = readFile("/proc/meminfo", "utf8");
      const mem = parseMeminfo(meminfoText);
      if (mem.MemTotal && mem.MemAvailable != null) {
        freePercent = Math.round((mem.MemAvailable / mem.MemTotal) * 100);
      }
      if (mem.SwapTotal != null && mem.SwapFree != null) {
        swapUsed = (mem.SwapTotal - mem.SwapFree) / 1024;
      }
      load5 = loadavg()[1];
      ncpu = cpus().length;
    } catch {
      // fail-closed: leave all null → memory "unknown"
    }
  }

  // 25%/15%는 2026-08-09 사망과 2026-08-11 오탐을 함께 검토한 옛 관문 값이다.
  if (freePercent != null) {
    memory =
      freePercent <= 15
        ? "critical"
        : freePercent <= 25
          ? "warning"
          : "normal";
  }

  return {
    current: { memory, freePercent, swapUsed, load5, ncpu },
    ncpu,
  };
}
