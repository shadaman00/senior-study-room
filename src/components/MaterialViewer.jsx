import { useEffect, useRef, useState } from 'react'

const MIN_ZOOM = 100
const MAX_ZOOM = 300
const STEP = 25

// 앱 안에서 교재를 바로 보는 뷰어. +/− 큰 버튼으로 100% ~ 300% 확대 (PRD 3-1 ④)
export default function MaterialViewer({ url, fileType, title }) {
  const [zoom, setZoom] = useState(MIN_ZOOM)

  return (
    <section className="card p-3" aria-label="교재 보기">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn-outline w-24 text-4xl"
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
          className="btn-outline w-24 text-4xl"
          aria-label="크게 보기"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + STEP))}
          disabled={zoom >= MAX_ZOOM}
        >
          ＋
        </button>
      </div>

      <div className="mt-3 h-[60vh] overflow-auto rounded-2xl border-2 border-gray-400 bg-gray-100">
        {!url ? (
          <p className="p-6 text-xl">교재를 여는 중입니다…</p>
        ) : fileType === 'pdf' ? (
          <PdfPages url={url} zoom={zoom} />
        ) : (
          <img src={url} alt={title} style={{ width: `${zoom}%`, maxWidth: 'none' }} className="block" />
        )}
      </div>
    </section>
  )
}

function PdfPages({ url, zoom }) {
  const containerRef = useRef(null)
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
        if (!cancelled) setDoc(pdf)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      loadingTask?.destroy()
    }
  }, [url])

  useEffect(() => {
    const container = containerRef.current
    if (!doc || !container) return
    let cancelled = false
    const tasks = []

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

  if (failed) return <p className="p-6 text-xl font-bold text-danger">교재를 열지 못했습니다. 다시 들어와 주세요.</p>
  if (!doc) return <p className="p-6 text-xl">교재를 여는 중입니다…</p>
  return <div ref={containerRef} className="p-1" />
}
