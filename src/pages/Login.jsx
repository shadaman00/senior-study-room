import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icon.jsx'

const onlyDigits = (v) => v.replace(/\D/g, '')

export default function Login() {
  const { session, signInWithPin } = useAuth()
  const navigate = useNavigate()
  const [studentNo, setStudentNo] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    if (!studentNo) return setMessage('수강생 번호를 넣어 주세요.')
    if (pin.length < 4) return setMessage('비밀번호 숫자 4~6자리를 넣어 주세요.')
    setBusy(true)
    setMessage('')
    const error = await signInWithPin(studentNo, pin)
    setBusy(false)
    if (error) {
      setMessage(
        error.status === 429
          ? '잠시 후에 다시 해 주세요. (너무 여러 번 시도했습니다)'
          : '번호나 비밀번호가 맞지 않습니다. 다시 확인해 주세요.',
      )
      setPin('')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center p-5">
      <h1 className="text-center text-5xl font-black text-brand">내 공부방</h1>
      <p className="mt-3 text-center text-xl">강사님께 받은 번호로 들어오세요</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="student-no" className="text-2xl font-bold">
            수강생 번호
          </label>
          <input
            id="student-no"
            className="field"
            inputMode="numeric"
            autoComplete="username"
            maxLength={10}
            value={studentNo}
            onChange={(e) => setStudentNo(onlyDigits(e.target.value))}
            placeholder="예: 1001"
            aria-describedby="student-no-help"
          />
          <p id="student-no-help" className="text-lg">
            강사님께 받은 종이에 적힌 숫자 번호입니다.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="pin" className="text-2xl font-bold">
            비밀번호 (숫자 4~6자리)
          </label>
          <div className="flex gap-2">
            <input
              id="pin"
              className="field min-w-0 flex-1"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(onlyDigits(e.target.value))}
              placeholder="••••"
              aria-describedby="pin-help"
            />
            <button
              type="button"
              className="btn-outline shrink-0 flex-col gap-0 px-3 text-lg"
              onClick={() => setShowPin((v) => !v)}
              aria-pressed={showPin}
            >
              <Icon name={showPin ? 'eyeOff' : 'eye'} className="h-7 w-7" />
              {showPin ? '숨기기' : '보기'}
            </button>
          </div>
          <p id="pin-help" className="text-lg">
            [보기]를 누르면 누른 숫자를 확인할 수 있습니다.
          </p>
        </div>

        <p role="alert" aria-live="assertive" className="min-h-[1.6em] text-xl font-bold text-danger">
          {message}
        </p>

        <button type="submit" className="btn-primary w-full text-3xl" disabled={busy}>
          {busy ? '들어가는 중…' : '들어가기'}
          {!busy && <Icon name="login" />}
        </button>
      </form>

      <p className="mt-8 text-center text-lg">번호를 잊으셨으면 강사님께 물어보세요.</p>
    </main>
  )
}
