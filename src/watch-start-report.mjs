import {workEntries,effectiveCardRole} from './handover-state.mjs';
export function assessMissingStartReports(cards,entries,observations,now,graceMs){
 cards=cards.map(c=>({...c,role:effectiveCardRole(c,entries)}));
 const pending=new Map();for(const e of workEntries(entries)){if(!e.role||!e.taskId)continue;const k=e.role+'\0'+e.taskId;if(e.kind==='send')pending.set(k,e);if(e.kind==='done')pending.delete(k);}
 const counts=new Map();for(const c of cards)counts.set(c.id,(counts.get(c.id)||0)+1);
 const alerts=[];
 for(const c of cards){
  if(c.status!=='assigned'||!c.role||counts.get(c.id)!==1)continue;
  const sent=pending.get(c.role+'\0'+c.id),at=Date.parse(sent?.t);if(!Number.isFinite(at)||now-at<graceMs)continue;
  if(['running','waiting'].includes(c.activity)&&c.activityRole===c.role&&Date.parse(c.activityAt)>=at&&Date.parse(c.activityAt)<=now)continue;
  const seen=observations.get('kadan-'+c.role);
  if(!seen?.alive||seen.digest==null||seen.expectedPid!=null&&String(seen.pid)!==String(seen.expectedPid))continue;
  const done=(seen.screen||'').trimEnd().split('\n').slice(-6).some(line=>{const m=line.trim().match(/^KADAN:DONE (\S+) (ok|failed)$/);return m?.[1]===c.id;});if(done)continue;
  alerts.push({id:`start-report:${c.key}:${c.role}:${sent.t}`,kind:'시작보고누락',role:c.role,session:'kadan-'+c.role,taskId:c.id,level:'AMBER',sentAt:sent.t,waitMinutes:Math.floor((now-at)/60000)});
 }
 return alerts;
}
