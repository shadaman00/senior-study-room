// 강사·관리자용 : 수강생 PIN 계정 일괄 생성 스크립트
// 사용법:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-students.mjs scripts/students.csv
//
// CSV 형식 (첫 줄은 머리글):  수강생번호,이름,PIN
//   1001,박만수,1234
//
// service_role 키는 관리자 PC 에서만 쓰고 절대 저장소에 올리지 않는다 (PRD 7).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { pinToEmail, pinToPassword } from '../src/lib/pin.js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const csvPath = process.argv[2]

if (!url || !serviceKey || !csvPath) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수와 CSV 경로가 필요합니다.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const rows = readFileSync(csvPath, 'utf8')
  .replace(/^﻿/, '')
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split(',').map((v) => v.trim()))

let ok = 0
for (const [studentNo, name, pin] of rows) {
  if (!/^\d{1,10}$/.test(studentNo) || !/^\d{4,6}$/.test(pin)) {
    console.error(`건너뜀: "${studentNo}" - 수강생 번호는 숫자, PIN 은 숫자 4~6자리여야 합니다.`)
    continue
  }
  const { error } = await admin.auth.admin.createUser({
    email: pinToEmail(studentNo),
    password: pinToPassword(pin),
    email_confirm: true,
    user_metadata: { display_name: name, student_no: studentNo },
  })
  if (error) console.error(`실패: ${studentNo} ${name} - ${error.message}`)
  else {
    ok += 1
    console.log(`생성: ${studentNo} ${name}`)
  }
}
console.log(`완료: ${ok} / ${rows.length} 명`)
