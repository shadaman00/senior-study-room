import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { pinToEmail, pinToPassword } from '../lib/pin.js'

const AuthContext = createContext(null)

const MIN_SCALE = 0.9
const MAX_SCALE = 1.6
const SCALE_STEP = 0.1

function applyFontScale(scale) {
  document.documentElement.style.setProperty('--font-scale', String(scale))
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // 로그인하면 프로필(이름, 글자 배율)을 불러와 어느 기기에서든 같은 글자 크기로 보이게 한다
  useEffect(() => {
    if (!session) {
      setProfile(null)
      applyFontScale(1)
      return
    }
    supabase
      .from('profiles')
      .select('display_name, font_scale')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setProfile(data)
        applyFontScale(data.font_scale)
      })
  }, [session])

  const signInWithPin = useCallback(async (studentNo, pin) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: pinToEmail(studentNo),
      password: pinToPassword(pin),
    })
    return error
  }, [])

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const changeFontScale = useCallback(
    async (direction) => {
      if (!session) return
      const current = profile?.font_scale ?? 1
      const next = Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, current + direction * SCALE_STEP)) * 10) / 10
      if (next === current) return
      setProfile((p) => ({ ...p, font_scale: next }))
      applyFontScale(next)
      await supabase.from('profiles').update({ font_scale: next }).eq('id', session.user.id)
    },
    [session, profile],
  )

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signInWithPin,
    signOut,
    changeFontScale,
    canGrow: (profile?.font_scale ?? 1) < MAX_SCALE,
    canShrink: (profile?.font_scale ?? 1) > MIN_SCALE,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
