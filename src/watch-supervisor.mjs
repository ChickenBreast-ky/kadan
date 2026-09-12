import { workEntries } from "./handover-state.mjs";
import { isDescendant } from "./hierarchy.mjs";
import { boardFromRole, supervisorForBoard } from "./board.mjs";

function startedAtMs(state) {
  const at = Date.parse(state?.startedAt);
  return Number.isFinite(at) ? at : 0;
}

export function assessSupervisorIdle(
  entries,
  roleStates,
  now,
  idleMs,
  ledgerError = null,
  parents = new Map()
) {
  if (ledgerError) {
    return [
      {
        id: "ledger:unreadable",
        kind: "모름",
        level: "AMBER",
        ledgerError: ledgerError.message,
      },
    ];
  }

  entries = workEntries(entries);
  // 명시한 역할은 이름 기반의 옛 판정과 중복하지 않는다.
  const mappedBoards = new Set([...parents.keys()].map(boardFromRole).filter(Boolean));
  const mappedTasks = new Set(entries.filter(entry => parents.has(entry?.role) && entry.taskId).map(entry => entry.taskId));
  const legacyEntries = entries.filter(entry => !parents.has(entry?.role) &&
    !(entry?.kind === "plan" && (mappedBoards.has(entry.board) || mappedTasks.has(entry.taskId))));
  const completed = new Set();
  for (const entry of legacyEntries) {
    const board = boardFromRole(entry?.role);
    if (entry?.kind === "done" && board && entry.taskId) {
      completed.add(`${board}\0${entry.taskId}`);
    }
  }

  const openByBoard = new Map();
  for (const entry of legacyEntries) {
    const board = entry?.kind === "plan" ? entry.board : boardFromRole(entry?.role);
    const at = Date.parse(entry?.t);
    if (!board || !Number.isFinite(at)) continue;
    if (
      (entry.kind === "plan" || entry.kind === "send") &&
      entry.taskId &&
      !completed.has(`${board}\0${entry.taskId}`)
    ) {
      const cards = openByBoard.get(board) ?? new Map();
      const previous = cards.get(entry.taskId);
      cards.set(entry.taskId, previous == null ? at : Math.min(previous, at));
      openByBoard.set(board, cards);
    }
  }

  const alerts = [];
  const liveSessions = [...roleStates.entries()]
    .filter(([, state]) => state?.alive)
    .sort((left, right) => startedAtMs(right[1]) - startedAtMs(left[1]))
    .map(([session]) => session);
  for (const [board, cards] of openByBoard) {
    const role = supervisorForBoard(board, liveSessions) ?? `${board}-감독`;
    const session = `kadan-${role}`;
    const state = roleStates.get(session);
    if (state?.deathActive) continue;
    if (!state?.alive || state.digest == null) {
      alerts.push({
        id: `idle:screen:${board}`,
        kind: "모름",
        level: "AMBER",
        role,
        session,
        openCards: cards.size,
        screenError: state?.screenError ?? "화면 없음",
      });
      continue;
    }
    const openedAt = Math.min(...cards.values());
    const idleFor = Math.min(now - openedAt, state.unchangedMs ?? 0);
    if (idleFor < idleMs) continue;
    alerts.push({
      id: `idle:${board}`,
      kind: "놀고 있음",
      level: "AMBER",
      role,
      session,
      openCards: cards.size,
      idleMinutes: Math.floor(idleFor / 60_000),
    });
  }
  alerts.push(...assessHierarchyIdle(entries, roleStates, now, idleMs, parents));
  return alerts;
}

export function wakeDue(role, lastWakeAt, now, wakeEveryMs) {
  return Boolean(role) && (lastWakeAt == null || now - lastWakeAt >= wakeEveryMs);
}

export function buildWakeMessage() {
  return "[자가점검 깨우기] 도구로 판을 직접 확인하라: 검수 짝 / 발령 상한 / 로스터 생존 / 표본 재검. 이상 없으면 보고하지 말고 계속하라.";
}

export function assessHierarchyIdle(entries, states, now, idleMs, parents) {
  const pending = new Map();
  for (const entry of entries) {
    if (!parents.has(entry?.role) || !entry.taskId) continue;
    const key = `${entry.role}\0${entry.taskId}`;
    if (entry.kind === "send") pending.set(key, entry);
    if (entry.kind === "done") pending.delete(key);
  }
  const supervisors = new Set([...parents.values()].filter(role => parents.has(role)));
  // 아직 미발령인 plan은 같은 판의 직속 감독 한 명에게만 귀속한다.
  const assigned = new Set(entries.filter(entry => parents.has(entry?.role) && entry.taskId && entry.kind === "send").map(entry => entry.taskId));
  for (const entry of entries) {
    if (entry?.kind !== "plan" || assigned.has(entry.taskId)) continue;
    const candidates = [...supervisors].filter(role => boardFromRole(role) === entry.board);
    const owners = candidates.filter(role => !candidates.some(other => other !== role && isDescendant(other, role, parents)));
    if (owners.length === 1) pending.set(`plan\0${entry.board}\0${entry.taskId}`, { ...entry, role: owners[0] });
  }
  const alerts = [];
  for (const role of supervisors) {
    const cards = [...pending.values()].filter(entry => isDescendant(entry.role, role, parents));
    if (!cards.length) continue;
    const session = `kadan-${role}`;
    const state = states.get(session);
    if (state?.deathActive) continue;
    if (!state?.alive || state.digest == null) {
      alerts.push({ id: `idle:hierarchy:screen:${role}`, kind: "모름", level: "AMBER",
        role, session, openCards: cards.length, screenError: state?.screenError ?? "화면 없음" });
      continue;
    }
    // 하위 담당자가 실제로 진행하면 상위의 조용한 대기는 이상이 아니다.
    const active = [state, ...cards.map(entry => states.get(`kadan-${entry.role}`))]
      .filter(item => item?.alive && item.digest != null);
    const openedAt = Math.min(...cards.map(entry => Date.parse(entry.t)).filter(Number.isFinite));
    const idleFor = Math.min(now - openedAt, ...active.map(item => item.unchangedMs ?? 0));
    if (idleFor < idleMs) continue;
    alerts.push({ id: `idle:hierarchy:${role}`, kind: "놀고 있음", level: "AMBER",
      role, session, openCards: cards.length, idleMinutes: Math.floor(idleFor / 60000) });
  }
  return alerts;
}
