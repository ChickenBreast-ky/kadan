const DUTY = /감독|작업자|검수자|비서/u;

export function boardFromRole(role) {
  if (typeof role !== "string") return null;
  if (role.indexOf("-") === -1) return null;
  const parts = role.split("-");
  const dutyAt = parts.findIndex((part) => DUTY.test(part));
  const board =
    dutyAt === -1 ? parts.slice(0, -1).join("-") : parts.slice(0, dutyAt).join("-");
  return board || null;
}

export function supervisorForBoard(board, liveSessions) {
  if (board == null || board === "") return null;
  for (const session of liveSessions) {
    if (typeof session !== "string" || !session.startsWith("kadan-")) continue;
    const role = session.slice("kadan-".length);
    if (boardFromRole(role) !== board) continue;
    const duty = role.slice(board.length + 1);
    if (duty.includes("감독")) return role;
  }
  return null;
}
