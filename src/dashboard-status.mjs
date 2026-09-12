import {escapeHtml as e} from './card-content.mjs';
import {progressLabel,queueLabel} from './human-brief.mjs';

// 현황 화면: 확인 필요·진행 중 업무를 표 바깥으로 꺼내 사람이 위에서 아래로 읽는 순서로 보여준다.
const stamp=x=>x?new Date(x).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'모름';
const ATTENTION_STATES=['unconfirmed','orphaned','failed'];
const pillText=c=>['unconfirmed','running','waiting'].includes(c.displayState)?progressLabel(c):({orphaned:'세션 없음 · 미완료',failed:'실패 기록 있음'})[c.displayState]||c.displayState;
const cardLink=c=>'<a data-card-key="'+e(c.key)+'" href="?card='+encodeURIComponent(c.key)+'#detail">'+e(c.title||c.id)+'</a>';
const workLink=w=>'<a data-card-key="'+e(w.key)+'" href="?card='+encodeURIComponent(w.key)+'#detail">'+e(w.title)+'</a>';

function attentionCard(c){
 return '<article class="st-attn-card">'
  +'<div class="st-attn-head"><span class="state '+e(c.displayState)+'">'+e(pillText(c))+'</span><span class="st-attn-title">'+cardLink(c)+'</span></div>'
  +'<p class="st-attn-meta">'+e(c.board||'판 미지정')+' · 담당 '+e(c.role||'모름')+' · 마지막 기록 '+e(stamp(c.at))+(queueLabel(c)?' · '+e(queueLabel(c)):'')+'</p>'
 +'</article>';
}

function workCard(w){
 return '<article class="st-work">'
  +'<div class="st-work-top"><span class="state '+e(w.state)+'">'+e(w.stateLabel)+'</span><span class="st-work-board">'+e(w.board||w.repo)+' · '+e(w.flowLabel)+'</span><span class="st-work-prog">'+e(w.flowPhase)+'</span></div>'
  +'<h3 class="st-work-title">'+workLink(w)+'</h3>'
  +(w.purpose?'<p class="st-work-purpose">'+e(w.purpose)+'</p>':'')
  +'<dl class="st-work-grid">'
   +'<dt>지금 차례</dt><dd class="st-turn">'+e(w.turnLabel)+'</dd>'
   +'<dt>다음 행동</dt><dd>'+e(w.next)+'</dd>'
  +'</dl>'
  +'<div class="st-work-foot"><span class="st-when">마지막 보고 '+e(w.reportLabel)+'</span>'+(w.summary?'<span class="st-sum">'+e(w.summary)+'</span>':'')+'</div>'
 +'</article>';
}

export function renderDashboardStatus({center,works,workError=null,decisions=[],decisionError=null}){
 const decisionsOpen=decisions.filter(d=>d.status==='open');
 const attention=(center?.cards??[]).filter(c=>ATTENTION_STATES.includes(c.displayState));
 const runningWorks=(works??[]).filter(w=>w.state==='running');
 const holdWorks=(works??[]).filter(w=>w.state==='hold');
 const closedWorks=(works??[]).filter(w=>['done','cancelled'].includes(w.state));
 const summary=center?.summary;
 const chip=(cls,href,num,label,title)=>'<a class="st-chip '+cls+'" href="'+href+'"'+(title?' title="'+e(title)+'"':'')+'><span class="st-num">'+num+'</span><span class="st-lbl">'+e(label)+'</span></a>';
 const workBlock=works===null
  ?'<p class="st-error" role="alert">업무 기록을 읽을 수 없습니다'+(workError?': '+e(workError):'.')+' 확인 필요와 판 수치는 아래에 그대로 표시합니다.</p>'
  :(runningWorks.length?runningWorks.map(workCard).join(''):'<p class="st-empty">진행 중인 업무가 없습니다.</p>');
 const attentionList=attention.length<=10?attention.map(attentionCard).join('')
  :attention.slice(0,8).map(attentionCard).join('')+'<details class="st-fold"><summary>나머지 확인 필요 '+(attention.length-8)+'장</summary>'+attention.slice(8).map(attentionCard).join('')+'</details>';

 return '<div data-view="status" class="st-view">'
 +'<div class="st-band" role="group" aria-label="지금 상황 요약">'
  +chip('st-c-attn','#status-attention',center?attention.length:'모름','확인 필요','발령됐지만 시작 보고가 없거나, 세션을 확인해야 하거나, 실패가 기록된 실행 카드')
  +chip('st-c-run','#status-running',works===null?'모름':runningWorks.length,'진행 중 업무')
  +chip('st-c-decision','#decisions',decisionError?'모름':decisionsOpen.length,'내 결정 대기')
  +chip('st-c-dim','#boards',summary?summary.openBoards:'모름','열린 판')
  +chip('st-c-dim','#dashboard',summary?summary.cards:'모름','전체 실행 카드','표·정렬·검색이 필요할 때 작업 화면으로')
 +'</div>'
 +'<section id="status-attention" class="st-section" aria-labelledby="status-attention-h">'
  +'<header class="st-sec-head"><h2 id="status-attention-h">확인 필요</h2><span class="st-cnt st-cnt-attn">'+(center?attention.length+'건':'모름')+'</span><span class="st-hint">발령 후 시작 보고가 없거나 세션·실패 확인이 필요한 실행. 사람이 볼 때까지 여기 남습니다.</span></header>'
  +(center?(attention.length?attentionList:'<p class="st-empty">지금 확인이 필요한 실행이 없습니다.</p>'):'<p class="st-error">카드 기록을 읽지 못해 확인 필요 수를 계산하지 않았습니다.</p>')
 +'</section>'
 +'<section id="status-running" class="st-section" aria-labelledby="status-running-h">'
  +'<header class="st-sec-head"><h2 id="status-running-h">진행 중인 업무</h2><span class="st-cnt st-cnt-run">'+(works===null?'모름':runningWorks.length+'장')+'</span><span class="st-hint">다음 행동과 지금 차례를 자르지 않고 보여줍니다. 제목을 누륵면 업무 상세로 갑니다.</span></header>'
  +workBlock
 +'</section>'
 +(holdWorks.length?'<section class="st-section"><header class="st-sec-head"><h2>보류 중인 업무</h2><span class="st-cnt">'+holdWorks.length+'장</span></header>'+holdWorks.map(w=>'<p class="st-hold-row">'+workLink(w)+' <small>· '+e(w.next)+'</small></p>').join('')+'</section>':'')
 +(closedWorks.length?'<details class="st-fold"><summary>끝난 업무 '+closedWorks.length+'장</summary>'+closedWorks.map(w=>'<p class="st-hold-row"><span class="state '+e(w.state)+'">'+e(w.stateLabel)+'</span> '+workLink(w)+' <small>· '+e(w.board||w.repo)+' · '+e(w.reportLabel)+'</small></p>').join('')+'</details>':'')
 +'<p class="st-footnote">수치는 실행 카드 기준이며 제품 완성률이 아닙니다. 표·정렬·검색은 <a href="#dashboard">작업 화면</a>에서 그대로 쓸 수 있습니다.</p>'
 +'</div>';
}

