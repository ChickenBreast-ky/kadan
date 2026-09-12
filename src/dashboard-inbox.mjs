import {escapeHtml as e} from './card-content.mjs';
import {readMailBody} from './ledger.mjs';
import {workLetters} from './work-mail.mjs';
const short=at=>Number.isFinite(Date.parse(at))?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at)):'시각 모름';

export function renderInbox(w,home,url=new URL('http://localhost')){
 const pages=Math.max(1,Math.ceil(w.letters.length/100)),page=Math.min(pages,Math.max(1,Number.parseInt(url.searchParams.get('mailPage'),10)||1));
 const items=w.letters.slice((page-1)*100,page*100);
 const nav=n=>{const u=new URL(url);u.searchParams.set('mailPage',String(n));u.searchParams.set('card',w.key);u.searchParams.set('detail','1');u.searchParams.set('tab','summary');u.hash='detail';return `${u.pathname}${u.search}${u.hash}`;};
 return `<div class="dd-history-heading"><h3>인박스 <span>${w.letters.length}통</span></h3><span class="muted">${pages>1?`${page}/${pages}쪽 · 100통씩 · `:''}최신순 · 행을 펼쳐 원문 확인</span></div>${!items.length?'<p>연결된 편지가 없습니다. 업무·실행 주소나 답장으로 연결된 편지만 보여줍니다.</p>':`<div class="dd-history-scroll" tabindex="0" aria-label="이 카드의 인박스"><table class="dd-history-table bw-mail"><colgroup><col style="width:100px"><col style="width:170px"><col></colgroup><thead><tr><th>시각</th><th>보낸 사람 → 받는 사람</th><th>내용</th></tr></thead><tbody>${items.map((m,i)=>{
  const id=`bw-mail-${i}`,body=(m.digest&&home?readMailBody(m.digest,home):null),text=body??m.preview??'본문을 읽을 수 없습니다.';
  const status=m.read===null?'전달 기록 · 읽음 모름':m.read?'비서 읽음 확인':'비서 보관 · 읽음 미확인';
  return `<tr data-dd-row="${id}"><td class="dd-time">${e(short(m.t))}</td><td class="di-people" title="${e(m.by||'모름')} → ${e(m.role||'모름')}"><span>${e(m.by||'모름')}</span><span>→ ${e(m.role||'모름')}</span></td><td><button class="dd-open" type="button" aria-expanded="false" aria-controls="${id}"><span class="dd-preview">${e(text.replace(/\s+/g,' ').slice(0,150))}</span><span aria-hidden="true">›</span></button></td></tr><tr class="dd-expanded" id="${id}" hidden><td colspan="3"><div class="dd-history-original dd-original"><div class="dd-original-head"><span>${e(status)}${m.replyTo?' · 답장':''}</span><button type="button" data-dd-close="${id}">접기</button></div><p class="dd-history-note">${e(text)}</p><details><summary>우편 정보 · 읽음 처리는 하지 않음</summary><p class="muted">우편 ID: ${e(m.mailId||m.digest||'모름')}${m.replyTo?` · 원본: ${e(m.replyTo)}`:''}</p></details></div></td></tr>`;
 }).join('')}</tbody></table></div>`}${pages>1?`<p class="bw-mail-pages">${page>1?`<a data-work-page href="${e(nav(page-1))}">이전 100통</a>`:''} ${page<pages?`<a data-work-page href="${e(nav(page+1))}">다음 100통</a>`:''}</p>`:''}`;
}

export function renderCardInbox(card,{entries=[],cards=[card],home,url}={}) {
 try {
  // 실행 주소와 고유한 카드 ID만 따른다. 상위 업무의 다른 실행 편지는 섞지 않는다.
  const letters=workLetters({key:'execution:'+card.key,executions:[{key:card.key}],mailRefs:[]},entries,cards);
  return renderInbox({key:card.key,letters},home,url);
 } catch { return '<h3>인박스</h3><p role="alert">인박스 확인 불가 · 원장을 읽을 수 없습니다.</p>'; }
}
