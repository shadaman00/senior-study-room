import { Link } from 'react-router-dom'
import { formatDay, formatDuration, unitLabel } from '../lib/format.js'
import Icon from './Icon.jsx'

// 교재 하나의 단원별 진도판 : 단원 번호 칸(완료 = 초록), 다음 공부할 단원, 마지막 공부한 날
export default function UnitBoard({ material, studySeconds = 0 }) {
  const units = material.progress_items ?? []
  const next = units.find((u) => !u.is_completed)
  const last = units
    .filter((u) => u.completed_at)
    .reduce((a, u) => (!a || u.completed_at > a ? u.completed_at : a), null)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xl font-bold">단원별 진도</p>
        <ul className="mt-2 flex flex-wrap gap-2" aria-label={`${material.title} 단원별 진도`}>
          {units.map((u) => {
            const isNext = next && u.unit_number === next.unit_number
            return (
              <li key={u.unit_number}>
                <Link
                  to={`/study/${material.id}?unit=${u.unit_number}`}
                  aria-label={`${u.unit_number}단원 ${unitLabel(u)} ${u.is_completed ? '완료' : isNext ? '다음에 공부할 단원' : '아직 안 함'}`}
                  className={`flex h-14 min-w-[3.5rem] flex-col items-center justify-center rounded-xl border-4 px-2 text-xl font-black leading-none ${
                    u.is_completed
                      ? 'border-done-border bg-done-border text-white'
                      : isNext
                        ? 'border-brand bg-blue-50 text-brand ring-4 ring-amber-400'
                        : 'border-gray-800 bg-white text-ink'
                  }`}
                >
                  {u.is_completed && <Icon name="check" className="h-4 w-4" />}
                  {u.unit_number}
                </Link>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 flex flex-wrap gap-x-4 text-lg">
          <span>
            <span className="mr-1 inline-block h-4 w-4 rounded bg-done-border align-middle" /> 마친 단원
          </span>
          <span>
            <span className="mr-1 inline-block h-4 w-4 rounded border-2 border-brand bg-blue-50 align-middle ring-2 ring-amber-400" />{' '}
            다음 단원
          </span>
        </p>
      </div>

      {next ? (
        <div className="rounded-2xl border-4 border-brand bg-blue-50 p-4">
          <p className="text-lg font-bold">다음에 공부할 단원</p>
          <p className="text-2xl font-black text-brand">
            {next.unit_number}단원{unitLabel(next) && ` · ${unitLabel(next)}`}
          </p>
          {next.page_start && (
            <p className="text-lg">
              {next.page_start === next.page_end ? `${next.page_start}쪽` : `${next.page_start}~${next.page_end}쪽`}
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-2xl border-4 border-done-border bg-done-bg p-4 text-2xl font-black text-done-text">
          모든 단원을 마쳤어요! 🎉
        </p>
      )}

      <p className="text-lg">
        {last ? `마지막으로 마친 날: ${formatDay(last)}` : '아직 마친 단원이 없어요.'}
        <br />이 교재를 공부한 시간: <strong>{studySeconds >= 60 ? formatDuration(studySeconds) : '아직 없어요'}</strong>
      </p>

      <Link to={`/study/${material.id}${next ? `?unit=${next.unit_number}` : ''}`} className="btn-primary w-full">
        {next ? `${next.unit_number}단원 공부하러 가기` : '다시 보러 가기'}
        <Icon name="arrowRight" />
      </Link>
    </div>
  )
}
