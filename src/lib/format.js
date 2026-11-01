const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

// "11월 1일(토)" — 시니어가 읽기 쉬운 날짜. 오늘·어제는 그렇게 부른다.
export function formatDay(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(today) - startOf(d)) / 86400000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEKDAY[d.getDay()]})`
}

// "오후 3:05"
export function formatClock(iso) {
  const d = new Date(iso)
  const h = d.getHours()
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 공부한 시간 : "1분 미만", "25분", "1시간 40분"
export function formatDuration(seconds) {
  const min = Math.floor((seconds || 0) / 60)
  if (min < 1) return '1분 미만'
  if (min < 60) return `${min}분`
  return min % 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${Math.floor(min / 60)}시간`
}

// 같은 날(이 기기 시간 기준)인지 비교할 열쇠 "2026-11-1"
export const dayKey = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// 이번 주 월요일 0시
export function startOfWeek(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

// 단원 제목. 예전 방식으로 만든 "3단원" 같은 이름은 번호와 겹치므로 따로 보여 주지 않는다.
export function unitLabel(item) {
  return /^\d+단원$/.test(item.unit_title.trim()) ? '' : item.unit_title
}
