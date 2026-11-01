# 🚀 제품 요구사항 정의서 (PRD): 시니어 맞춤형 학습 교재 및 진도 관리 웹앱
**문서 버전:** v1.0.0
**작성자:** PO (Product Owner) / 시스템 분석가
**기술 스택:** UI Design (Google Stitch), Backend & DB (Supabase), CI/CD & Hosting (GitHub Actions / GitHub Pages)
**대상 조직:** 범용 개발자 그룹 (프론트엔드, BaaS 연동, 배포 파이프라인 실행 스쿼드)

---

## 1. 프로젝트 개요 및 비전 (Overview & Vision)
*   **비전:** 디지털 기기 조작에 어려움을 겪는 시니어 교육생들이 아무런 학습 장벽 없이 스스로 교재를 등록하고, 일일 학습 성취도를 시각적으로 확인하며 자기주도적 학습을 이어갈 수 있는 '초간편(Zero-Learning-Curve) 진도 관리 플랫폼'을 구축한다.
*   **비즈니스 목적:**
    *   Google Stitch를 활용한 신속한 UI 프로토타이핑 및 고가시성(High-Visibility) 컴포넌트 코드 생성으로 프론트엔드 개발 공수 50% 단축.
    *   Supabase(BaaS)와 GitHub Pages(정적 호스팅)를 결합하여 인프라 유지보수 비용이 '0'에 수렴하는 서버리스(Serverless) 아키텍처 완성.

## 2. 타겟 고객 및 페르소나 (Target & Persona)
*   **핵심 사용자 (박만수, 68세, 시니어 디지털/교양 아카데미 수강생):**
    *   **특징:** 노안으로 인해 작은 글씨와 낮은 명도 대비의 화면을 읽기 힘들어함. 복잡한 메뉴 트리(햄버거 메뉴, 다중 탭 등)나 영문 용어에 거부감을 느끼며, 터치 미스가 빈번함.
    *   **Pain Point:** 강사에게 받은 PDF/이미지 교재를 스마트폰이나 태블릿 어디에 저장했는지 매번 잊어버리며, 어디까지 공부했는지 기억하기 어려움.
    *   **Needs:** 앱을 켜자마자 내 교재가 크게 보이고, 공부한 단원을 큼직한 체크박스로 눌러 직관적인 진행률(막대그래프)로 확인하고 싶음.
*   **보조 사용자 (평생교육원 강사 및 관리자):**
    *   **Needs:** 시니어 수강생들이 별도의 회원가입 절차(복잡한 비밀번호 설정 등) 없이도 간편하게 접속하여 진도를 체크할 수 있는 환경을 원함.

## 3. 기능 요구사항 명세 (Functional Requirements)

### 3-1. 필수 구현 기능 (In-Scope)
1.  **시니어 친화적 간편 인증 (Supabase Auth):**
    *   복잡한 비밀번호 규칙을 배제하고, 카카오 소셜 로그인 또는 1회성 매직 링크(SMS/이메일 OTP), 혹은 사전 부여된 '수강생 고유 번호(PIN 4~6자리)' 기반의 간편 로그인 구현.
2.  **교재 파일 업로드 및 스토리지 연동 (Supabase Storage):**
    *   PDF, 이미지(JPG, PNG) 형태의 학습 교재 파일을 드래그 앤 드롭 또는 '큰 버튼 클릭' 한 번으로 업로드.
    *   교재 업로드 시 '단원(Chapter) 수' 또는 '총 페이지 수'를 설정하면, 자동으로 체크 가능한 학습 목차(Checklist) 레코드 생성.
3.  **학습 진도 체크 및 실시간 상태 동기화 (Supabase PostgreSQL):**
    *   단원별 완료 여부를 클릭 한 번으로 토글(완료/미완료) 처리.
    *   체크 상태 변경 즉시 전체 진행률($\text{진행률(\%)} = \frac{\text{완료한 단원 수}}{\text{전체 단원 수}} \times 100$)을 계산하여 상단 대형 프로그레스 바(Progress Bar)에 실시간 반영.
