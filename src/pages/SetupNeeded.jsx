export default function SetupNeeded() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-4xl font-black">준비가 덜 되었습니다</h1>
      <p className="mt-4 text-xl">
        아직 서버 연결 정보가 없습니다. 강사님이나 관리자에게 알려 주세요.
      </p>
      <p className="mt-6 rounded-2xl bg-gray-100 p-4 text-lg">
        관리자용 안내: <code>.env</code> 파일(또는 GitHub Secrets)에 <code>VITE_SUPABASE_URL</code>과{' '}
        <code>VITE_SUPABASE_ANON_KEY</code>를 넣고 다시 빌드하세요.
      </p>
    </main>
  )
}
