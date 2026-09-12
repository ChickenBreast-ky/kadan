import test from 'node:test';
import assert from 'node:assert/strict';
import * as cli from '../src/cli.mjs';
const t = '2026-09-05T00:00:00.000Z';
const plan = taskId => ({kind:'plan', board:'p', taskId, t});
const send = taskId => ({kind:'send', role:'p-작업자', taskId, t});
const done = (taskId, result) => ({...send(taskId), kind:'done', result});
const line = '라운드 card-x: 2/18 (블록 1/6) — r1 failed·검수 ok, r2 ok·검수 보냄';
const entries = [plan('card-x'), send('card-x'), done('card-x','failed'), done('card-x-review','ok'), done('card-x-r2','ok'), send('card-x-r2-검수')];
const html = tree => cli.renderWallHtml({tree, collectedAt:t, ledgerLines:1, all:true});

test('라운드는 -r<k>와 -review/-검수 접미사로 센다 — done은 카드당 한 번뿐이라 새 id가 라운드다(card-61)', () => {
  for (const [id, family, round, review] of [
    ['card-x','card-x',1,false], ['card-x-r2','card-x',2,false],
    ['card-x-r2-review','card-x',2,true], ['card-x-검수','card-x',1,true],
    ['a-review-r3','a-review',3,false], ['a-r0','a-r0',1,false],
    ['a-r2-middle','a-r2-middle',1,false], ['a-r18-검수','a',18,true],
  ]) assert.deepEqual(cli.cardRound(id), {family,round,review});
});
test('tree는 카드 가족의 라운드 수를 보인다 — 몇 라운드인지 몰라 [kyle]이 판단할 수 없었다(2026-09-05)(card-61)', () => {
  const tree = cli.buildTree(entries);
  assert.deepEqual(tree[0].rounds, [{family:'card-x',latestRound:2,
    workCards:[{taskId:'card-x',round:1,state:'done',result:'failed'},{taskId:'card-x-r2',round:2,state:'done',result:'ok'}],
    reviewCards:[{taskId:'card-x-review',round:1,state:'done',result:'ok'},{taskId:'card-x-r2-검수',round:2,state:'sent',result:undefined}]}]);
  assert.ok(cli.renderTree(tree).includes(line));
  const planned = cli.buildTree([plan('z-r3'),plan('a'),plan('a')]);
  assert.deepEqual(planned[0].rounds.map(x=>x.family), ['a','z']);
  assert.equal(planned[0].rounds[0].workCards.length,1);
  assert.equal(planned[0].rounds[1].workCards[0].state,'planned');
  assert.ok(cli.renderTree(planned).includes('라운드 z: 3/18 (블록 1/6) — r3 발령 전'));
  assert.ok(cli.renderTree(planned).indexOf('발령 전 2장') < cli.renderTree(planned).indexOf('라운드'));
  assert.equal(cli.buildTree([...entries,{...send('card-x-r7'),role:'q-작업자'}])[1].rounds[0].latestRound,7);
});
test('9라운드와 18라운드는 글자로만 표시하고 막지 않는다 — 관문 금지(AGENTS.md)(card-61)', () => {
  for (const n of [8,9,18,19]) {
    const tree = cli.buildTree([send(`card-x-r${n}`)]);
    const text = cli.renderTree(tree);
    assert.equal(text.includes('정체 확인'),n>=9);
    assert.equal(text.includes('상한 — 사용자 결정'),n>=18);
    assert.equal(tree[0].rounds[0].latestRound,n);
  }
});
test('wall 라운드 줄은 tree와 같고 HTML을 이스케이프한다(card-61)', () => {
  assert.ok(html(cli.buildTree(entries)).includes(`<p>${line}</p>`));
  assert.ok(html(cli.buildTree([plan('<x>&"\'-r2-review')])).includes('라운드 &lt;x&gt;&amp;&quot;&#39;: 2/18 (블록 1/6) — r2 검수 발령 전'));
  const empty = cli.buildTree([{kind:'start',role:'p-작업자',t}]);
  assert.deepEqual(empty[0].rounds,[]);
  assert.ok(!html(empty).includes('<p>라운드 '));
  assert.ok(!cli.renderTree(empty).includes('라운드'));
});
