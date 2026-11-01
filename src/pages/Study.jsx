import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BUCKET, supabase } from '../lib/supabase.js'
import ProgressBar from '../components/ProgressBar.jsx'
import TopBar from '../components/TopBar.jsx'
import MaterialViewer from '../components/MaterialViewer.jsx'
import Icon from '../components/Icon.jsx'

export default function Study() {
  const { id } = useParams()
  const [material, setMaterial] = useState(null)
  const [items, setItems] = useState([])
  const [fileUrl, setFileUrl] = useState(null)
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
          .select('id, unit_number, unit_title, is_completed')
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

  // 화면을 먼저 바꾸고(낙관적 업데이트) 저장에 실패하면 되돌린다 (PRD 4. 300ms 이내)
  async function toggle(item) {
    const next = !item.is_completed
    setError('')
    setItems((list) => list.map((it) => (it.id === item.id ? { ...it, is_completed: next } : it)))
    if (next) {
      setCheer(`잘하셨어요! ${item.unit_title} 완료! 🎉`)
      clearTimeout(cheerTimer.current)
      cheerTimer.current = setTimeout(() => setCheer(''), 3000)
    }

    const { error: err } = await supabase.from('progress_items').update({ is_completed: next }).eq('id', item.id)
    if (err) {
      setItems((list) => list.map((it) => (it.id === item.id ? { ...it, is_completed: !next } : it)))
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

          <MaterialViewer url={fileUrl} fileType={material.file_type} title={material.title} />

          <section aria-labelledby="check-title" className="flex flex-col gap-4">
            <h2 id="check-title" className="text-3xl font-black">
              단원별 공부 확인
            </h2>
            <p className="text-xl">공부를 마친 단원을 누르세요. 다시 누르면 취소됩니다.</p>
            <ul className="flex flex-col gap-4">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    aria-pressed={it.is_completed}
                    onClick={() => toggle(it)}
                    className={`flex w-full items-center gap-4 rounded-3xl border-4 p-5 text-left transition-colors ${
                      it.is_completed
                        ? 'border-done-border bg-done-bg text-done-text'
                        : 'border-gray-800 bg-white text-ink hover:bg-gray-50'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-4 text-4xl font-black ${
                        it.is_completed ? 'border-done-border bg-done-border text-white' : 'border-gray-800 bg-white'
                      }`}
                    >
                      {it.is_completed ? '✓' : ''}
                    </span>
                    <span className="flex-1 text-2xl font-bold">
                      {it.unit_title} {it.is_completed ? '완료!' : '공부하기'}
                    </span>
                    {it.is_completed && (
                      <span className="shrink-0 rounded-full bg-done-text px-4 py-1 text-xl font-black text-white">
                        완료됨
                      </span>
                    )}
                  </button>
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
