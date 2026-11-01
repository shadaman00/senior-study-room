import { dayKey, startOfWeek } from './format.js'

// 공부 시간 기록(study_sessions)과 완료 기록(progress_items)을 합쳐
// "하루 × 교재 × 단원" 마다 한 줄인 최근 공부 기록을 만든다.
export function buildStudyLog(materials, sessions, limit = 7) {
  const byId = new Map(materials.map((m) => [m.id, m]))
  const rows = new Map()
  const rowFor = (materialId, unitNumber, iso) => {
    const key = `${dayKey(iso)}|${materialId}|${unitNumber ?? '-'}`
    if (!rows.has(key)) {
      const m = byId.get(materialId)
      rows.set(key, {
        key,
        material: m,
        unit: m?.progress_items.find((u) => u.unit_number === unitNumber) ?? null,
        unitNumber,
        seconds: 0,
        firstStart: null,
        lastAt: iso,
        completedAt: null,
      })
    }
    return rows.get(key)
  }

  for (const s of sessions) {
    if (!byId.has(s.material_id)) continue
    const r = rowFor(s.material_id, s.unit_number, s.started_at)
    r.seconds += s.seconds
    if (!r.firstStart || s.started_at < r.firstStart) r.firstStart = s.started_at
    if (s.ended_at > r.lastAt) r.lastAt = s.ended_at
  }
  for (const m of materials) {
    for (const u of m.progress_items) {
      if (!u.completed_at) continue
      const r = rowFor(m.id, u.unit_number, u.completed_at)
      r.completedAt = u.completed_at
      if (u.completed_at > r.lastAt) r.lastAt = u.completed_at
    }
  }
  return [...rows.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)).slice(0, limit)
}

// 오늘·이번 주 공부 시간(초)과 교재별 합계
export function summarize(sessions, now = new Date()) {
  const today = dayKey(now.toISOString())
  const weekStart = startOfWeek(now).getTime()
  let todaySec = 0
  let weekSec = 0
  const perMaterial = {}
  for (const s of sessions) {
    if (dayKey(s.started_at) === today) todaySec += s.seconds
    if (new Date(s.started_at).getTime() >= weekStart) weekSec += s.seconds
    perMaterial[s.material_id] = (perMaterial[s.material_id] ?? 0) + s.seconds
  }
  return { todaySec, weekSec, perMaterial }
}
