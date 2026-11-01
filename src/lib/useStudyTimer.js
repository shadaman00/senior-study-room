import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'

// 실제로 공부한 시간을 잰다.
// - 화면이 보이는 동안(다른 앱·화면 꺼짐 제외)
// - 마지막으로 화면을 만진 지 IDLE_MS 안일 때만 센다 (교재를 펴 놓고 자리를 비운 시간 제외)
// 단원별로 따로 쌓고, 30초마다·화면을 떠날 때 study_sessions 에 덮어써 저장한다.
const IDLE_MS = 5 * 60 * 1000
const FLUSH_MS = 30 * 1000
const MIN_SAVE_MS = 10 * 1000
const MAX_TICK_MS = 5 * 1000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']

export function useStudyTimer(materialId, currentUnit) {
  const unitRef = useRef(currentUnit)
  unitRef.current = currentUnit
  // 이번 방문에서 단원별로 잰 초 (화면 표시용, 저장할 때마다 갱신)
  const [visitSeconds, setVisitSeconds] = useState({})

  useEffect(() => {
    if (!materialId) return
    const buckets = new Map() // unit_number → { id, ms, started_at, ended_at, saved }
    let last = Date.now()
    let lastActive = Date.now()
    let token = null
    supabase.auth.getSession().then(({ data }) => (token = data.session?.access_token ?? null))

    const markActive = () => (lastActive = Date.now())

    const tick = () => {
      const now = Date.now()
      const dt = Math.min(now - last, MAX_TICK_MS)
      last = now
      if (document.visibilityState !== 'visible' || now - lastActive > IDLE_MS) return
      const unit = unitRef.current ?? null
      let b = buckets.get(unit)
      if (!b) {
        b = { id: crypto.randomUUID(), ms: 0, started_at: new Date(now - dt).toISOString(), savedSec: 0 }
        buckets.set(unit, b)
      }
      b.ms += dt
      b.ended_at = new Date(now).toISOString()
    }

    const pending = () =>
      [...buckets.entries()]
        .filter(([, b]) => b.ms >= MIN_SAVE_MS && Math.round(b.ms / 1000) !== b.savedSec)
        .map(([unit, b]) => ({
          row: {
            id: b.id,
            material_id: materialId,
            unit_number: unit,
            started_at: b.started_at,
            ended_at: b.ended_at,
            seconds: Math.round(b.ms / 1000),
          },
          b,
        }))

    const publish = () =>
      setVisitSeconds(Object.fromEntries([...buckets.entries()].map(([u, b]) => [u ?? 'none', Math.round(b.ms / 1000)])))

    async function flush() {
      tick()
      const list = pending()
      publish()
      if (!list.length) return
      const { error } = await supabase.from('study_sessions').upsert(list.map((x) => x.row), { onConflict: 'id' })
      // 저장하는 동안 더 쌓인 시간은 다음 저장 때 다시 보낸다
      if (!error) list.forEach((x) => (x.b.savedSec = x.row.seconds))
      const { data } = await supabase.auth.getSession()
      token = data.session?.access_token ?? token
    }

    // 페이지를 닫거나 앱을 벗어날 때 : 응답을 기다리지 않아도 전송되도록 keepalive 로 보낸다
    function flushOnLeave() {
      tick()
      const list = pending()
      if (!list.length || !token) return
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/study_sessions?on_conflict=id`, {
        method: 'POST',
        keepalive: true,
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(list.map((x) => x.row)),
      }).catch(() => {})
      list.forEach((x) => (x.b.savedSec = x.row.seconds))
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushOnLeave()
      else {
        last = Date.now()
        markActive()
      }
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true, capture: true }))
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flushOnLeave)
    const tickTimer = setInterval(tick, 1000)
    const flushTimer = setInterval(flush, FLUSH_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive, { capture: true }))
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flushOnLeave)
      clearInterval(tickTimer)
      clearInterval(flushTimer)
      flush()
    }
  }, [materialId])

  return visitSeconds
}
