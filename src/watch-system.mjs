function commandText(command, args, spawn) {
  const result = spawn(command, args, { encoding: "utf8" });
  return result.status === 0 ? (result.stdout ?? "").trim() : null;
}

export function assertSingleWatch(spawn) {
  process.title = "kadan-watch";
  const output = commandText("ps", ["-Ao", "pid=,command="], spawn);
  if (output == null) return;
  const duplicate = output
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(.+)$/))
    .find(
      (match) =>
        match &&
        Number(match[1]) !== process.pid &&
        match[2] === "kadan-watch"
    );
  if (duplicate) {
    throw new Error(`watch가 이미 실행 중이다 (PID ${duplicate[1]})`);
  }
}

export function notifyUser(message, spawn) {
  const script = `display notification ${JSON.stringify(
    message
  )} with title "kadan watch"`;
  const result = spawn("osascript", ["-e", script], { encoding: "utf8" });
  return result.status === 0
    ? null
    : (result.stderr ?? "osascript 실패").trim();
}