4.  **내장형 교재 뷰어 및 확대 기능:**
    *   업로드된 교재를 외부 앱 이탈 없이 웹앱 내에서 바로 열람하고, `+ / -` 대형 버튼으로 화면을 최대 $300\%$까지 확대/축소하는 기능.

### 3-2. 배제 기능 (Out-of-Scope)
*   실시간 화상 강의 스트리밍 및 다자간 채팅 기능.
*   복잡한 성적 산출, 수강생 간 랭킹 비교, 시험 채점 기능.
*   유료 결제(PG 연동) 및 교재 장바구니 기능.

### 3-3. 핵심 사용자 스토리 (User Stories)
*   **US-01 (교재 등록):** "시니어 교육생으로서, 나는 화면 중앙의 큼직한 '새 교재 올리기' 버튼을 눌러 오늘 받은 강의 자료(PDF)를 3번의 터치 이내로 등록하고 싶다."
*   **US-02 (진도 체크):** "시니어 교육생으로서, 나는 1단원 학습을 마친 후 '학습 완료' 버튼을 누르면, 즉시 축하 메시지와 함께 내 진도율 막대가 올라가는 것을 눈으로 확인하고 싶다."
*   **US-03 (기기 간 연동):** "시니어 교육생으로서, 나는 교육장 태블릿에서 체크한 학습 진도를 집에 돌아와 내 스마트폰으로 접속했을 때도 그대로 이어서 보고 싶다."

## 4. 비기능 요구사항 명세 (Non-Functional Requirements)
*   **시니어 웹 접근성 (Accessibility - WCAG 2.1 AAA 수준 준수):**
    *   **폰트 크기:** 본문 기본 텍스트 최소 `18px` 이상, 주요 타이틀 및 버튼 텍스트 `24px` 이상 강제 적용 (동적 글자 크기 조절 버튼 제공).
    *   **명도 대비:** 텍스트와 배경 간의 명도 대비율을 최소 $7:1$ 이상으로 설정하여 시인성 극대화.
    *   **터치 타겟:** 모든 버튼과 체크박스의 최소 물리적 영역을 `48px × 48px` 이상으로 설계하여 오작동 방지.
*   **성능 및 응답 시간 (Performance):**
    *   진도 체크박스 터치 후 Supabase DB 반영 및 UI 상태 업데이트 지연 시간(Latency) `300ms` 이내(Optimistic UI 적용).
    *   최대 `50MB` 이하의 PDF 교재 업로드 시 5초 이내 스토리지 적재 완료.
*   **보안 (Security):**
    *   Supabase RLS(Row Level Security) 정책을 강제하여, 인증된 교육생 본인이 업로드한 교재와 진도 데이터만 조회(SELECT)·수정(UPDATE)·삭제(DELETE)할 수 있도록 격리.
*   **가용성 및 배포 무결성:**
    *   GitHub Pages의 글로벌 CDN을 통한 정적 에셋 서빙 가용성 $99.9\%$ 보장.

## 5. UX 지침 및 화면 흐름 (Stitch UI Design & User Flow)

### 5-1. Google Stitch 기반 UI 설계 지침
*   **Stitch 프롬프트 설계 원칙:** Stitch를 통해 UI를 생성할 때 *"Senior-friendly interface, high contrast, oversized touch buttons, single-column layout, no hidden menus, Korean language labels"* 조건을 명시하여 레이아웃과 프론트엔드(React/Tailwind CSS) 코드를 추출한다.
*   **단일 컬럼(Single-Column) 레이아웃:** 시선의 분산을 막기 위해 다단 그리드를 지양하고 위에서 아래로 흐르는 직관적인 카드형 리스트 구조를 채택한다.
*   **시각적 피드백 강화:** 체크박스 선택 시 단순한 작은 체크 표시가 아닌, 카드 전체의 배경색이 연한 녹색으로 변하고 **"완료됨"**이라는 한글 배지가 크게 표시되도록 구성한다.

