import Icon from './Icon.jsx'
import { plainUnits } from '../lib/suggestUnits.js'

const pageLabel = (u) =>
  u.page_start == null ? '' : u.page_start === u.page_end ? `${u.page_start}쪽` : `${u.page_start}~${u.page_end}쪽`

// 교재 분석으로 제안된 단원 목록을 사용자가 확인하고 고치는 편집기.
// 쪽 정보가 있으면 합치기·나누기·시작 쪽 옮기기, 없으면(사진 교재) 단원 수만 정한다.
export default function UnitEditor({ units, onChange, disabled }) {
  const hasPages = units.length > 0 && units[0].page_start != null

  const update = (i, patch) => onChange(units.map((u, k) => (k === i ? { ...u, ...patch } : u)))

  function mergeUp(i) {
    const next = [...units]
    next[i - 1] = { ...next[i - 1], page_end: next[i].page_end }
    next.splice(i, 1)
    onChange(next)
  }

  function split(i) {
    const u = units[i]
    const mid = Math.floor((u.page_start + u.page_end) / 2)
    const next = [...units]
    next.splice(i, 1, { ...u, page_end: mid }, { title: `${u.title} (뒷부분)`, page_start: mid + 1, page_end: u.page_end })
    onChange(next)
  }

  // 단원 i 의 시작 쪽을 한 쪽 옮긴다 (앞 단원의 끝 쪽도 함께 바뀜)
  function moveStart(i, delta) {
    const prev = units[i - 1]
    const cur = units[i]
    const start = cur.page_start + delta
    if (start <= prev.page_start || start > cur.page_end) return
    const next = [...units]
    next[i - 1] = { ...prev, page_end: start - 1 }
    next[i] = { ...cur, page_start: start }
    onChange(next)
  }

  if (!hasPages) {
    const n = units.length
    const setCount = (c) => {
      const base = plainUnits(c)
      onChange(base.map((b, k) => units[k] ?? b))
    }
    return (
      <div className="flex items-center gap-3" role="group" aria-label="단원 수">
        <button
          type="button"
          className="btn-outline w-20 text-4xl"
          aria-label="단원 하나 줄이기"
          onClick={() => setCount(Math.max(1, n - 1))}
          disabled={disabled || n <= 1}
        >
          −
        </button>
        <output className="flex-1 text-center text-5xl font-black" aria-live="polite">
          {n}단원
        </output>
        <button
          type="button"
          className="btn-outline w-20 text-4xl"
          aria-label="단원 하나 늘리기"
          onClick={() => setCount(Math.min(200, n + 1))}
          disabled={disabled || n >= 200}
        >
          ＋
        </button>
      </div>
    )
  }

  return (
    <ol className="flex flex-col gap-4">
      {units.map((u, i) => (
        <li key={`${u.page_start}-${i}`} className="rounded-2xl border-4 border-gray-800 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-black text-brand">{i + 1}단원</span>
            <span className="text-xl font-bold">{pageLabel(u)}</span>
          </div>
          <label className="mt-2 block">
            <span className="sr-only">{i + 1}단원 제목</span>
            <input
              className="field text-xl tracking-normal"
              value={u.title}
              maxLength={100}
              onChange={(e) => update(i, { title: e.target.value })}
              disabled={disabled}
            />
          </label>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {i > 0 && (
              <button type="button" className="btn-outline px-2 text-lg" onClick={() => mergeUp(i)} disabled={disabled}>
                <Icon name="merge" />위 단원과 합치기
              </button>
            )}
            {u.page_end > u.page_start && (
              <button type="button" className="btn-outline px-2 text-lg" onClick={() => split(i)} disabled={disabled}>
                <Icon name="split" />둘로 나누기
              </button>
            )}
          </div>

          {i > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="flex-1 text-lg font-bold">시작 쪽 옮기기</span>
              <button
                type="button"
                className="btn-outline px-3 text-lg"
                onClick={() => moveStart(i, -1)}
                disabled={disabled || u.page_start - 1 <= units[i - 1].page_start}
              >
                <Icon name="arrowLeft" />앞으로
              </button>
              <button
                type="button"
                className="btn-outline px-3 text-lg"
                onClick={() => moveStart(i, 1)}
                disabled={disabled || u.page_start + 1 > u.page_end}
              >
                뒤로<Icon name="arrowRight" />
              </button>
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}