export const dashboardStatusStyle=[
'.st-view{padding:4px 0 0}.st-band{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 26px}.st-chip{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #dfe6e0;border-radius:9px;padding:10px 16px;text-decoration:none;color:#202724;min-width:118px}.st-chip:hover{border-color:#9bb5a6;background:#fbfdfc}.st-chip .st-num{font-size:22px;font-weight:750;line-height:1.1}.st-chip .st-lbl{font-size:12px;color:#536159}.st-chip::before{content:"";width:8px;height:8px;border-radius:50%;background:#cbd2cd;flex-shrink:0}.st-c-attn{background:#fff0d0;border-color:#b68625}.st-c-attn::before{background:#b68625}.st-c-attn .st-num{color:#794e00}.st-c-run::before{background:#e68a27}.st-c-decision::before{background:#158064}',
'.st-section{margin-bottom:28px}.st-sec-head{display:flex;align-items:baseline;gap:12px;margin-bottom:12px;flex-wrap:wrap}.st-sec-head h2{font-size:16px;margin:0;font-weight:750}.st-cnt{font-size:13px;font-weight:700}.st-cnt-attn{color:#794e00}.st-cnt-run{color:#814600}.st-hint{font-size:12px;color:#536159;margin-left:auto}',
'.st-attn-card{background:#fff;border:1px solid #dfe6e0;border-left:4px solid #b68625;border-radius:8px;padding:12px 18px;margin-bottom:10px}.st-attn-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.st-attn-title{font-weight:700;font-size:14px}.st-attn-meta{font-size:12.5px;color:#536159;margin:4px 0 0}',
'.st-work{background:#fff;border:1px solid #dfe6e0;border-radius:10px;padding:18px 22px;margin-bottom:14px}.st-work-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12.5px}.st-work-board{color:#536159}.st-work-prog{margin-left:auto;font-weight:700;font-size:12.5px}.st-work-title{margin:8px 0 2px;font-size:16.5px;font-weight:750;line-height:1.35}.st-work-title a{color:#202724;text-decoration:none}.st-work-title a:hover{text-decoration:underline}.st-work-purpose{font-size:13px;color:#536159;margin:0 0 12px}.st-work-grid{display:grid;grid-template-columns:120px minmax(0,1fr);gap:4px 18px;border-top:1px solid #dfe6e0;padding-top:12px;margin:0}.st-work-grid dt{font-size:11px;font-weight:700;letter-spacing:.04em;color:#536159;padding-top:2px}.st-work-grid dd{font-size:13.5px;margin:0;overflow-wrap:anywhere}.st-work-grid dd.st-turn{font-weight:700}.st-work-foot{margin-top:12px;padding-top:10px;border-top:1px solid #dfe6e0;font-size:12.5px;color:#536159;display:flex;gap:14px;flex-wrap:wrap}.st-work-foot .st-when{font-weight:700;color:#202724;white-space:nowrap}.st-work-foot .st-sum{overflow-wrap:anywhere}',
'.st-fold{border:1px solid #dfe6e0;border-radius:8px;background:#fff;padding:12px 18px;margin-bottom:10px;font-size:13.5px}.st-fold>summary{cursor:pointer;font-weight:600;color:#245c44}.st-hold-row{margin:8px 0;overflow-wrap:anywhere}.st-hold-row small{color:#536159}.st-empty{color:#536159}.st-error{color:#8f251e}.st-footnote{font-size:12px;color:#536159}',
'@media (max-width:800px){.st-band{flex-wrap:nowrap;overflow-x:auto;padding-bottom:6px}.st-chip{flex:0 0 auto}.st-work{padding:14px 16px}.st-work-grid{grid-template-columns:1fr;gap:2px}.st-work-grid dt{margin-top:8px}.st-work-prog{margin-left:0;width:100%}.st-hint{margin-left:0;width:100%}}'
].join('\n');
