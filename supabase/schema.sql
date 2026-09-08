-- 한결 글로벌문서 센터 — 견적·상담 신청서 저장 스키마
-- Supabase 대시보드 > SQL Editor 에 그대로 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다 (drop 후 재생성).

-- ---------------------------------------------------------------------------
-- 1. 신청서 테이블
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id          uuid primary key default gen_random_uuid(),
  order_no    text        not null unique,   -- 접수번호 HG-YYMM-0001
  name        text        not null,          -- 신청자 이름
  phone       text        not null,          -- 연락처
  email       text,                          -- 이메일 (선택)
  country     text        not null,          -- 제출 국가
  doc_type    text        not null,          -- 서류 종류
  cert_type   text        not null,          -- 인증 방식 (아포스티유 / 대사관 인증)
  memo        text,                          -- 추가 요청사항 (선택)
  status      text        not null default '접수',
  created_at  timestamptz not null default now()
);

create index if not exists applications_created_at_idx
  on public.applications (created_at desc);

-- ---------------------------------------------------------------------------
-- 2. 접수번호 발급용 시퀀스
--    HG-2609-0001 형태. 월이 바뀌면 앞자리(YYMM)가 바뀌고 뒷번호는 계속 증가.
-- ---------------------------------------------------------------------------
create sequence if not exists public.application_order_seq start 1;

-- ---------------------------------------------------------------------------
-- 3. RLS — 테이블을 잠그고, 정책을 하나도 만들지 않는다.
--    익명 방문자(anon 키)는 테이블을 직접 읽거나 쓸 수 없다.
--    저장은 아래 4번 함수를 통해서만 일어난다.
--    관리자인 나는 Supabase 대시보드(service_role)로 언제든 전체 조회 가능.
-- ---------------------------------------------------------------------------
alter table public.applications enable row level security;

