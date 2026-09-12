// 페이지에 직렬화한다. 보기 전환은 기존 폼과 작성 중인 값을 교체하지 않는다.
export function installWorkspaceDetail() {
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
 let view='table',appliedArticle=null,appliedView=null;
 const tableMode=()=>view==='table';
 function apply(value){
  view=value==='document'?'document':'table';
  const article=$('article#detail');if(!article?.querySelectorAll)return;
  if(article===appliedArticle&&view===appliedView)return;
  appliedArticle=article;appliedView=view;
  article.dataset.detailView=view;
  $$('[data-detail-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.detailView===view)));
  $$('[data-dd-row]').forEach(row=>{const expanded=$('#'+row.dataset.ddRow);expanded.hidden=tableMode()?(row.hidden||row.querySelector('button').getAttribute('aria-expanded')!=='true'):false;});
  const prefix=$('.dd-work-prefix');if(prefix)prefix.open=!tableMode();
  filter();
 }
 function toggle(row){
  const button=row.querySelector('button'),open=button.getAttribute('aria-expanded')!=='true';
  row.closest('tbody').querySelectorAll('[data-dd-row]').forEach(r=>{r.classList.remove('selected');r.querySelector('button').setAttribute('aria-expanded','false');$('#'+r.dataset.ddRow).hidden=true;});
  if(open){row.classList.add('selected');button.setAttribute('aria-expanded','true');$('#'+row.dataset.ddRow).hidden=false;}
 }
 function filter(){
  const input=$('#dd-work-search');if(!input)return;
  const query=tableMode()?input.value.trim().toLocaleLowerCase('ko'):'',rows=$$('.dd-work-table [data-dd-row]');let count=0;
  for(const row of rows){const original=$('#'+row.dataset.ddRow),match=(row.textContent+' '+original.querySelector('.dd-original-body').textContent).toLocaleLowerCase('ko').includes(query);row.hidden=!match;if(match)count++;else {row.classList.remove('selected');row.querySelector('button').setAttribute('aria-expanded','false');}original.hidden=tableMode()?(!match||row.querySelector('button').getAttribute('aria-expanded')!=='true'):false;}
  $('#dd-work-count').textContent=(query?count+' / ':'')+rows.length+'개 항목';$('#dd-work-empty').hidden=count>0;
 }
 function click(event){
  const reset=event.target.closest('[data-dd-reset]');
  if(reset){$('#dd-work-search').value='';filter();$('#dd-work-search').focus({preventScroll:true});return true;}
  const close=event.target.closest('[data-dd-close]');
  if(close){const row=$$('[data-dd-row]').find(r=>r.dataset.ddRow===close.dataset.ddClose);toggle(row);row.querySelector('button').focus({preventScroll:true});return true;}
  const row=event.target.closest('[data-dd-row]');
  if(row&&tableMode()&&!event.target.closest('a')&&(event.target.closest('button')||!window.getSelection()?.toString())){toggle(row);return true;}
  return false;
 }
 return {apply,click,input:event=>{if(event.target.id==='dd-work-search')filter();}};
}
