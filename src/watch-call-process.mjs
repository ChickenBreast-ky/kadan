// 감시AI 한 호출의 프로세스 구획만 종료한다. 다른 역할/감시 프로세스에는 신호를 보내지 않는다.
import {spawn} from 'node:child_process';
const [command,limit]=process.argv.slice(2);
const timeout=Number(limit);
if(!command||!Number.isFinite(timeout)||timeout<=0)process.exit(2);
const child=spawn(command,{shell:true,detached:true,stdio:['pipe','pipe','pipe']});
let exitCode=null,closing=false,hardStop;
const signalGroup=signal=>{if(child.pid)try{process.kill(-child.pid,signal)}catch{}};
const stop=(reason='cancelled')=>{
 if(closing)return;closing=true;
 exitCode=reason==='reported'?0:reason==='timeout'?124:143;
 if(reason==='timeout')process.stderr.write('KADAN_JUDGE_TIMEOUT=1\n');
 if(reason==='cancelled')process.stderr.write('KADAN_JUDGE_CANCELLED=1\n');
 signalGroup('SIGTERM');
 hardStop=setTimeout(()=>{signalGroup('SIGKILL');process.exit(exitCode);},1000);
};
const timer=setTimeout(()=>stop('timeout'),timeout);
process.on('SIGTERM',()=>stop());process.on('SIGINT',()=>stop());
process.on('disconnect',()=>stop());
process.on('message',message=>{if(['reported','cancelled'].includes(message?.kind))stop(message.kind);});
process.stdin.pipe(child.stdin);child.stdin.on('error',()=>{});
child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);
child.on('error',()=>{clearTimeout(timer);clearTimeout(hardStop);process.exit(1)});
child.on('close',code=>{
 clearTimeout(timer);clearTimeout(hardStop);
 // 부모가 먼저 종료돼도 남아 있는 같은 호출의 자식에게 종료 신호를 보낸다.
 signalGroup('SIGKILL');
 process.exit(exitCode??code??1);
});
