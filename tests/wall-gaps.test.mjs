import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, renderTree, renderWallHtml } from '../src/cli.mjs';

const now = '2026-09-05T09:00:00.000Z';
const recent = '2026-09-05T07:00:00.000Z';
const old = '2026-09-04T08:59:59.999Z';
const plan = (board, taskId, t = recent) => ({ kind: 'plan', board, taskId, t });
const send = (role, taskId, t = recent) => ({ kind: 'send', role, taskId, t });
const snapshot = entries => ({ tree: buildTree(entries), collectedAt: now, ledgerLines: entries.length, ledgerPath: '/fixed/ledger.jsonl' });
const summary = html => html.match(/<p class="summary">([^<]+)<\/p>/)[1];
const count = (html, label) => Number(summary(html).match(new RegExp(`${label} (\\d+)[개장]`))[1]);

test('계획만 있는 판도 기본 화면에 보인다 — plan 시각이 활동으로 안 쳐져 판이 숨었다(2026-09-05)(card-59)', () => {
  const data = snapshot([plan('c', 'c-1', old), plan('c', 'c-1'), plan('c', 'c-2', old)]);
  const html = renderWallHtml(data);
  assert.match(html, /<h2>판 c<\/h2>/);
  assert.equal(data.tree[0].plannedAt, recent);
  assert.equal(data.tree[0].plannedCards.length, 2);
  assert.match(html, /<p>발령 전 2장: c-1, c-2<\/p>/);
  assert.match(html, /<tbody><\/tbody>/);
});

test('요약은 발령 전 카드도 센다 — 감시는 3장, 화면은 2장이었다(2026-09-05)(card-59)', () => {
  const entries = [plan('a', 'a-1'), plan('b', 'b-1'), plan('c', 'c-1'), plan('c', 'c-1'), send('a-작업자', 'a-1'), send('b-작업자', 'b-1')];
  const html = renderWallHtml(snapshot(entries));
  assert.equal(count(html, '발령 전'), 1);
  assert.equal(count(html, '안 끝난 카드'), 2);
  assert.equal(count(html, '도는 판'), 3);
  const closed = snapshot([...entries, { ...send('a-작업자', 'a-1'), kind: 'done', result: 'ok' }, plan('a', 'a-1')]);
  assert.equal(count(renderWallHtml(closed), '발령 전'), 1);
  assert.equal(count(renderWallHtml(closed), '안 끝난 카드'), 1);
  assert.equal(count(renderWallHtml(snapshot([])), '발령 전'), 0);
});

test('세션이 사라진 역할은 세션 없음이다 — 기록없음으로 읽혀 죽음을 놓쳤다(2026-09-05)(card-59)', () => {
  const data = snapshot([{ kind: 'start', role: 'b-작업자', t: old }, { kind: 'start', role: 'b-작업자', t: recent }]);
  const date = new Date(recent);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  assert.ok(renderTree(data.tree).includes(`세션 없음(start ${time})`));
  assert.match(renderWallHtml(data), /class="state dead">세션 없음<\/span>/);
  const noStart = snapshot([send('b-작업자', 'b-1')]);
  assert.match(renderTree(noStart.tree), /기록없음/);
  assert.match(renderWallHtml(noStart), /class="state dead">기록없음<\/span>/);
});

test('24시간 지난 계획 판은 전체에서만 보인다 — 기본 필터와 요약의 판 집합을 맞춘다(card-59)', () => {
  const data = snapshot([plan('old', 'old-1', old), plan('edge', 'edge-1', '2026-09-04T09:00:00.000Z')]);
  const html = renderWallHtml(data);
  assert.doesNotMatch(html, /<h2>판 old<\/h2>/);
  assert.match(html, /<h2>판 edge<\/h2>/);
  assert.equal(count(html, '발령 전'), 1);
  const all = renderWallHtml({ ...data, all: true });
  assert.match(all, /<h2>판 old<\/h2>/);
  // Existing other summary counts describe currentTree even in the all-history view.
  assert.equal(count(all, '도는 판'), 1);
  assert.equal(count(all, '발령 전'), 1);
});

test('원장 읽기 실패는 발령 전도 모름이다 — 0장으로 오인하지 않는다(card-35r)(card-59)', () => {
  const html = renderWallHtml({ ...snapshot([plan('c', 'c-1')]), ledgerLines: null, mailbox: null, error: 'EISDIR' });
  for (const label of ['살아있는 역할', '도는 판', '안 끝난 카드', '발령 전']) assert.ok(summary(html).includes(`${label} 모름`));
  assert.doesNotMatch(summary(html), /\d/);
  assert.match(html, /class="role-unknown"/);
  assert.match(html, /class="mailbox-unknown"/);
  assert.doesNotMatch(html, /<h2>판 c<\/h2>/);
});
