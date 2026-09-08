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
-- 5. 확인용 — 대시보드에서 쌓인 신청서 보기
-- ---------------------------------------------------------------------------
-- select order_no, created_at, name, phone, country, doc_type, cert_type, status
--   from public.applications order by created_at desc;
