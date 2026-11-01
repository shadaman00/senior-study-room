import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

const MIN_ZOOM = 100
const MAX_ZOOM = 300
const STEP = 25

function ZoomControls({ zoom, setZoom }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        className="btn-outline w-20 text-4xl"
        aria-label="작게 보기"
        onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - STEP))}
        disabled={zoom <= MIN_ZOOM}
      >
        −
      </button>
      <span className="text-2xl font-black" aria-live="polite">
        {zoom}%
      </span>
      <button
        type="button"
        className="btn-outline w-20 text-4xl"
        aria-label="크게 보기"
        onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + STEP))}
        disabled={zoom >= MAX_ZOOM}
      >
        ＋
      </button>
    </div>
  )
}

// 앱 안에서 교재를 바로 보는 뷰어. +/− 큰 버튼으로 100% ~ 300% 확대 (PRD 3-1 ④)
// openAt 이 바뀌면({ page, nonce }) 그 쪽을 전체 화면으로 연다 (단원 카드의 [크게 보기])
export default function MaterialViewer({ url, fileType, title, openAt }) {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [full, setFull] = useState(null) // null | { page }
  const closeFull = useCallback(() => setFull(null), [])

  useEffect(() => {
    if (openAt) setFull({ page: openAt.page })
  }, [openAt])

  return (
    <section className="card p-3" aria-label="교재 보기">
      <ZoomControls zoom={zoom} setZoom={setZoom} />

      <div className="relative mt-3 h-[60vh] overflow-auto rounded-2xl border-2 border-gray-400 bg-gray-100">
        {!url ? (
          <p className="p-6 text-xl">교재를 여는 중입니다…</p>
        ) : fileType === 'pdf' ? (
          <PdfPages url={url} zoom={zoom} />
        ) : (
          <img src={url} alt={title} style={{ width: `${zoom}%`, maxWidth: 'none' }} className="block" />
        )}
      </div>

      <button
        type="button"
        className="btn-primary mt-3 w-full"
        onClick={() => setFull({ page: 1 })}
        disabled={!url}
      >
        <Icon name="expand" />
        전체 화면으로 보기
      </button>

      {full && url && (
        <FullScreenViewer url={url} fileType={fileType} title={title} startPage={full.page} onClose={closeFull} />
      )}
    </section>
  )
}

