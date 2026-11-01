-- =====================================================================
-- 시니어 맞춤형 학습 교재·진도 관리 웹앱 : Supabase 스키마 (PRD 6-2, 6-3)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여 넣고 한 번 실행한다.
-- 여러 번 실행해도 되도록 IF NOT EXISTS / OR REPLACE 를 사용한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  font_scale   float not null default 1.0 check (font_scale between 0.8 and 2.0),
  created_at   timestamptz not null default now()
);

create table if not exists public.materials (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  file_path       text not null,
  file_type       text not null check (file_type in ('pdf', 'image')),
  total_units     int  not null check (total_units between 1 and 200),
  completed_units int  not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists public.progress_items (
  id           uuid primary key default gen_random_uuid(),
  material_id  uuid not null references public.materials (id) on delete cascade,
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  unit_number  int  not null,
  unit_title   text not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  unique (material_id, unit_number)
);

-- 단원이 교재의 몇 쪽부터 몇 쪽까지인지 (교재 분석으로 제안 → 사용자가 확정). 사진 교재는 비어 있다.
alter table public.progress_items add column if not exists page_start int check (page_start >= 1);
alter table public.progress_items add column if not exists page_end   int check (page_end >= page_start);

create index if not exists materials_user_idx      on public.materials (user_id, created_at desc);
create index if not exists progress_material_idx   on public.progress_items (material_id, unit_number);

-- ---------------------------------------------------------------------
-- 2. 트리거
-- ---------------------------------------------------------------------

-- 2-1. 계정이 생기면 profiles 행을 자동으로 만든다 (이름은 가입 메타데이터에서)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2-2. 완료 체크 시각 자동 기록
create or replace function public.set_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.is_completed and (tg_op = 'INSERT' or not old.is_completed) then
    new.completed_at := now();
  elsif not new.is_completed then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists progress_set_completed_at on public.progress_items;
create trigger progress_set_completed_at
  before insert or update of is_completed on public.progress_items
  for each row execute function public.set_completed_at();

-- 2-3. 반정규화 컬럼 materials.completed_units 를 항상 실제 값과 맞춘다
create or replace function public.sync_completed_units()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target uuid := coalesce(new.material_id, old.material_id);
begin
  perform set_config('app.syncing_units', 'on', true);
  update public.materials m
     set completed_units = (
       select count(*) from public.progress_items p
        where p.material_id = target and p.is_completed
     )
   where m.id = target;
  perform set_config('app.syncing_units', 'off', true);
  return null;
end;
$$;

drop trigger if exists progress_sync_completed on public.progress_items;
create trigger progress_sync_completed
  after insert or update of is_completed or delete on public.progress_items
  for each row execute function public.sync_completed_units();

-- ---------------------------------------------------------------------
-- 3. 교재 등록 RPC : 교재 1건 + 단원 체크리스트 N건을 한 트랜잭션으로 생성
--    security invoker 이므로 아래 RLS 정책이 그대로 적용된다.
-- ---------------------------------------------------------------------
create or replace function public.create_material(
  p_title       text,
  p_file_path   text,
  p_file_type   text,
  p_total_units int
)
returns public.materials
language plpgsql
security invoker set search_path = public
as $$
declare
  m public.materials;
begin
  -- 파일 경로는 반드시 본인 폴더(<user_id>/...) 아래여야 한다
  if split_part(p_file_path, '/', 1) <> auth.uid()::text then
    raise exception '본인 폴더의 파일만 등록할 수 있습니다';
  end if;

  insert into public.materials (title, file_path, file_type, total_units)
  values (p_title, p_file_path, p_file_type, p_total_units)
  returning * into m;

  insert into public.progress_items (material_id, unit_number, unit_title)
  select m.id, n, n || '단원'
    from generate_series(1, p_total_units) as n;

  return m;
end;
$$;

-- 3-2. 사용자가 확정한 단원 목록으로 교재를 등록한다
--      p_units = [{"title": "센서로 고장을 미리", "page_start": 4, "page_end": 14}, ...]
create or replace function public.create_material_with_units(
  p_title     text,
  p_file_path text,
  p_file_type text,
  p_units     jsonb
)
returns public.materials
language plpgsql
security invoker set search_path = public
as $$
declare
  m public.materials;
  n int := jsonb_array_length(p_units);
begin
  if split_part(p_file_path, '/', 1) <> auth.uid()::text then
    raise exception '본인 폴더의 파일만 등록할 수 있습니다';
  end if;
  if n < 1 or n > 200 then
    raise exception '단원은 1개에서 200개까지 정할 수 있습니다';
  end if;

  insert into public.materials (title, file_path, file_type, total_units)
  values (p_title, p_file_path, p_file_type, n)
  returning * into m;

  insert into public.progress_items (material_id, unit_number, unit_title, page_start, page_end)
  select m.id,
         u.ord::int,
         coalesce(nullif(left(trim(u.value ->> 'title'), 100), ''), u.ord || '단원'),
         (u.value ->> 'page_start')::int,
         (u.value ->> 'page_end')::int
    from jsonb_array_elements(p_units) with ordinality as u(value, ord);

  return m;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. RLS : 로그인한 본인 데이터만 조회·수정·삭제 (PRD 4. 보안)
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.materials      enable row level security;
alter table public.progress_items enable row level security;

drop policy if exists "본인 프로필 조회" on public.profiles;
drop policy if exists "본인 프로필 수정" on public.profiles;
create policy "본인 프로필 조회" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "본인 프로필 수정" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "본인 교재 조회" on public.materials;
drop policy if exists "본인 교재 등록" on public.materials;
drop policy if exists "본인 교재 수정" on public.materials;
drop policy if exists "본인 교재 삭제" on public.materials;
create policy "본인 교재 조회" on public.materials
  for select to authenticated using (user_id = auth.uid());
create policy "본인 교재 등록" on public.materials
  for insert to authenticated with check (user_id = auth.uid());
create policy "본인 교재 수정" on public.materials
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "본인 교재 삭제" on public.materials
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "본인 진도 조회" on public.progress_items;
drop policy if exists "본인 진도 등록" on public.progress_items;
drop policy if exists "본인 진도 수정" on public.progress_items;
drop policy if exists "본인 진도 삭제" on public.progress_items;
create policy "본인 진도 조회" on public.progress_items
  for select to authenticated using (user_id = auth.uid());
create policy "본인 진도 등록" on public.progress_items
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.materials m where m.id = material_id and m.user_id = auth.uid())
  );
