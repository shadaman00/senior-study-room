import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { BUCKET, supabase } from '../lib/supabase.js'
import { formatDay, unitLabel } from '../lib/format.js'
import ProgressBar from '../components/ProgressBar.jsx'
import TopBar from '../components/TopBar.jsx'
import MaterialViewer from '../components/MaterialViewer.jsx'
import Icon from '../components/Icon.jsx'

export default function Study() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const focusUnit = Number(params.get('unit')) || null
  const [material, setMaterial] = useState(null)
  const [items, setItems] = useState([])
  const [fileUrl, setFileUrl] = useState(null)
  const [openAt, setOpenAt] = useState(null)
  const [highlight, setHighlight] = useState(null)
  const [error, setError] = useState('')
  const [cheer, setCheer] = useState('')
  const cheerTimer = useRef(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ data: m, error: mErr }, { data: rows, error: iErr }] = await Promise.all([
        supabase.from('materials').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('progress_items')
          .select('id, unit_number, unit_title, is_completed, completed_at, page_start, page_end')
          .eq('material_id', id)
          .order('unit_number'),
      ])
      if (cancelled) return
      if (mErr || iErr || !m) return setError('교재를 찾을 수 없습니다.')
      setMaterial(m)
      setItems(rows)
      // 비공개 버킷이므로 본인에게만 1시간짜리 열람 주소를 발급받는다 (PRD 6-3)
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(m.file_path, 60 * 60)
      if (!cancelled) setFileUrl(signed?.signedUrl ?? null)
    })()
    return () => {
      cancelled = true
      clearTimeout(cheerTimer.current)
    }
  }, [id])

  // 내 공부방의 단원 번호를 눌러 들어오면 그 단원으로 내려가 잠시 표시한다
  useEffect(() => {
    if (!focusUnit || !items.length) return
    document.getElementById(`unit-${focusUnit}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlight(focusUnit)
    const t = setTimeout(() => setHighlight(null), 2500)
    return () => clearTimeout(t)
  }, [focusUnit, items.length])

  // 화면을 먼저 바꾸고(낙관적 업데이트) 저장에 실패하면 되돌린다 (PRD 4. 300ms 이내)
  async function toggle(item) {
    const next = !item.is_completed
    const patch = { is_completed: next, completed_at: next ? new Date().toISOString() : null }
    setError('')
    setItems((list) => list.map((it) => (it.id === item.id ? { ...it, ...patch } : it)))
    if (next) {
      setCheer(`잘하셨어요! ${item.unit_number}단원 완료! 🎉`)
      clearTimeout(cheerTimer.current)
      cheerTimer.current = setTimeout(() => setCheer(''), 3000)
    }

    const { error: err } = await supabase.from('progress_items').update({ is_completed: next }).eq('id', item.id)
    if (err) {
      setItems((list) => list.map((it) => (it.id === item.id ? item : it)))
      setCheer('')
      setError('저장하지 못했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요.')
    }
  }

  const done = items.filter((it) => it.is_completed).length

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-5 pb-16">
      <TopBar
        left={
          <Link to="/" className="btn-outline px-4 text-xl">
            <Icon name="arrowLeft" />내 공부방
          </Link>
        }
      />

      {!material && !error && <p className="text-xl">불러오는 중입니다…</p>}

      {material && (
        <>
          <h1 className="text-4xl font-black">{material.title}</h1>

          <section className="card bg-blue-50">
            <ProgressBar done={done} total={items.length} label={`${material.title} 진도`} showRemaining />
          </section>

          <MaterialViewer url={fileUrl} fileType={material.file_type} title={material.title} openAt={openAt} />

          <section aria-labelledby="check-title" className="flex flex-col gap-4">
            <h2 id="check-title" className="text-3xl font-black">
              단원별 공부 확인
            </h2>
            <p className="text-xl">공부를 마친 단원을 누르세요. 다시 누르면 취소됩니다.</p>
            <ul className="flex flex-col gap-4">
              {items.map((it) => (
                <li
                  key={it.id}
                  id={`unit-${it.unit_number}`}
                  className={`rounded-3xl border-4 transition-colors ${
                    it.is_completed ? 'border-done-border bg-done-bg text-done-text' : 'border-gray-800 bg-white text-ink'
                  } ${highlight === it.unit_number ? 'ring-8 ring-amber-400' : ''}`}
                >
                  <button
                    type="button"
                    aria-pressed={it.is_completed}
                    onClick={() => toggle(it)}
                    className="flex w-full items-center gap-4 rounded-3xl p-5 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-4 text-4xl font-black ${
                        it.is_completed ? 'border-done-border bg-done-border text-white' : 'border-gray-800 bg-white'
                      }`}
                    >
                      {it.is_completed ? '✓' : ''}
                    </span>
                    <span className="flex-1">
                      <span className="block text-xl font-black">
                        {it.unit_number}단원 {it.is_completed ? '완료!' : '공부하기'}
                      </span>
                      {unitLabel(it) && <span className="block text-2xl font-bold">{unitLabel(it)}</span>}
                      <span className="block text-lg">
                        {it.is_completed ? `${formatDay(it.completed_at)}에 마쳤어요` : '아직 안 했어요'}
                      </span>
                    </span>
                    {it.is_completed && (
                      <span className="shrink-0 rounded-full bg-done-text px-4 py-1 text-xl font-black text-white">
                        완료됨
                      </span>
                    )}
                  </button>
                  {it.page_start && material.file_type === 'pdf' && (
                    <div className="px-5 pb-5">
                      <button
                        type="button"
                        className="btn-outline w-full text-xl"
                        onClick={() => setOpenAt({ page: it.page_start, nonce: Date.now() })}
                        disabled={!fileUrl}
                      >
                        <Icon name="book" />
                        {it.page_start === it.page_end ? `${it.page_start}쪽` : `${it.page_start}~${it.page_end}쪽`} 크게 보기
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {error && (
        <p role="alert" className="text-xl font-bold text-danger">
          {error}
        </p>
      )}

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-4 top-4 z-40 mx-auto max-w-xl rounded-3xl border-4 border-done-border bg-done-bg p-5 text-center text-3xl font-black text-done-text shadow-xl transition-opacity ${
          cheer ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {cheer}
      </div>
    </main>
  )
}
