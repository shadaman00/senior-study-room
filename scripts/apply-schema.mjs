// supabase/schema.sql 을 Supabase 데이터베이스에 직접 적용한다 (SQL Editor 대신).
// schema.sql 은 여러 번 실행해도 안전하게 작성되어 있다.
import { readFileSync } from 'node:fs'
import pg from 'pg'

// 사용법:  node --env-file=.env --env-file=.env.admin scripts/apply-schema.mjs
// SUPABASE_DB_URL 이 없으면 프로젝트 ID + SUPABASE_DB_PASSWORD 로 접속 주소를 찾는다.
const POOLER_REGIONS = [
  'ap-northeast-2', 'ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-south-1',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1', 'sa-east-1',
  'eu-central-1', 'eu-central-2', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1',
]

function candidateUrls() {
  const explicit = process.env.SUPABASE_DB_URL?.trim()
  if (explicit?.startsWith('postgres')) return [explicit]
  const password = process.env.SUPABASE_DB_PASSWORD?.trim()
  const ref = process.env.VITE_SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
  if (!password || !ref) return []
  const pw = encodeURIComponent(password)
  return [
    `postgresql://postgres:${pw}@db.${ref}.supabase.co:5432/postgres`,
    ...['aws-0', 'aws-1'].flatMap((p) =>
      POOLER_REGIONS.map((r) => `postgresql://postgres.${ref}:${pw}@${p}-${r}.pooler.supabase.com:5432/postgres`),
    ),
  ]
}

async function connect() {
  const urls = candidateUrls()
  if (!urls.length) {
    console.error('.env 의 VITE_SUPABASE_URL 과 .env.admin 의 SUPABASE_DB_PASSWORD 를 채워 주세요.')
    process.exit(1)
  }
  let lastError
  for (const connectionString of urls) {
    const c = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 })
    try {
      await c.connect()
      console.log(`🔌 접속: ${new URL(connectionString).host}`)
      return c
    } catch (e) {
      lastError = e
      await c.end().catch(() => {})
      // 비밀번호가 틀린 경우는 다른 주소를 더 시도해도 소용없다
      if (/password authentication failed/i.test(e.message)) break
    }
  }
  throw new Error(
    /password authentication failed/i.test(lastError?.message)
      ? 'DB 비밀번호가 맞지 않습니다. SUPABASE_DB_PASSWORD 를 확인해 주세요.'
      : `DB 에 접속하지 못했습니다: ${lastError?.message}`,
  )
}

const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
let client

try {
  client = await connect()
  await client.query('begin')
  await client.query(sql)
  await client.query('commit')

  const { rows: tables } = await client.query(`
    select c.relname as name, c.relrowsecurity as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('profiles', 'materials', 'progress_items', 'study_sessions')
     order by 1`)
  const { rows: policies } = await client.query(
    `select count(*)::int as n from pg_policies where schemaname in ('public', 'storage') and policyname like '본인%'`,
  )
  const { rows: bucket } = await client.query(`select public from storage.buckets where id = 'learning-materials'`)

  console.log('✅ schema.sql 적용 완료')
  for (const t of tables) console.log(`   테이블 ${t.name}  RLS ${t.rls ? '켜짐' : '꺼짐'}`)
  console.log(`   보안 정책 ${policies[0].n}개, 버킷 learning-materials ${bucket[0]?.public === false ? '비공개' : '확인 필요'}`)
} catch (e) {
  await client?.query('rollback').catch(() => {})
  console.error(`❌ 적용 실패: ${e.message}`)
  process.exitCode = 1
} finally {
  await client?.end().catch(() => {})
}
