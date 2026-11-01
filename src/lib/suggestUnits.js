// PDF 교재를 살펴보고 단원 나누기를 제안한다. 결과는 사용자가 화면에서 고친 뒤 확정한다.
// 순서: ① 의미 있는 북마크(개요)  ② 큰 글씨의 구분 장(章) 쪽  ③ 쪽마다 한 단원
// 모든 분석은 브라우저 안에서 pdf.js 로만 하며 파일을 밖으로 보내지 않는다.

const GENERIC_OUTLINE = /^(슬라이드|slide|page|페이지|쪽)\s*\d+$/i
const MAX_PAGE_UNITS = 40

// pdf.js 텍스트 조각들을 한 줄 문자열로 잇는다. 조각 사이가 벌어져 있을 때만 띄어 쓴다.
function joinItems(items) {
  let out = ''
  let prevEnd = null
  for (const it of items) {
    const gap = prevEnd === null ? 0 : it.x - prevEnd
    if (out && gap > it.h * 0.15) out += ' '
    out += it.s
    prevEnd = it.x + it.w
  }
  return out.replace(/\s+/g, ' ').trim()
}

function linesOfSize(page, size) {
  const items = page.items.filter((it) => Math.abs(it.h - size) <= 1)
  // 위에서 아래(y 큰 값 → 작은 값), 같은 줄은 왼쪽부터
  items.sort((a, b) => (Math.abs(b.y - a.y) > size * 0.5 ? b.y - a.y : a.x - b.x))
  return joinItems(items)
}

function pageHeading(page) {
  const sizes = [...new Set(page.items.map((it) => it.h))].sort((a, b) => b - a)
  if (!sizes.length) return { size: 0, text: '' }
  let text = linesOfSize(page, sizes[0])
  // 구분 장이 "1" 처럼 숫자만 크게 있으면 그 다음 크기 글씨(부제목)를 제목으로 쓴다.
  // 교재 자체의 장 번호는 빼서 "2단원 · 1. …" 처럼 번호가 겹쳐 보이지 않게 한다.
  if (/^[\d①-⑳IVX.\s]{1,4}$/.test(text) && sizes[1]) {
    text = linesOfSize(page, sizes[1]) || text
  }
  return { size: sizes[0], text }
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

const clip = (t, n = 60) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

function rangesFromStarts(starts, numPages, titles) {
  return starts.map((start, i) => ({
    title: clip(titles[i] || `${i + 1}단원`),
    page_start: start,
    page_end: i + 1 < starts.length ? starts[i + 1] - 1 : numPages,
  }))
}

// pages: [{ items: [{ s, x, y, w, h }] }], outline: [{ title, page }] (쪽 번호는 1부터)
export function suggestFromPages(pages, outline = []) {
  const numPages = pages.length
  if (!numPages) return { method: 'none', units: [] }

  // ① 의미 있는 북마크가 2개 이상이면 그대로 쓴다
  const meaningful = outline.filter((o) => o.page && o.title && !GENERIC_OUTLINE.test(o.title.trim()))
  if (meaningful.length >= 2) {
    const sorted = [...meaningful].sort((a, b) => a.page - b.page).filter((o, i, a) => i === 0 || o.page !== a[i - 1].page)
    const starts = sorted.map((o) => o.page)
    const titles = sorted.map((o) => o.title.trim())
    if (starts[0] !== 1) {
      starts.unshift(1)
      titles.unshift('들어가며')
    }
    return { method: 'outline', units: rangesFromStarts(starts, numPages, titles) }
  }

  // ② 다른 쪽보다 훨씬 큰 글씨가 있는 쪽 = 표지·구분 장
  const heads = pages.map(pageHeading)
  const typical = median(heads.map((h) => h.size).filter(Boolean))
  const dividers = heads
    .map((h, i) => ({ ...h, page: i + 1 }))
    .filter((h) => h.text && typical && h.size >= typical * 1.3)
  if (dividers.length >= 2) {
    const starts = dividers.map((d) => d.page)
    const titles = dividers.map((d) => d.text)
    if (starts[0] !== 1) {
      starts.unshift(1)
      titles.unshift(heads[0].text || '들어가며')
    }
    return { method: 'sections', units: rangesFromStarts(starts, numPages, titles) }
  }

  // ③ 쪽마다 한 단원 (쪽이 너무 많으면 나눠 묶는다)
  const per = Math.ceil(numPages / MAX_PAGE_UNITS)
  const starts = []
  for (let p = 1; p <= numPages; p += per) starts.push(p)
  const titles = starts.map((p) => heads[p - 1].text || `${p}쪽`)
  return { method: 'pages', units: rangesFromStarts(starts, numPages, titles) }
}

// pdf.js 문서에서 쪽별 글씨 조각과 북마크를 꺼낸다
export async function extractPdf(doc) {
  const pages = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const { items } = await page.getTextContent()
    pages.push({
      items: items
        .filter((it) => it.str && it.str.trim())
        .map((it) => ({
          s: it.str,
          x: it.transform[4],
          y: it.transform[5],
          w: it.width,
          h: Math.round(Math.abs(it.transform[3]) || it.height),
        })),
    })
    page.cleanup()
  }

  const outline = []
  const raw = (await doc.getOutline().catch(() => null)) || []
  for (const o of raw) {
    try {
      const dest = typeof o.dest === 'string' ? await doc.getDestination(o.dest) : o.dest
      if (!dest) continue
      outline.push({ title: o.title, page: (await doc.getPageIndex(dest[0])) + 1 })
    } catch {
      /* 쪽을 찾을 수 없는 북마크는 건너뛴다 */
    }
  }
  return { pages, outline }
}

// 브라우저에서 File/ArrayBuffer 를 받아 제안을 만든다
export async function suggestUnitsForPdf(data) {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  try {
    const { pages, outline } = await extractPdf(doc)
    return { numPages: doc.numPages, ...suggestFromPages(pages, outline) }
  } finally {
    doc.destroy()
  }
}

// 사진 교재·분석 실패 시 : n 개 단원, 쪽 정보 없음
export function plainUnits(n) {
  return Array.from({ length: n }, (_, i) => ({ title: `${i + 1}단원`, page_start: null, page_end: null }))
}
