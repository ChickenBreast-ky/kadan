// 사용자(사람)로 인정하는 행위자 이름. 원장 by 값은 스스로 밝힌 신분이라 인증이 아니다.
// 기본은 '사람'·'사용자'·'@user'이고, 기계마다 추가 이름은 KADAN_USER_NAMES(쉼표 구분)로 준다.
export function userActorNames(env=process.env){
 const extra=String(env.KADAN_USER_NAMES||'').split(',').map(s=>s.trim()).filter(Boolean);
 return ['사람','사용자','@user',...extra];
}
export function isUserActor(by,env=process.env){return userActorNames(env).includes(by);}
