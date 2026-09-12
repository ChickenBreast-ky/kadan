import fs from 'node:fs';
import {BriefStore} from './human-brief.mjs';
import { CardStore } from './card-store.mjs';
export function cardCommand(args,flags,{home,by}) {
  const store=new CardStore(home),[command,key]=args;
  if(flags.help||!command)return 'kadan card list | show <저장소/ID> | create <저장소/ID> --repo-path <절대경로> --source <파일> [--title 제목] [--work-type execution|coordination] | update <키> --revision N --status draft|ready|assigned|hold|done|cancelled|superseded --scope <승인범위> --board <판> --role <역할> --note <이유> [--status-reason <상태이유>] [--resolution-owner <후속담당>] [--next-action <다음행동>] [--rally-id 묶음 --rally-title 제목 --rally-round N --rally-step implementation|fix|review|research] [--replaced-by 저장소/후속카드] [--turn-owner 현재차례] | note <키> --revision N --kind decision|question|answer|progress --note <내용> [--turn-owner 현재차례] | brief <키> --revision N --title <쉬운제목> --workstream <작업묶음> [--stage 구현|검수|통합|프리뷰 확인|조율|조사|기타] [--goal 목표] [--summary 설명] [--next 다음일] [--blocker 막힌이유] | link <키>. 실행 카드를 assigned로 바꿀 때는 티키타카 묶음(--rally-*)이 필수다(작은 작업은 1싸이클 구현 라운드).';
  if(command==='brief')return new BriefStore(home).write(key,flags,by);
  if(command==='list')return store.list().filter(c=>(!flags.status||c.status===flags.status)&&(!flags.repo||c.repo===flags.repo)).map(c=>({key:c.key,title:c.title,status:c.status,board:c.board,role:c.role,workType:c.workType||'execution',revision:c.revision}));
  if(command==='show')return store.get(key);
  if(command==='link')return store.link(key);
  if(command==='create') {
    store.dir(key);const [repo,id]=key.split('/');
    return store.create({repo,id,repoPath:flags['repo-path'],sourcePath:flags.source,title:flags.title,workType:flags['work-type'],body:flags['body-file']?fs.readFileSync(flags['body-file'],'utf8'):undefined,by});
  }
  if(['update','note','progress'].includes(command)) {
    const patch=command==='progress'?{activity:flags.activity}:{};
    if(command==='update')for(const k of ['title','status','scope','board','role'])if(flags[k]!==undefined)patch[k]=flags[k];
    if(command==='update'&&flags['work-type']!==undefined)patch.workType=flags['work-type'];
    for(const [flag,field] of [['turn-owner','turnOwner'],['status-reason','statusReason'],['resolution-owner','resolutionOwner'],['next-action','nextAction'],['rally-id','rallyId'],['rally-title','rallyTitle'],['rally-round','rallyRound'],['rally-step','rallyStep'],['replaced-by','replacedBy']])if(flags[flag]!==undefined)patch[field]=flags[flag];
    return store.update(key,patch,{revision:flags.revision,by,noteKind:command==='progress'?'progress':flags.kind??'decision',note:flags.note,manual:true});
  }
  throw new Error('알 수 없는 card 명령');
}
