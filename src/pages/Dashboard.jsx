import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'
import ProgressBar, { statusOf } from '../components/ProgressBar.jsx'
import Icon from '../components/Icon.jsx'
import TopBar from '../components/TopBar.jsx'
import UploadModal from '../components/UploadModal.jsx'
import UnitBoard from '../components/UnitBoard.jsx'
import { formatClock, formatDay, formatDuration, unitLabel } from '../lib/format.js'
import { buildStudyLog, summarize } from '../lib/studyLog.js'

export default function Dashboard() {
  const { profile } = useAuth()
  const [materials, setMaterials] = useState(null)
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    const [{ data, error: err }, { data: s }] = await Promise.all([
      supabase
        .from('materials')
        .select(
          'id, title, file_type, total_units, completed_units, created_at, progress_items(unit_number, unit_title, is_completed, completed_at, page_start, page_end)',
        )
        .order('created_at', { ascending: false })
        .order('unit_number', { referencedTable: 'progress_items' }),
      supabase
        .from('study_sessions')
        .select('material_id, unit_number, started_at, ended_at, seconds')
        .order('started_at', { ascending: false })
        .limit(1000),
    ])
    if (err) setError('교재 목록을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.')
    else {
      setMaterials(data)
      setSessions(s ?? [])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalUnits = materials?.reduce((s, m) => s + m.total_units, 0) ?? 0
  const doneUnits = materials?.reduce((s, m) => s + m.completed_units, 0) ?? 0
  const recent = buildStudyLog(materials ?? [], sessions)
  const { todaySec, weekSec, perMaterial } = summarize(sessions)

  return (
    <div className="min-h-screen pb-40">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-5">
        <TopBar
          left={
            <>
              <h1 className="text-4xl font-black text-brand">내 공부방</h1>
              {profile?.display_name && (
                <p className="text-xl font-bold">{profile.display_name} 님, 안녕하세요</p>
              )}
            </>
          }
        />

        <section className="card bg-blue-50" aria-labelledby="overall-title">
          <h2 id="overall-title" className="mb-3 text-3xl font-black">
            전체 진도
          </h2>
          <ProgressBar done={doneUnits} total={totalUnits} label="전체 진도" />
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border-4 border-gray-800 bg-white p-3 text-center">
              <dt className="text-lg font-bold">오늘 공부한 시간</dt>
              <dd className="text-3xl font-black text-brand">{todaySec >= 60 ? formatDuration(todaySec) : '0분'}</dd>
            </div>
            <div className="rounded-2xl border-4 border-gray-800 bg-white p-3 text-center">
              <dt className="text-lg font-bold">이번 주 공부한 시간</dt>
              <dd className="text-3xl font-black text-brand">{weekSec >= 60 ? formatDuration(weekSec) : '0분'}</dd>
            </div>
          </dl>
        </section>

        {error && (
          <p role="alert" className="text-xl font-bold text-danger">
            {error}
          </p>
        )}

        <section aria-labelledby="list-title" className="flex flex-col gap-5">
          <h2 id="list-title" className="text-3xl font-black">
            내 교재
          </h2>

          {materials === null && !error && <p className="text-xl">불러오는 중입니다…</p>}

          {materials?.length === 0 && (
            <div className="card text-center">
              <p className="text-2xl font-bold">아직 올린 교재가 없습니다.</p>
              <p className="mt-2 text-xl">아래 파란 버튼을 눌러 첫 교재를 올려 보세요.</p>
            </div>
          )}

          {materials?.map((m) => {
            const status = statusOf(m.completed_units, m.total_units)
            return (
              <article key={m.id} className="card flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-xl bg-gray-800 px-3 py-1 text-lg font-bold text-white">
                    {m.file_type === 'pdf' ? 'PDF 문서' : '사진'}
                  </span>
                  <span className={`rounded-full px-4 py-1 text-lg font-black ${status.className}`}>
                    {status.text}
                  </span>
                </div>
                <h3 className="text-2xl font-black">{m.title}</h3>
                <ProgressBar
                  done={m.completed_units}
                  total={m.total_units}
                  size="md"
                  label={`${m.title} 진도`}
                />
                <UnitBoard material={m} studySeconds={perMaterial[m.id] ?? 0} />
              </article>
            )
          })}
        </section>

        {recent.length > 0 && (
          <section aria-labelledby="recent-title" className="card flex flex-col gap-3">
            <h2 id="recent-title" className="text-3xl font-black">
              최근 공부 기록
            </h2>
            <ul className="flex flex-col divide-y-2 divide-gray-300">
              {recent.map((r) => (
                <li key={r.key} className="py-3">
                  <p className="flex flex-wrap items-center gap-x-3 text-lg font-bold">
                    <span>
                      {formatDay(r.firstStart ?? r.completedAt)} {formatClock(r.firstStart ?? r.completedAt)}
                    </span>
                    {r.seconds >= 60 ? (
                      <span className="text-brand">⏱ {formatDuration(r.seconds)} 공부</span>
                    ) : r.seconds > 0 ? (
                      <span>⏱ 1분 미만</span>
                    ) : null}
                    {r.completedAt && <span className="text-done-text">✓ 단원 완료</span>}
                  </p>
                  <p className="text-xl font-bold">
                    {r.unitNumber ? `${r.unitNumber}단원` : '단원 정하기 전'}
                    {r.unit && unitLabel(r.unit) && ` · ${unitLabel(r.unit)}`}
                  </p>
                  <p className="text-lg">{r.material?.title}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t-4 border-gray-800 bg-white p-4">
        <div className="mx-auto max-w-2xl">
          <button type="button" className="btn-primary w-full text-3xl" onClick={() => setUploading(true)}>
            <Icon name="plus" />
            새 교재 올리기
          </button>
        </div>
      </div>

      {uploading && (
        <UploadModal
          onClose={() => setUploading(false)}
          onDone={() => {
            setUploading(false)
            load()
          }}
        />
      )}
    </div>
  )
}
