// 진행률(%) = 완료한 단원 수 / 전체 단원 수 × 100, 화면에는 반올림해서 표시 (PRD 3-1, 8-2)
export function percentOf(done, total) {
  return total > 0 ? Math.round((done / total) * 100) : 0
}

// 교재 하나의 진행 상태 배지 문구와 색 (흰 배경 기준 7:1 이상)
export function statusOf(done, total) {
  if (total > 0 && done >= total) return { text: '다 했어요', className: 'bg-done-text text-white' }
  if (done > 0) return { text: '공부 중', className: 'bg-brand text-white' }
  return { text: '시작 전', className: 'border-2 border-gray-800 bg-white text-ink' }
}

function remainingText(done, total) {
  if (total === 0) return ''
  const left = total - done
  return left > 0 ? `앞으로 ${left}단원 남았습니다. 힘내세요!` : '모든 단원을 마쳤습니다. 정말 잘하셨어요!'
}

export default function ProgressBar({ done, total, size = 'lg', label, showRemaining = false }) {
  const pct = percentOf(done, total)
  const height = size === 'lg' ? 'h-9' : 'h-6'
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <span className={size === 'lg' ? 'text-2xl font-bold' : 'text-xl font-bold'}>
          {total}단원 중 {done}단원 완료
        </span>
        <span className={size === 'lg' ? 'text-5xl font-black text-brand' : 'text-3xl font-black text-brand'}>
          {pct}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={`mt-2 w-full overflow-hidden rounded-full border-4 border-gray-800 bg-gray-100 ${height}`}
      >
        <div
          className="h-full bg-done-border transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showRemaining && total > 0 && <p className="mt-2 text-xl font-bold">{remainingText(done, total)}</p>}
    </div>
  )
}
