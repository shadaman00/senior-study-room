# 내 공부방 — 시니어 맞춤형 학습 교재·진도 관리 웹앱

`prd.md`(v1.0.0)를 구현한 React + Supabase + GitHub Pages 앱입니다.

| 화면 | 주소 | 내용 |
|---|---|---|
| 로그인 | `#/login` | 수강생 번호 + 숫자 PIN 4~6자리 |
| 내 공부방 | `#/` | 전체 진도 게이지, 교재 카드 목록, 하단 고정 「새 교재 올리기」 |
| 교재 올리기 | (창) | 파일 고르기 → 이름·단원 수 → 등록하기 (50MB 초과 시 안내) |
| 공부 화면 | `#/study/:id` | 교재 뷰어(100~300% 확대), 단원별 큰 체크 카드, 축하 메시지 |

## 1. Supabase 준비 (한 번만)

1. [supabase.com](https://supabase.com)에서 프로젝트를 만든다.
2. **SQL Editor**에 `supabase/schema.sql` 전체를 붙여 넣고 실행한다.
   테이블 3개, RLS 정책, 진도 집계 트리거, `create_material` 함수, 비공개 버킷 `learning-materials`가 만들어진다.
3. **Authentication → Providers → Email**에서 *Allow new users to sign up*을 끈다.
   수강생 계정은 강사가 아래 스크립트로만 만든다.

## 2. 수강생 PIN 계정 만들기 (강사·관리자)

Supabase에는 PIN 로그인이 없어서, `수강생번호` → `s<번호>@academy.local` 가상 이메일,
`PIN` → `pin-<PIN>` 비밀번호로 바꿔 이메일/비밀번호 로그인을 씁니다 (`src/lib/pin.js`).

```bash
cp scripts/students.example.csv scripts/students.csv   # 번호,이름,PIN 으로 채우기
SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=서비스롤키 node scripts/create-students.mjs scripts/students.csv
```

- `service_role` 키는 관리자 PC에서만 쓰고 저장소·GitHub Secrets에 넣지 않습니다.
- `students.csv`에는 PIN이 들어 있으니 커밋하지 마세요.
- PIN 4자리는 경우의 수가 1만 개뿐입니다. Supabase 로그인 시도 제한(Authentication → Rate Limits)을 켜 두고, 가능하면 6자리를 쓰세요.

## 3. 로컬 실행

```bash
cp .env.example .env    # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 입력
npm install
npm run dev
```

## 4. GitHub Pages 자동 배포

1. GitHub 저장소를 만들고 이 폴더를 `main` 브랜치로 올린다.
2. **Settings → Secrets and variables → Actions**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 Secret으로 추가한다.
   (가상 이메일 도메인을 바꿨다면 `VITE_PIN_EMAIL_DOMAIN`을 Variable로 추가)
3. **Settings → Pages → Source**를 *GitHub Actions*로 바꾼다.
4. `main`에 push하면 `.github/workflows/deploy.yml`이 빌드해서 `https://<계정>.github.io/<저장소>/`에 배포한다.

새로고침 404를 막으려고 `HashRouter`(`/#/...`)를 쓰고, `404.html`도 함께 배포합니다.

## 5. 인수 조건 점검 방법 (PRD 8-2)

- **UI 규격**: 버튼·링크 높이가 모두 48px 이상인지, 화면 문구에 영어가 없는지 개발자 도구로 확인.
- **데이터 무결성**: 3단원 교재에서 1단원을 누르면 33%로 바뀌고, 새로고침해도 그대로인지 확인.
  `progress_items.is_completed = true`, `materials.completed_units = 1`이어야 한다.
- **RLS**: 수강생 A로 로그인한 상태에서 B의 교재 id로 `materials`·`progress_items`를 조회하면 빈 배열,
  B의 파일 경로로 서명 주소를 만들면 오류가 나야 한다.
- **배포**: push 후 Actions가 초록색으로 끝나고, 배포 주소에서 새로고침해도 404가 나지 않아야 한다.

## 폴더 구조

```
supabase/schema.sql          테이블·RLS·트리거·버킷 SQL
scripts/create-students.mjs  PIN 계정 일괄 생성
src/lib/pin.js               번호·PIN → 이메일·비밀번호 규칙 (앱과 스크립트가 공유)
src/context/AuthContext.jsx  로그인 상태, 글자 배율(profiles.font_scale)
src/pages/                   Login, Dashboard, Study
src/components/              TopBar, ProgressBar, UploadModal, MaterialViewer(pdf.js)
.github/workflows/deploy.yml GitHub Pages 배포
```
