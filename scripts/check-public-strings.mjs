#!/usr/bin/env node
// 공개 레포에 개인 경로·이름·작업장 기록이 섞이지 않았는지 검사한다. 걸리면 파일:줄을 출력하고 1로 끝난다.
// 사용: node scripts/check-public-strings.mjs [경로...]  (기본: src tests scripts skills package.json README.md AGENTS.md)
import fs from 'node:fs';
import path from 'node:path';
const banned=[/\/Users\//,/fw_m1/,/kyle-hub/,/moducerti/i,/securenet/i,/wonseongjang/,/kyle-control-plane/,/Kyle-Brain/,/docs\/daily\/[0-9]/,/kyle-agent-skills/];
const targets=process.argv.slice(2).length?process.argv.slice(2):['src','tests','scripts','skills','docs','package.json','README.md','AGENTS.md','CONTRIBUTING.md','NOTICE'];
const files=[];
const walk=p=>{if(!fs.existsSync(p))return;const st=fs.statSync(p);if(st.isDirectory()){if(path.basename(p)==='.git'||path.basename(p)==='node_modules')return;for(const n of fs.readdirSync(p))walk(path.join(p,n));}else files.push(p);};
for(const t of targets)walk(t);
let hits=0;
for(const f of files){if(f===path.join('scripts','check-public-strings.mjs'))continue;
 const text=fs.readFileSync(f,'utf8');text.split('\n').forEach((line,i)=>{for(const re of banned){if(re.test(line)){hits++;console.log(f+':'+(i+1)+': '+line.trim().slice(0,120));break;}}});}
console.log(hits?`개인 문자열 ${hits}건`:`개인 문자열 0건 (파일 ${files.length}개)`);
process.exit(hits?1:0);
