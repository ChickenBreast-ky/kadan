import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { buildTree } from '../src/cli.mjs';
import { renderWallHtml, createWallServer } from '../src/wall.mjs';
const t = '2026-09-05T09:12:34.000Z';
const entries = [
  {kind:'plan',board:'p',taskId:'p-next',t},
  {kind:'plan',board:'old',taskId:'old-card',t:'2026-09-01T00:00:00Z'},
  {kind:'start',role:'p-작업자',window:'rottie',t},
  {kind:'send',role:'p-작업자',taskId:'p-card',by:'사람',bytes:12,t},
  {kind:'send',role:'q-작업자',taskId:'q-card',by:'watch',bytes:13,t},
  {kind:'stop',role:'p-작업자',rottieWindowClosed:true,t},
  ...Array.from({length:12},(_,i)=>({kind:'alert',alertKind:`alert-${i}`,role:'p-작업자',recipient:'p-감독',delivered:i%2===0,resolved:i===11,by:'watch',t})),
];
const snapshot = (extra={}) => ({tree:buildTree(entries),entries,collectedAt:t,ledgerLines:entries.length,ledgerPath:'/fixed/ledger.jsonl',resources:{current:{memory:'normal',freePercent:80,swapUsed:0,load5:0},ncpu:12},...extra});
const screen = (html,id) => html.split(`<section class="page${id==='dashboard'?' on':''}" id="${id}">`)[1]?.split('<!-- end screen -->')[0] ?? '';
test('관제 화면은 사이드바와 화면 목록을 갖는다 — 한 장짜리 페이지는 대시보드가 아니었다(2026-09-05)(card-63)',()=>{
 const html=renderWallHtml(snapshot());
 assert.match(html,/<aside class="rail"/);
 for(const id of ['dashboard','boards','mailbox','ledger','settings']) { assert.ok(screen(html,id)); assert.ok(html.includes(`href="#${id}"`)); }
 assert.match(html,/class="stat-row"/); assert.match(html,/width:230px/); assert.match(html,/max-width:759px/);
 assert.doesNotMatch(html,/fetch\(|localStorage|sessionStorage|document.cookie|https:\/\//);
});
test('최근 알림은 원장 alert 줄에서 온다 — 알림이 화면에만 있었다(2026-09-05)(card-63)',()=>{
 const panel=renderWallHtml(snapshot()).split('id="recent-alerts"')[1].split('</section>')[0];
 assert.equal((panel.match(/data-alert=/g)||[]).length,10);
 assert.ok(panel.indexOf('alert-11')<panel.indexOf('alert-10'));
 assert.doesNotMatch(panel,/data-alert="alert-1"/); assert.match(panel,/해소/); assert.match(panel,/전달됨/); assert.match(panel,/실패/);
 assert.match(renderWallHtml(snapshot({entries:[]})),/알림 없음/);
});
test('시각은 한 형식이다 — 오늘이면 시간만이라 섞여 읽혔다(2026-09-05)(card-63)',()=>{
 const html=renderWallHtml(snapshot()); const times=[...html.matchAll(/<time title="([^"]+)"[^>]*>([^<]+)<\/time>/g)];
 assert.ok(times.length>10);
 for(const [,title,text] of times) { assert.match(title,/2026.*\d\d:\d\d:\d\d/); assert.match(text,/^\d\d-\d\d \d\d:\d\d$/); }
 assert.match(html,/수집 시각\(로컬\).*\d\d:\d\d:\d\d/);
});
test('원장 실패는 모든 원장 화면에서 모름이고 자원은 독립이다(card-35r)(card-63)',()=>{
 const html=renderWallHtml(snapshot({ledgerLines:null,error:'EISDIR'}));
 for(const id of ['dashboard','boards','mailbox','ledger']) {assert.match(screen(html,id),/모름/);assert.doesNotMatch(screen(html,id),/p-card|alert-11|p-next/);}
 assert.match(html,/id="recent-alerts">[\s\S]*?모름/);assert.match(html,/메모리 여유 80%/);
});
test('판 우편과 우편함 필터는 받는 역할의 판으로 고른다(card-63)',()=>{
 const html=renderWallHtml(snapshot({mailBoard:'p',hideWatch:true}));
 const mail=screen(html,'mailbox');assert.match(mail,/p-card/);assert.doesNotMatch(mail,/q-card/);
 const board=html.split('data-board-panel="p"')[1].split('<!-- end board -->')[0];
 assert.match(board,/p-card/);assert.doesNotMatch(board,/q-card/);assert.match(board,/rottie 닫힘/);
 const watch=screen(renderWallHtml(snapshot({hideWatch:true})),'mailbox');assert.doesNotMatch(watch,/q-card/);
});
test('원장 kind 필터와 원문은 HTML을 이스케이프한다(card-63)',()=>{
 const hostile={kind:'alert',alertKind:'<script>&"',role:'<img>',recipient:'<svg>',t};
 const html=renderWallHtml(snapshot({entries:[...entries,hostile],kind:'alert'}));
 const ledger=screen(html,'ledger');assert.doesNotMatch(ledger,/data-kind="send"/);assert.match(ledger,/data-kind="alert"/);assert.match(ledger,/<details><summary>원문 JSON 보기/);
 assert.match(html,/&lt;script&gt;&amp;&quot;/);assert.doesNotMatch(html,/<img>|<svg>/);
});
test('judge all refresh와 필터는 HTTP 쿼리로만 바뀌고 함께 보존된다(card-63)',async()=>{
 const server=createWallServer(()=>snapshot()); const ready=once(server,'listening');server.listen(0,'127.0.0.1');await ready;
 try {for(const [query,refresh] of [['?judge=1&all=1&refresh=30&board=p&hideWatch=1&kind=alert',30],['?refresh=0',0],['?refresh=bad',10]]){
 const response=await fetch(`http://127.0.0.1:${server.address().port}/${query}`,{signal:AbortSignal.timeout(5000)});const html=await response.text();assert.equal(response.status,200);
 // 자동 새로고침은 location.reload()로 건다. meta refresh는 #탭을 버려 보던 화면이 날아간다 (2026-09-06).
 if(refresh)assert.ok(html.includes(`setTimeout(()=>location.reload(),${refresh*1000});`));else assert.doesNotMatch(html,/setTimeout\(\(\)=>location\.reload/);
 assert.doesNotMatch(html,/http-equiv="refresh"/);
 if(refresh===30){assert.match(html,/카단 판정 GREEN/);assert.match(html,/<h2>판 old<\/h2>/);assert.match(html,/refresh=30/);assert.doesNotMatch(screen(html,'mailbox'),/q-card/);assert.doesNotMatch(screen(html,'ledger'),/data-kind="send"/);}
 }}finally{const closed=once(server,'close');server.close();server.closeAllConnections();await closed;}
});

const statusTile = html => html.match(/<div class="k">상태<\/div><div class="v">([^<]+)<\/div>/)[1];
const highLoad = {current:{memory:'normal',freePercent:80,swapUsed:0,load5:24},ncpu:12};

test('watch PID를 못 모으면 모름이다 — 수집 안 하고 없음이라 단정했다(card-63)', () => {
  const html = renderWallHtml(snapshot());
  const banner = html.match(/<div class="banner">([^<]+)<\/div>/)[1];
  assert.match(banner, /watch 모름/);
  assert.doesNotMatch(banner, /watch 없음/);
  assert.match(banner, /kadan watch 켜기 안내/);
  const running = renderWallHtml(snapshot({watchPid:12345}));
  assert.match(running, /watch 실행 중/);
  assert.match(running, /watch PID 12345/);
});

test('판정 꺼짐은 상태 타일에도 적용한다 — 높은 CPU로 몰래 주의라 판정했다(card-63)', () => {
  const html = renderWallHtml(snapshot({resources:highLoad,judge:false}));
  assert.equal(statusTile(html), '정상');
  assert.doesNotMatch(html, /class="resource-judgement"/);
  assert.match(html, /CPU 5분 24\.00\/12/);
});

test('판정을 켠 상태만 자원 주의를 반영한다(card-63)', () => {
  const html = renderWallHtml(snapshot({resources:highLoad,judge:true}));
  assert.equal(statusTile(html), '주의');
  assert.match(html, /카단 판정 AMBER \(cpu\)/);
});

test('세션 없음은 판정 토글과 무관하게 주의다(card-63)', () => {
  const tree = buildTree([{kind:'start',role:'missing-작업자',t}]);
  for (const judge of [false,true]) {
    assert.equal(statusTile(renderWallHtml(snapshot({tree,judge}))), '주의');
    assert.equal(statusTile(renderWallHtml(snapshot({tree,judge,resources:highLoad}))), '주의');
  }
});
