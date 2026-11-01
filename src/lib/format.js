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

// 단원 제목. 예전 방식으로 만든 "3단원" 같은 이름은 번호와 겹치므로 따로 보여 주지 않는다.
export function unitLabel(item) {
  return /^\d+단원$/.test(item.unit_title.trim()) ? '' : item.unit_title
}