### 5-2. 사용자 화면 흐름 (User Flow)
```
[1. 접속 및 간편 로그인 화면] (큰 글씨 PIN 입력 또는 소셜 로그인 버튼)
       │
       ▼
[2. 내 학습방 대시보드] (전체 진도율 대형 게이지 + 등록된 교재 카드 목록 + '교재 올리기' 고정 버튼)
       │
       ├──(새 교재 등록 클릭)──> [3. 교재 업로드 모달] (파일 선택 -> 단원 수 입력 -> 등록 완료)
       │
       ▼ (교재 카드 클릭)
[4. 교재 학습 및 진도 체크 화면]
  ├─ 상단: 교재 뷰어 (글자 크게 보기 +/- 버튼)
  └─ 하단: 단원별 대형 체크리스트 ([ ] 1단원 학습하기 -> 터치 시 [V] 1단원 완료!)
```

## 6. 시스템 아키텍처 및 데이터 연동 설계 (Supabase & GitHub)

### 6-1. 전체 시스템 아키텍처 및 배포 파이프라인
1.  **UI 생성:** Google Stitch에서 시니어 특화 디자인 시안 확정 후 React + Tailwind CSS 컴포넌트 코드로 Export.
2.  **프론트엔드 & BaaS 연동:** 클라이언트 사이드에서 `@supabase/supabase-js` SDK를 통해 서버 없이 Supabase Storage 및 PostgreSQL과 직접 통신.
3.  **CI/CD (GitHub Actions):** `main` 브랜치에 코드가 Push되면 GitHub Actions 워크플로우가 작동하여 정적 빌드(`npm run build`)를 수행하고, 환경변수(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)를 주입한 뒤 **GitHub Pages**로 자동 배포.

### 6-2. 논리적 데이터베이스 스키마 (Supabase PostgreSQL)
*   **`profiles` (사용자 정보 테이블)**
    *   `id` (UUID, PK, `auth.users` 참조)
    *   `display_name` (TEXT, 교육생 성함)
    *   `font_scale` (FLOAT, 기본값 `1.0` - 개인별 글자 확대 설정값 저장)
    *   `created_at` (TIMESTAMPTZ)
*   **`materials` (학습 교재 테이블)**
    *   `id` (UUID, PK)
    *   `user_id` (UUID, FK -> `profiles.id`)
    *   `title` (TEXT, 교재 제목)
    *   `file_path` (TEXT, Supabase Storage 버킷 내 경로)
    *   `file_type` (TEXT, `pdf` | `image`)
    *   `total_units` (INT, 전체 단원/체크 항목 수)
    *   `completed_units` (INT, 완료된 단원 수 - 빠른 진도율 렌더링을 위한 반정규화 컬럼)
    *   `created_at` (TIMESTAMPTZ)
*   **`progress_items` (단원별 진도 체크 테이블)**
    *   `id` (UUID, PK)
    *   `material_id` (UUID, FK -> `materials.id`, ON DELETE CASCADE)
    *   `user_id` (UUID, FK -> `profiles.id`)
    *   `unit_number` (INT, 단원 번호)
    *   `unit_title` (TEXT, 예: "1장. 스마트폰 기본 설정")
    *   `is_completed` (BOOLEAN, 기본값 `false`)
    *   `completed_at` (TIMESTAMPTZ, 체크 완료 시각)

### 6-3. Supabase Storage 버킷 구성
*   **Bucket Name:** `learning-materials` (Private 버킷으로 설정 후 인증된 소유자에게만 Signed URL 발급).