revoke all on public.applications from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. 신청서 저장 함수
--    security definer 로 RLS를 우회해 insert 하고, 접수번호만 돌려준다.
--    고객은 이 함수 하나만 호출할 수 있어서 남의 신청서를 볼 방법이 없다.
-- ---------------------------------------------------------------------------
create or replace function public.submit_application(
  p_name      text,
  p_phone     text,
  p_country   text,
  p_doc_type  text,
  p_cert_type text,
  p_email     text default null,
  p_memo      text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_no text;
begin
  -- 필수값 검증 (빈 문자열도 거부)
  if coalesce(btrim(p_name), '') = '' then
    raise exception '이름을 입력해 주세요.';
  end if;
  if coalesce(btrim(p_phone), '') = '' then
    raise exception '연락처를 입력해 주세요.';
  end if;
  if coalesce(btrim(p_country), '') = '' or coalesce(btrim(p_doc_type), '') = '' then
    raise exception '제출 국가와 서류 종류를 선택해 주세요.';
  end if;

  -- 길이 제한 (장문 투입 방지)
  -- country 는 '기타' 를 고른 고객이 직접 적는 자유 입력이므로 특히 필요하다.
  if length(p_name) > 60 or length(p_phone) > 40
     or length(coalesce(p_email, '')) > 120 or length(coalesce(p_memo, '')) > 2000
     or length(p_country) > 40 or length(p_doc_type) > 60 or length(p_cert_type) > 40 then
    raise exception '입력값이 너무 깁니다.';
  end if;

  v_order_no := 'HG-' || to_char(now() at time zone 'Asia/Seoul', 'YYMM')
                || '-' || lpad(nextval('public.application_order_seq')::text, 4, '0');

  insert into public.applications
    (order_no, name, phone, email, country, doc_type, cert_type, memo)
  values
    (v_order_no, btrim(p_name), btrim(p_phone), nullif(btrim(coalesce(p_email, '')), ''),
     p_country, p_doc_type, p_cert_type, nullif(btrim(coalesce(p_memo, '')), ''));

  return v_order_no;
end;
$$;

revoke all on function public.submit_application(text, text, text, text, text, text, text) from public;
grant execute on function public.submit_application(text, text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. 관리자 명단
--    "로그인한 사람" 이 아니라 "이 표에 있는 사람" 만 신청서를 읽을 수 있게 한다.
--    Supabase 는 회원가입이 열려 있으면 누구나 계정을 만들 수 있으므로,
--    authenticated 역할만으로 권한을 주면 아무나 신청서를 보게 된다.
--    이 표는 API 로 노출하지 않는다 — 대시보드에서만 손댄다.
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  email    text,
  added_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- 정책 안에서 admins 를 직접 조회하면 admins 자신의 RLS 에 걸려 항상 거짓이 된다.
-- security definer 함수로 감싸서 우회한다.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. 관리자만 신청서를 읽는다
--    3번에서 테이블 권한을 전부 회수했으므로, SELECT 를 다시 주고 정책을 붙인다.
--    익명 방문자(anon)에게는 여전히 아무 권한도 없다.
-- ---------------------------------------------------------------------------
grant select on public.applications to authenticated;

drop policy if exists "관리자만 신청서를 읽는다" on public.applications;
create policy "관리자만 신청서를 읽는다"
  on public.applications
  for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. 관리자 계정 등록 (한 번만)
--
--    (1) 대시보드 Authentication → Users → "Add user" 로 계정을 만든다.
--        Auto Confirm User 를 켜 두면 메일 확인 절차 없이 바로 쓸 수 있다.
--    (2) 아래 줄의 주석을 풀고 본인 이메일로 바꿔 실행한다.
-- ---------------------------------------------------------------------------
-- insert into public.admins (user_id, email)
-- select id, email from auth.users where email = 'beefmeat777@gmail.com'
-- on conflict (user_id) do nothing;

-- 등록된 관리자 확인:
-- select a.email, a.added_at from public.admins a order by a.added_at;

-- ---------------------------------------------------------------------------
-- 8. 진행 상태 값
--    관리자가 이 순서로 상태를 넘긴다. 오타로 엉뚱한 값이 들어가면 고객 화면의
--    단계 표시가 깨지므로 제약으로 묶어 둔다.
-- ---------------------------------------------------------------------------
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('접수', '번역', '공증', '인증', '발송', '완료', '취소'));

-- ---------------------------------------------------------------------------
-- 9. 진행상황 조회 — 휴대폰 번호로만 조회한다
--
--    접수번호로 조회하게 두면 안 된다. 접수번호는 HG-2609-0001, 0002 … 로 순차
--    발급되므로 남의 번호를 찍어서 타인의 진행상황을 볼 수 있다.
--    휴대폰 번호는 010-XXXX-XXXX 로 1억 가지여서 찍을 수 없다. 고객이 채울 칸도
--    하나로 같다 — 더 안전하면서 더 간단하다.
--
--    돌려주는 것도 최소한으로 줄였다. 이름은 첫 글자만 남기고 가리고, 연락처·이메일·
--    요청사항은 아예 내보내지 않는다. 진행상황을 보는 데 필요하지 않은 개인정보다.
-- ---------------------------------------------------------------------------

-- 010-1234-5678 / 01012345678 / +82 10-1234-5678 을 같은 값으로 비교하기 위한 정규화
create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
$$;

create or replace function public.track_applications(p_phone text)
returns table (
  order_no    text,
  name_masked text,
  status      text,
  created_at  timestamptz,
  country     text,
  doc_type    text,
  cert_type   text
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_digits text := public.normalize_phone(p_phone);
begin
  -- 자리수가 모자란 번호는 조용히 0건 (짧은 번호로 훑는 시도를 돕지 않는다)
  if length(v_digits) < 9 then
    return;
  end if;

  return query
  select a.order_no,
         left(a.name, 1) || repeat('*', greatest(char_length(a.name) - 1, 1)),
         a.status,
         a.created_at,
         a.country,
         a.doc_type,
         a.cert_type
    from public.applications a
   where public.normalize_phone(a.phone) = v_digits
   order by a.created_at desc;
end;
$$;

revoke all on function public.track_applications(text) from public;
grant execute on function public.track_applications(text) to anon, authenticated;

-- 조회가 자주 일어나므로 정규화된 번호에 인덱스를 둔다
create index if not exists applications_phone_digits_idx
  on public.applications (public.normalize_phone(phone));

-- ---------------------------------------------------------------------------
-- 10. 확인용 — 대시보드에서 쌓인 신청서 보기
-- ---------------------------------------------------------------------------
-- select order_no, created_at, name, phone, country, doc_type, cert_type, status
--   from public.applications order by created_at desc;
