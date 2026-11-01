import { useAuth } from '../context/AuthContext.jsx'
import Icon from './Icon.jsx'

// 모든 화면 상단에 늘 보이는 글자 크기 버튼과 나가기 버튼 (숨김 메뉴 없음)
export default function TopBar({ left }) {
  const { changeFontScale, canGrow, canShrink, signOut } = useAuth()
  return (
    <div className="flex flex-col gap-3">
      <div>{left}</div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          className="btn-outline flex-col gap-0 px-2 text-lg"
          onClick={() => changeFontScale(1)}
          disabled={!canGrow}
        >
          <span className="text-2xl">가+</span>글자 크게
        </button>
        <button
          type="button"
          className="btn-outline flex-col gap-0 px-2 text-lg"
          onClick={() => changeFontScale(-1)}
          disabled={!canShrink}
        >
          <span className="text-2xl">가−</span>글자 작게
        </button>
        <button type="button" className="btn-outline flex-col gap-0 px-2 text-lg" onClick={signOut}>
          <Icon name="logout" className="h-7 w-7" />
          나가기
        </button>
      </div>
    </div>
  )
}
