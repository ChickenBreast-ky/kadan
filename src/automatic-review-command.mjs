import {setTimeout as delay} from 'node:timers/promises';
import {AutomaticReview} from './automatic-review.mjs';

export async function automaticReviewCommand(args,flags,context){
 const [action,key]=args,auto=new AutomaticReview(context);
 if(action==='auto-show')return auto.get(key);
 if(action==='auto-configure')return auto.configure(key,{revision:flags.revision,implementation:flags.implementation,review:flags.review,worker:flags.worker,reviewer:flags.reviewer,notify:flags.notify,deadline:flags.deadline,nextBlock:flags['next-block']===true});
 if(action==='auto-report')return auto.report(key,{execution:flags.execution,outcome:flags.outcome,resultFile:flags['result-file']});
 if(action==='auto-step')return auto.step(key);
 if(action==='auto-run'){
  const seconds=flags.interval===undefined?2:Number(flags.interval);
  if(!Number.isFinite(seconds)||seconds<0.1||seconds>60)throw new Error('프로그램 확인 간격은 0.1~60초');
  for(;;){const s=auto.step(key);if(!['ready','waiting'].includes(s.status))return s;await delay(seconds*1000);}
 }
 throw new Error('자동 전달 명령: auto-configure | auto-show | auto-report | auto-step | auto-run');
}
