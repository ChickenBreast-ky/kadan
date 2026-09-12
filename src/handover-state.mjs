// 원장 원문은 보존하고 카드 책임을 계산할 때만 확정된 인계를 반영한다.
export function workEntries(entries) {
  const projected = [];
  for (const entry of entries) {
    if (entry?.kind === 'handover' && entry.phase === 'transferred') {
      const tasks = new Set(entry.taskIds);
      for (let i = 0; i < projected.length; i++) {
        const e = projected[i];
        if (e.role === entry.from && tasks.has(e.taskId) && ['send', 'done'].includes(e.kind)) {
          projected[i] = { ...e, role: entry.to, session: `kadan-${entry.to}`,
            inheritedFrom: e.inheritedFrom ?? entry.from, handoverId: entry.handoverId };
        }
      }
    }
    projected.push(entry);
  }
  return projected;
}

export function openTaskIds(entries, role) {
  const pending = new Set();
  for (const e of workEntries(entries)) {
    if (e?.role !== role || !e.taskId) continue;
    if (e.kind === 'send') pending.add(e.taskId);
    if (e.kind === 'done') pending.delete(e.taskId);
  }
  return [...pending].sort();
}

// 중앙 카드의 담당도 과거 인계 기록을 따라간다. 이후 명시 재배정은 우선한다.
export function effectiveCardRole(card, entries) {
  let role=card.role;
  for(const e of entries) if(e?.kind==='handover'&&e.phase==='transferred'&&e.from===role&&
    e.taskIds?.includes(card.id)&&(!card.at||!e.t||Date.parse(e.t)>=Date.parse(card.at))) role=e.to;
  return role;
}