function FullScreenViewer({ url, fileType, title, startPage, onClose }) {
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [page, setPage] = useState(startPage)
  const [numPages, setNumPages] = useState(0)
  const [goTo, setGoTo] = useState({ page: startPage, nonce: 0 })
  const closeRef = useRef(null)

  // 화면 전체를 쓰고(지원하는 기기), 뒤 화면이 스크롤되지 않게 막는다
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.requestFullscreen?.().catch(() => {})
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [onClose])

  const jump = (p) => setGoTo({ page: Math.min(Math.max(1, p), numPages || 1), nonce: Date.now() })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} 전체 화면`}
      className="fixed inset-0 z-50 flex flex-col bg-white"
    >
      <div className="flex items-center gap-2 border-b-4 border-gray-800 p-2">
        <button ref={closeRef} type="button" className="btn-primary shrink-0 px-4 text-xl" onClick={onClose}>
          <Icon name="close" />
          닫기
        </button>
        <div className="flex-1">
          <ZoomControls zoom={zoom} setZoom={setZoom} />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto bg-gray-100">
        {fileType === 'pdf' ? (
          <PdfPages url={url} zoom={zoom} goTo={goTo} onPageChange={setPage} onNumPages={setNumPages} />
        ) : (
          <img src={url} alt={title} style={{ width: `${zoom}%`, maxWidth: 'none' }} className="block" />
        )}
      </div>

      {fileType === 'pdf' && (
        <div className="flex items-center gap-2 border-t-4 border-gray-800 p-2">
          <button type="button" className="btn-outline flex-1 px-2 text-xl" onClick={() => jump(page - 1)} disabled={page <= 1}>
            <Icon name="arrowLeft" />
            이전 쪽
          </button>
          <span className="shrink-0 px-2 text-2xl font-black" aria-live="polite">
            {page} / {numPages || '…'}쪽
          </span>
          <button
            type="button"
            className="btn-outline flex-1 px-2 text-xl"
            onClick={() => jump(page + 1)}
            disabled={!numPages || page >= numPages}
          >
            다음 쪽
            <Icon name="arrowRight" />
          </button>
        </div>
      )}
    </div>
  )
}

// PDF 쪽들을 세로로 이어서 그린다. 스크롤하는 바깥 상자는 position:relative 여야 한다.
function PdfPages({ url, zoom, goTo, onPageChange, onNumPages }) {
  const containerRef = useRef(null)
  const currentPage = useRef(goTo?.page ?? 1)
  const [doc, setDoc] = useState(null)
  const [failed, setFailed] = useState(false)

  // pdf.js 는 용량이 커서 PDF 를 열 때만 불러온다
  useEffect(() => {
    let cancelled = false
    let loadingTask
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        loadingTask = pdfjs.getDocument(url)
        const pdf = await loadingTask.promise
        if (!cancelled) {
          setDoc(pdf)
          onNumPages?.(pdf.numPages)
        }
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      loadingTask?.destroy()
    }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  // n 쪽 위끝으로 스크롤한다. 아래 쪽들이 아직 안 그려져 끝까지 못 가면 false
  const scrollToPage = (n) => {
    const canvas = containerRef.current?.children[n - 1]
    const box = containerRef.current?.parentElement
    if (!canvas || !box) return false
    const want = canvas.offsetTop - 4
    box.scrollTop = want
    return Math.abs(box.scrollTop - want) < 2
  }

  // 확대율이 바뀌면 다시 그리고, 보던 쪽(또는 처음 열 쪽)으로 돌아간다
  useEffect(() => {
    const container = containerRef.current
    if (!doc || !container) return
    let cancelled = false
    const tasks = []
    const target = currentPage.current
    let reached = false

    ;(async () => {
      container.replaceChildren()
      const fitWidth = container.parentElement.clientWidth - 8
      const dpr = window.devicePixelRatio || 1
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const page = await doc.getPage(n)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: (fitWidth / base.width) * (zoom / 100) })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        canvas.className = 'mb-2 block bg-white shadow'
        canvas.setAttribute('aria-label', `${n}쪽`)
        container.appendChild(canvas)
        // 목표 쪽까지 스크롤할 수 있을 만큼 아래 쪽이 그려질 때까지 다시 맞춘다
        if (n >= target && !reached) reached = scrollToPage(target)
        const task = page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        })
        tasks.push(task)
        await task.promise.catch(() => {})
      }
    })()

    return () => {
      cancelled = true
      tasks.forEach((t) => t.cancel())
    }
  }, [doc, zoom])

  // [이전 쪽]/[다음 쪽] 으로 옮기기
  useEffect(() => {
    if (!goTo || !doc) return
    currentPage.current = goTo.page
    onPageChange?.(goTo.page)
    scrollToPage(goTo.page)
  }, [goTo, doc]) // eslint-disable-line react-hooks/exhaustive-deps

  // 스크롤 위치로 지금 보는 쪽(화면 맨 위에 걸친 쪽)을 알아낸다
  useEffect(() => {
    const box = containerRef.current?.parentElement
    if (!box || !doc) return
    const onScroll = () => {
      const probe = box.scrollTop + 12
      let n = 1
      for (const [i, c] of [...containerRef.current.children].entries()) {
        if (c.offsetTop <= probe) n = i + 1
        else break
      }
      // 맨 아래에서는 마지막 몇 쪽이 위끝까지 못 올라오므로, 옮겨 간 쪽 번호를 그대로 둔다
      const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 2
      if (atBottom && currentPage.current > n) return
      if (n !== currentPage.current) {
        currentPage.current = n
        onPageChange?.(n)
      }
    }
    box.addEventListener('scroll', onScroll, { passive: true })
    return () => box.removeEventListener('scroll', onScroll)
  }, [doc, onPageChange])

  if (failed) return <p className="p-6 text-xl font-bold text-danger">교재를 열지 못했습니다. 다시 들어와 주세요.</p>
  if (!doc) return <p className="p-6 text-xl">교재를 여는 중입니다…</p>
  return <div ref={containerRef} className="p-1" />
}
