// 수강생 번호 + PIN 을 Supabase 이메일/비밀번호 로그인으로 바꿔 주는 규칙.
// Supabase 에는 PIN 로그인이 없으므로 가상 이메일(<번호>@<도메인>)과
// 비밀번호(접두어 + PIN)로 대신한다. 접두어는 Supabase 최소 비밀번호 길이(6자)를
// 4자리 PIN 도 통과하게 하려는 용도일 뿐, 보안 강도를 높여 주지는 않는다.
// 브라우저(Vite)와 계정 생성 스크립트(Node)가 같은 규칙을 쓰도록 이 파일을 공유한다.

const DOMAIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PIN_EMAIL_DOMAIN) ||
  (typeof process !== 'undefined' && process.env?.PIN_EMAIL_DOMAIN) ||
  'academy.local'

export function pinToEmail(studentNo) {
  return `s${String(studentNo).trim()}@${DOMAIN}`
}

export function pinToPassword(pin) {
  return `pin-${String(pin).trim()}`
}