## 7. 제약 사항 (Constraints)
*   **GitHub Pages 라우팅 제약:** GitHub Pages는 정적 파일 호스팅이므로 SPA(Single Page Application)의 클라이언트 사이드 라우팅 시 새로고침하면 `404 Not Found` 에러가 발생한다. 이를 방지하기 위해 `HashRouter`(`/#/dashboard`)를 사용하거나 `404.html` 리다이렉트 스크립트 핵(Hack)을 필수로 적용해야 한다.
*   **Supabase 무료 티어 제약 (도입 초기 기준):** Storage 용량 한계(1GB) 및 파일당 업로드 크기 제한(50MB)이 존재하므로, 프론트엔드 단에서 업로드 전 파일 용량을 검증하고 시니어 사용자에게 쉬운 한글 안내 문구("파일이 너무 큽니다. 강사님께 문의해 주세요")를 노출해야 한다.
*   **보안 키 노출 주의:** GitHub 공개 저장소(Public Repo) 사용 시 Supabase `service_role` 키는 절대 코드에 포함하지 않으며, 오직 RLS가 적용된 `anon(public)` 키만 GitHub Secrets를 통해 주입한다.

## 8. 성공 지표 수립 및 인수 조건 (KPIs & Acceptance Criteria)

### 8-1. 정량적 핵심 성과 지표 (KPIs)
*   **과업 완수율 (Task Completion Rate):** 60대 이상 테스트 사용자 그룹이 타인의 도움 없이 '교재 업로드 → 1단원 진도 체크'까지 성공하는 비율 $90\%$ 이상.
*   **첫 진도 체크 소요 시간 (Time-to-First-Action):** 앱 로그인 후 교재를 열어 진도 체크박스를 누르기까지 걸리는 평균 시간 `60초` 이내.
*   **클릭 오류율 (Misclick Rate):** 비정상적인 연속 터치나 빈 공간 클릭 발생 비율 $5\%$ 미만.

### 8-2. 최종 인수 조건 (Acceptance Criteria)
*   [ ] **Stitch UI 규격 검증:** 렌더링된 웹앱의 모든 버튼 높이가 `48px` 이상이고, 화면 내 영문 전문 용어(예: Upload, Submit, Dashboard 등)가 100% 쉬운 한국어("교재 올리기", "저장하기", "내 공부방")로 표시됨을 확인한다.
*   [ ] **Supabase 데이터 무결성:** 교육생 A가 교재의 3개 단원 중 1개를 체크했을 때, `progress_items`의 `is_completed`가 `true`로 변경되고 화면의 진행률이 즉시 $33.3\%$($33\%$로 반올림 표기)로 갱신되며 새로고침 후에도 유지됨을 시연한다.
*   [ ] **RLS 보안 테스트:** 사용자 A의 세션 토큰으로 사용자 B가 업로드한 교재 파일 URL이나 DB 레코드에 접근을 시도할 경우 `401/403` 또는 빈 배열이 반환되어 접근이 차단됨을 검증한다.
*   [ ] **GitHub 자동 배포 검증:** 소스 코드 수정 후 `main` 브랜치에 Push했을 때, GitHub Actions가 에러 없이 빌드를 마치고 GitHub Pages URL에서 최신 화면이 정상 작동하며 페이지 새로고침 시 `404` 에러가 발생하지 않음을 확인한다.
```

시니어 교육생을 위한 웹 접근성 기준, Google Stitch 기반의 UI 설계 지침, Supabase DB/Storage 스키마, 그리고 GitHub Pages 배포 시의 기술적 제약사항(SPA 라우팅 등)까지 모두 반영하여 PRD 작성을 마쳤다.

<ElicitationsGroup message="PRD를 바탕으로 다음 개발 단계로 바로 넘어가 볼 수 있습니다:">
  <Elicitation label="Google Stitch 입력용 UI 생성 프롬프트와 Supabase SQL 작성" query="이 PRD를 바탕으로 Google Stitch에 바로 입력할 수 있는 화면별 상세 프롬프트와, Supabase SQL Editor에서 실행할 테이블 및 RLS 정책 생성 SQL 스크립트를 작성해 줘." />
  <Elicitation label="시니어 친화적 React 단일 파일 프로토타입 및 GitHub 배포 설정" query="이 PRD의 요구사항을 반영하여 큰 글씨와 고대비 UI를 갖춘 React 웹앱 코드와 GitHub Pages 자동 배포용 GitHub Actions 워크플로우(yml)를 생성해 줘." />
</ElicitationsGroup>