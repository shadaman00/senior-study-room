import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

// anon(public) 키만 사용한다. 데이터 보호는 RLS 가 담당 (PRD 7).
export const supabase = isConfigured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

export const BUCKET = 'learning-materials'
export const MAX_FILE_BYTES = 50 * 1024 * 1024
