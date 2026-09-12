export const cardDialogHtml=`<dialog id="card-dialog" aria-labelledby="card-dialog-title"><header class="dialog-toolbar"><h2 id="card-dialog-title">카드 상세</h2><button type="button" id="card-dialog-close" aria-label="카드 상세 닫기">닫기</button></header><p id="card-dialog-status" role="status" aria-live="polite"></p><div id="card-dialog-content"></div></dialog>`;
export const cardDialogStyle=`#card-dialog{width:min(920px,calc(100vw - 32px));max-height:calc(100dvh - 40px);padding:0;border:1px solid #cdd8d0;border-radius:12px;color:#202824;background:#fff;overflow:auto}#card-dialog::backdrop{background:rgb(16 32 23 / .42)}.dialog-toolbar{position:sticky;top:0;background:#fff;border-bottom:1px solid #e0e7e1;display:flex;align-items:center;justify-content:space-between;padding:14px 20px;z-index:1}.dialog-toolbar h2{margin:0;font-size:17px}#card-dialog-content .card-detail{border:0;margin:0;border-radius:0}#card-dialog-status{margin:0;padding:0 20px}#card-dialog-status:not(:empty){padding:12px 20px}#card-dialog .card-detail header span{overflow-wrap:anywhere}@media(max-width:600px){#card-dialog{width:calc(100vw - 16px);max-height:calc(100dvh - 16px)}.dialog-toolbar{padding:12px}}`;
export const cardDialogScript=`
 const cardDialog=document.getElementById('card-dialog'),dialogContent=document.getElementById('card-dialog-content'),dialogStatus=document.getElementById('card-dialog-status'),dialogClose=document.getElementById('card-dialog-close');
 let dialogRequest=null,dialogSource='',dialogDirty=false,dialogSaving=false,dialogOpener=null,dialogScroll=0,dialogOverflow='';
 const acceptDialogDiscard=()=>!dialogDirty||confirm('저장하지 않은 카드 기록이 있습니다. 닫을까요?');
 const replaceDialogDetail=html=>{const parsed=new DOMParser().parseFromString(html,'text/html'),article=parsed.querySelector('article#detail');if(!article)throw new Error('카드 상세를 불러오지 못했습니다. 다시 열어주세요.');article.id='dialog-card-detail';dialogContent.replaceChildren(document.importNode(article,true));dialogDirty=false;};
 function closeCardDialog(){if(dialogSaving||!acceptDialogDiscard())return;cardDialog.close();}
 dialogClose.addEventListener('click',closeCardDialog);
 cardDialog.addEventListener('cancel',event=>{event.preventDefault();closeCardDialog();});
 cardDialog.addEventListener('click',event=>{if(event.target!==cardDialog)return;const r=cardDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeCardDialog();});
 cardDialog.addEventListener('close',()=>{dialogRequest?.abort();document.body.style.overflow=dialogOverflow;dialogOpener?.focus({preventScroll:true});window.scrollTo(0,dialogScroll);});
 document.addEventListener('click',async event=>{
  const anchor=event.target.closest('.human-dashboard a[href]');if(!anchor||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const target=new URL(anchor.href,location.href);if(target.origin!==location.origin||!target.searchParams.has('card')||target.hash!=='#detail')return;
  event.preventDefault();dialogOpener=anchor;dialogScroll=window.scrollY;dialogOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialogContent.replaceChildren();dialogDirty=false;dialogSource=target.href;dialogStatus.textContent='카드 불러오는 중…';cardDialog.showModal();dialogClose.focus();
  dialogRequest?.abort();const request=new AbortController();dialogRequest=request;
  try{const response=await fetch(dialogSource,{signal:request.signal});if(!response.ok)throw new Error('카드를 읽지 못했습니다. 닫은 뒤 다시 열어주세요.');const html=await response.text();if(request.signal.aborted||!cardDialog.open)return;replaceDialogDetail(html);dialogStatus.textContent='';}catch(error){if(error.name!=='AbortError')dialogStatus.textContent=error.message;}
 });
 dialogContent.addEventListener('input',()=>dialogDirty=true);dialogContent.addEventListener('change',()=>dialogDirty=true);
 dialogContent.addEventListener('submit',async event=>{
  const form=event.target;if(!form.matches('form[action="/cards/update"]'))return;event.preventDefault();if(dialogSaving)return;
  dialogSaving=true;dialogClose.disabled=true;const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);dialogStatus.textContent='저장 중…';
  try{const response=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form))});const html=await response.text();if(!response.ok)throw new Error(html||'저장 실패');replaceDialogDetail(html);dialogStatus.textContent='저장했습니다.';}catch(error){dialogStatus.textContent=error.message;buttons.forEach(b=>b.disabled=false);}finally{dialogSaving=false;dialogClose.disabled=false;}
 });
 dialogContent.addEventListener('click',event=>{const a=event.target.closest('a[href^="#decision-"]');if(!a)return;if(dialogSaving||!acceptDialogDiscard()){event.preventDefault();return;}cardDialog.close();});
`;
