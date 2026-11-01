import { useEffect, useRef, useState } from 'react'
import { BUCKET, MAX_FILE_BYTES, supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from './Icon.jsx'
import UnitEditor from './UnitEditor.jsx'
import { plainUnits, suggestUnitsForPdf } from '../lib/suggestUnits.js'

const ANALYSIS_NOTE = {
  outline: (n) => `교재의 목차를 따라 ${n}개 단원으로 나눠 보았습니다.`,
  sections: (n) => `교재의 큰 제목 쪽을 찾아 ${n}개 단원으로 나눠 보았습니다.`,
  pages: (n) => `큰 제목을 찾지 못해 쪽마다 한 단원(${n}개)으로 나눴습니다. [위 단원과 합치기]로 묶어 주세요.`,
}

const TYPES = {
  'application/pdf': { ext: 'pdf', kind: 'pdf' },
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
}

const formatSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`

const titleFromFileName =(name) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 100)

// 교재 올리기 : [새 교재 올리기] → [파일 고르기] → [등록하기] 3번 터치 (US-01)
export default function UploadModal({ onClose, onDone }) {
  const { user } = useAuth()
  const fileInput = useRef(null)
  const dialogRef = useRef(null)
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [units, setUnits] = useState(plainUnits(5))
  const [suggested, setSuggested] = useState(null)
  const [analysis, setAnalysis] = useState({ status: 'idle', note: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const pickSeq = useRef(0)

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  function pickFile(f) {
    setMessage('')
    if (!f) return
    if (!TYPES[f.type]) {
      setFile(null)
      return setMessage('PDF 문서나 사진(JPG, PNG)만 올릴 수 있습니다.')
    }
    if (f.size > MAX_FILE_BYTES) {
      setFile(null)
      return setMessage('파일이 너무 큽니다. 강사님께 문의해 주세요.')
    }
    setFile(f)
    setTitle(titleFromFileName(f.name) || '새 교재')
    analyze(f)
  }

  // PDF 면 내용을 살펴 단원 나누기를 제안한다. 사진이거나 실패하면 단원 수만 정한다.
  async function analyze(f) {
    const seq = ++pickSeq.current
    setSuggested(null)
    if (TYPES[f.type].kind !== 'pdf') {
      setUnits(plainUnits(5))
      return setAnalysis({ status: 'plain', note: '사진 교재는 단원 수만 정합니다.' })
    }
    setAnalysis({ status: 'analyzing', note: '' })
    try {
      const res = await suggestUnitsForPdf(await f.arrayBuffer())
      if (seq !== pickSeq.current) return
      if (!res.units.length) throw new Error('empty')
      setUnits(res.units)
      setSuggested(res.units)
      setAnalysis({ status: 'done', note: `${ANALYSIS_NOTE[res.method](res.units.length)} (전체 ${res.numPages}쪽)` })
    } catch {
      if (seq !== pickSeq.current) return
      setUnits(plainUnits(5))
      setAnalysis({ status: 'plain', note: '교재 내용을 읽지 못해 단원 수만 정합니다.' })
    }
  }

  async function submit() {
    if (!file) return setMessage('먼저 [파일 고르기]를 눌러 교재를 골라 주세요.')
    if (!title.trim()) return setMessage('교재 이름을 넣어 주세요.')
    if (analysis.status === 'analyzing') return setMessage('교재를 살펴보는 중입니다. 잠시만 기다려 주세요.')
    if (units.some((u) => !u.title.trim())) return setMessage('이름이 비어 있는 단원이 있습니다.')
    setBusy(true)
    setMessage('')

    const { ext, kind } = TYPES[file.type]
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (upErr) {
      setBusy(false)
      return setMessage('파일을 올리지 못했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요.')
    }

    const { error: dbErr } = await supabase.rpc('create_material_with_units', {
      p_title: title.trim(),
      p_file_path: path,
      p_file_type: kind,
      p_units: units.map((u) => ({ title: u.title.trim(), page_start: u.page_start, page_end: u.page_end })),
    })
    if (dbErr) {
      await supabase.storage.from(BUCKET).remove([path])
      setBusy(false)
      return setMessage('교재를 등록하지 못했습니다. 다시 눌러 주세요.')
    }
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="upload-title" className="text-4xl font-black">
            새 교재 올리기
          </h2>
          <button
            type="button"
            className="btn-outline shrink-0 flex-col gap-0 px-3 text-lg"
            onClick={onClose}
            disabled={busy}
          >
            <Icon name="close" className="h-7 w-7" />
            닫기
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <div>
            <p className="text-2xl font-bold">① 교재 파일</p>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <button
              type="button"
              className={`mt-2 w-full ${file ? 'btn-outline' : 'btn-primary'}`}
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              <Icon name="folder" />
              {file ? '다른 파일 고르기' : '파일 고르기'}
            </button>
            {file && (
              <div className="mt-3 rounded-2xl border-4 border-done-border bg-done-bg p-4 text-done-text">
                <p className="break-all text-xl font-bold">✔ 고른 파일: {file.name}</p>
                <p className="text-lg">파일 크기: {formatSize(file.size)} (올릴 수 있는 크기입니다)</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="material-title" className="text-2xl font-bold">
              ② 교재 이름
            </label>
            <input
              id="material-title"
              className="field text-2xl tracking-normal"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 스마트폰 기초 1주차"
              disabled={busy}
              aria-describedby="material-title-help"
            />
            <p id="material-title-help" className="text-lg">
              내 공부방에 이 이름으로 크게 보입니다.
            </p>
          </div>

          <section aria-labelledby="units-label">
            <h3 className="text-2xl font-bold" id="units-label">
              ③ 단원 확인하기
            </h3>
            {analysis.status === 'analyzing' && (
              <p className="mt-2 rounded-2xl bg-blue-50 p-4 text-xl font-bold" role="status">
                교재 내용을 살펴보고 단원을 나누는 중입니다…
              </p>
            )}
            {analysis.note && analysis.status !== 'analyzing' && (
              <p className="mt-2 rounded-2xl bg-blue-50 p-4 text-xl" role="status">
                {analysis.note}
                {analysis.status === 'done' && ' 맞는지 보고, 이름이나 나누기를 고친 뒤 등록해 주세요.'}
              </p>
            )}
            {analysis.status !== 'analyzing' && (
              <div className="mt-3">
                <UnitEditor units={units} onChange={setUnits} disabled={busy} />
                {suggested && units !== suggested && (
                  <button
                    type="button"
                    className="btn-outline mt-3 w-full text-xl"
                    onClick={() => setUnits(suggested)}
                    disabled={busy}
                  >
                    처음 제안으로 되돌리기
                  </button>
                )}
              </div>
            )}
          </section>

          <p role="alert" aria-live="assertive" className="min-h-[1.6em] text-xl font-bold text-danger">
            {message}
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="btn-primary w-full text-3xl"
              onClick={submit}
              disabled={busy || analysis.status === 'analyzing'}
            >
              {!busy && <Icon name="upload" />}
              {busy ? '올리는 중입니다…' : `${units.length}개 단원으로 등록하기`}
            </button>
            <button type="button" className="btn-outline w-full" onClick={onClose} disabled={busy}>
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