create policy "본인 진도 수정" on public.progress_items
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "본인 진도 삭제" on public.progress_items
  for delete to authenticated using (user_id = auth.uid());

-- 사용자가 completed_units 를 임의로 고치지 못하게 막는다 (sync 트리거만 갱신)
-- Supabase 는 테이블 단위 UPDATE 권한을 주므로 컬럼 REVOKE 대신 트리거로 막는다.
create or replace function public.guard_completed_units()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.syncing_units', true), '') <> 'on' then
    new.completed_units := old.completed_units;
  end if;
  return new;
end;
$$;

drop trigger if exists materials_guard_completed on public.materials;
create trigger materials_guard_completed
  before update on public.materials
  for each row execute function public.guard_completed_units();

-- ---------------------------------------------------------------------
-- 5. Storage : 비공개 버킷 learning-materials (PRD 6-3, 7. 50MB 제한)
--    파일 경로 규칙 : <user_id>/<랜덤이름>.<확장자>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('learning-materials', 'learning-materials', false, 52428800,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "본인 교재 파일 조회" on storage.objects;
drop policy if exists "본인 교재 파일 올리기" on storage.objects;
drop policy if exists "본인 교재 파일 삭제" on storage.objects;
create policy "본인 교재 파일 조회" on storage.objects
  for select to authenticated
  using (bucket_id = 'learning-materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "본인 교재 파일 올리기" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'learning-materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "본인 교재 파일 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'learning-materials' and (storage.foldername(name))[1] = auth.uid()::text);
