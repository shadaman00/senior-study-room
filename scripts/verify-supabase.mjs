// Supabase 연결·인수 조건 자동 검증 (PRD 8-2 : 데이터 무결성, RLS 보안)
// 사용법:  node --env-file=.env --env-file=.env.admin scripts/verify-supabase.mjs
//
// 임시 수강생 A, B 두 명을 만들어 검사하고, 끝나면 계정·교재·파일을 모두 지운다.
import { createClient } from '@supabase/supabase-js'
import { pinToEmail, pinToPassword } from '../src/lib/pin.js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anonKey || !serviceKey) {
  console.error('.env 에 VITE_SUPABASE_URL·VITE_SUPABASE_ANON_KEY, .env.admin 에 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

const BUCKET = 'learning-materials'
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, opts)
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? `  (${detail})` : ''}`)
}

const stamp = String(Date.now()).slice(-6)
const students = [
  { no: `99${stamp}1`, name: '검증A', pin: '1234' },
  { no: `99${stamp}2`, name: '검증B', pin: '567890' },
]
const createdIds = []

async function signIn(s) {
  const client = createClient(url, anonKey, opts)
  const { data, error } = await client.auth.signInWithPassword({
    email: pinToEmail(s.no),
    password: pinToPassword(s.pin),
  })
  if (error) throw new Error(`${s.name} 로그인 실패: ${error.message}`)
  return { client, uid: data.user.id }
}

try {
  // 0. 스키마 존재 확인
  const { error: schemaErr } = await admin.from('materials').select('id').limit(1)
  check('스키마(materials 테이블) 존재', !schemaErr, schemaErr?.message)
  if (schemaErr) throw new Error('supabase/schema.sql 을 SQL Editor 에서 먼저 실행하세요.')
  const { data: bucket } = await admin.storage.getBucket(BUCKET)
  check('비공개 버킷 learning-materials', bucket && bucket.public === false)

  // 1. PIN 계정 생성 (create-students 스크립트와 같은 규칙)
  for (const s of students) {
    const { data, error } = await admin.auth.admin.createUser({
      email: pinToEmail(s.no),
      password: pinToPassword(s.pin),
      email_confirm: true,
      user_metadata: { display_name: s.name },
    })
    if (error) throw new Error(`계정 생성 실패: ${error.message}`)
    createdIds.push(data.user.id)
  }
  check('PIN 계정 2개 생성', createdIds.length === 2)

  const A = await signIn(students[0])
  const B = await signIn(students[1])
  check('4자리·6자리 PIN 로그인', true)

  const { data: profA } = await A.client.from('profiles').select('display_name, font_scale').single()
  check('가입 시 profiles 자동 생성', profA?.display_name === '검증A' && profA?.font_scale === 1)

  // 2. 교재 등록 : 파일 업로드 + create_material(3단원)
  const pathA = `${A.uid}/verify-${stamp}.png`
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  const { error: upErr } = await A.client.storage.from(BUCKET).upload(pathA, png, { contentType: 'image/png' })
  check('A 본인 폴더에 파일 업로드', !upErr, upErr?.message)

  const { error: upOther } = await A.client.storage
    .from(BUCKET)
    .upload(`${B.uid}/hack-${stamp}.png`, png, { contentType: 'image/png' })
  check('A 가 B 폴더에 업로드 → 차단', !!upOther, upOther?.message)

  const { data: mat, error: rpcErr } = await A.client.rpc('create_material', {
    p_title: '검증용 교재',
    p_file_path: pathA,
    p_file_type: 'image',
    p_total_units: 3,
  })
  check('create_material 로 교재 + 3단원 생성', !rpcErr && mat?.total_units === 3, rpcErr?.message)

  const { data: items } = await A.client
    .from('progress_items')
    .select('id, unit_number, unit_title, is_completed')
    .eq('material_id', mat.id)
    .order('unit_number')
  check('체크리스트 3건 자동 생성', items?.length === 3 && items[0].unit_title === '1단원')

  // 3. 데이터 무결성 : 1단원 체크 → 33%
  const { error: togErr } = await A.client.from('progress_items').update({ is_completed: true }).eq('id', items[0].id)
  check('1단원 완료 체크', !togErr, togErr?.message)

  const { data: item1 } = await A.client.from('progress_items').select('is_completed, completed_at').eq('id', items[0].id).single()
  check('is_completed = true, completed_at 기록', item1.is_completed === true && !!item1.completed_at)

  const { data: matAfter } = await A.client.from('materials').select('completed_units, total_units').eq('id', mat.id).single()
  const pct = Math.round((matAfter.completed_units / matAfter.total_units) * 100)
  check('진행률 1/3 → 33% (새로 조회해도 유지)', matAfter.completed_units === 1 && pct === 33, `${pct}%`)

  await A.client.from('materials').update({ completed_units: 3 }).eq('id', mat.id)
  const { data: forged } = await A.client.from('materials').select('completed_units').eq('id', mat.id).single()
  check('completed_units 임의 수정 → 무시됨', forged.completed_units === 1, `값 ${forged.completed_units}`)

  await A.client.from('progress_items').update({ is_completed: false }).eq('id', items[0].id)
  const { data: undone } = await A.client.from('materials').select('completed_units').eq('id', mat.id).single()
  check('체크 취소 → 0단원으로 복귀', undone.completed_units === 0)

  // 4. RLS : B 가 A 의 데이터에 접근
  const { data: bMat } = await B.client.from('materials').select('*').eq('id', mat.id)
  check('B 가 A 교재 조회 → 빈 배열', Array.isArray(bMat) && bMat.length === 0)

  const { data: bItems } = await B.client.from('progress_items').select('*').eq('material_id', mat.id)
  check('B 가 A 진도 조회 → 빈 배열', Array.isArray(bItems) && bItems.length === 0)

  await B.client.from('progress_items').update({ is_completed: true }).eq('id', items[1].id)
  const { data: still } = await A.client.from('progress_items').select('is_completed').eq('id', items[1].id).single()
  check('B 가 A 진도 수정 → 반영 안 됨', still.is_completed === false)

  await B.client.from('materials').delete().eq('id', mat.id)
  const { data: survive } = await A.client.from('materials').select('id').eq('id', mat.id)
  check('B 가 A 교재 삭제 → 반영 안 됨', survive.length === 1)

  const { data: bSigned, error: bSignErr } = await B.client.storage.from(BUCKET).createSignedUrl(pathA, 60)
  check('B 가 A 파일 열람 주소 요청 → 차단', !!bSignErr && !bSigned, bSignErr?.message)

  const { error: bRpcErr } = await B.client.rpc('create_material', {
    p_title: '남의 파일',
    p_file_path: pathA,
    p_file_type: 'image',
    p_total_units: 1,
  })
  check('B 가 A 파일 경로로 교재 등록 → 차단', !!bRpcErr, bRpcErr?.message)

  // 4-2. 공부 시간 기록 (study_sessions)
  const now = new Date()
  const sessionA = {
    id: crypto.randomUUID(),
    material_id: mat.id,
    unit_number: 1,
    started_at: new Date(now - 300000).toISOString(),
    ended_at: now.toISOString(),
    seconds: 300,
  }
  const { error: sesErr } = await A.client.from('study_sessions').upsert(sessionA, { onConflict: 'id' })
  check('A 본인 공부 시간 기록', !sesErr, sesErr?.message)
  await A.client.from('study_sessions').upsert({ ...sessionA, seconds: 420 }, { onConflict: 'id' })
  const { data: sesA } = await A.client.from('study_sessions').select('seconds').eq('id', sessionA.id)
  check('같은 기록 덮어쓰기(upsert) → 420초', sesA?.[0]?.seconds === 420)

  const { data: bSes } = await B.client.from('study_sessions').select('*').eq('material_id', mat.id)
  check('B 가 A 공부 시간 조회 → 빈 배열', Array.isArray(bSes) && bSes.length === 0)

  const { error: bSesIns } = await B.client
    .from('study_sessions')
    .insert({ ...sessionA, id: crypto.randomUUID(), seconds: 9999 })
  check('B 가 A 교재로 공부 시간 기록 → 차단', !!bSesIns, bSesIns?.message)

  await B.client.from('study_sessions').upsert({ ...sessionA, seconds: 1 }, { onConflict: 'id' })
  const { data: sesA2 } = await A.client.from('study_sessions').select('seconds').eq('id', sessionA.id)
  check('B 가 A 공부 시간 덮어쓰기 → 반영 안 됨', sesA2?.[0]?.seconds === 420)

  const anon = createClient(url, anonKey, opts)
  const { data: anonMat } = await anon.from('materials').select('id')
  check('로그인 안 한 사용자 조회 → 빈 배열', Array.isArray(anonMat) && anonMat.length === 0)

  const { data: aSigned } = await A.client.storage.from(BUCKET).createSignedUrl(pathA, 60)
  const res = aSigned ? await fetch(aSigned.signedUrl) : null
  check('A 본인은 서명 주소로 파일 열람', res?.status === 200, `HTTP ${res?.status}`)

  // 5. 정리
  await admin.storage.from(BUCKET).remove([pathA])
} catch (e) {
  results.push(false)
  console.error(`❌ 중단: ${e.message}`)
} finally {
  for (const id of createdIds) await admin.auth.admin.deleteUser(id)
  if (createdIds.length) console.log(`🧹 임시 계정 ${createdIds.length}개 삭제 (교재·진도는 CASCADE 로 함께 삭제)`)
}

const failed = results.filter((r) => !r).length
console.log(failed ? `\n결과: ${failed}개 실패` : `\n결과: 전체 ${results.length}개 통과`)
process.exit(failed ? 1 : 0)
