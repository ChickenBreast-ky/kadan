import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {ledgerHome} from './ledger.mjs';

// 승인된 시안의 읽기용 설명. 데이터는 코드가 아니라 데이터 폴더의 detail-guides.json에 둔다.
// 원문이 바뀌면 지시 요약을, 상태 기록이 바뀌면 상황 요약을 사용하지 않는다.
let cached=null;
function loadGuides(){
 if(cached)return cached;
 const file=path.join(ledgerHome(),'detail-guides.json');
 try{cached=JSON.parse(fs.readFileSync(file,'utf8'));}catch{cached={};}
 return cached;
}
const hash=text=>createHash('sha256').update(String(text??'')).digest('hex');
export function approvedDetailGuide(card,source=loadGuides()){
 const guide=source[card.key];if(!guide||hash(card.body)!==guide.bodyHash)return null;
 const fresh=card.revision===guide.revision&&card.status===guide.status&&card.displayState===guide.displayState&&hash(card.statusReason)===guide.reasonHash;
 return {work:guide.work,summary:fresh?guide.summary:null};
}
