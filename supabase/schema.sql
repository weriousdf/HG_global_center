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
-- 10. 설정값 보관 (이메일 API 키 등)
--
--    관리자 화면을 매번 열지 않아도 신청이 들어온 것을 알 수 있게, 새 신청이 저장될 때
--    이메일을 보낸다. 그러려면 이메일 서비스의 API 키를 어딘가 둬야 한다.
--
--    이 표는 API 로 노출하지 않는다 — admins 와 같은 방식으로 잠그고, 대시보드에서만
--    손댄다. 값을 읽는 것은 security definer 함수뿐이다.
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. 새 신청 알림 메일
--
--    pg_net 으로 이메일 서비스(Resend)의 API 를 호출한다. 대시보드의
--    Database Webhooks 도 내부적으로 같은 방식인데, 그쪽은 정해진 형식의 payload 만
--    보내서 이메일 서비스가 원하는 형태로 바꿔 줄 함수를 따로 배포해야 한다.
--    여기서는 필요한 형태를 바로 만들어 보내므로 그 단계가 없다.
--
--    pg_net 은 요청을 큐에 넣고 바로 돌아온다. 그래서 메일 발송이 느리거나 실패해도
--    신청서 저장은 영향받지 않는다 — 고객 쪽이 막히면 안 되므로 이 점이 중요하다.
-- ---------------------------------------------------------------------------
create extension if not exists pg_net;

-- 고객이 적은 이름·요청사항이 메일 HTML 에 그대로 들어가면 서식이 깨진다.
-- (요청사항은 2000자 자유 입력이다.)
create or replace function public.html_escape(t text)
returns text
language sql
immutable
as $$
  -- NULL 은 NULL 로 남긴다. 아래 본문에서 "값이 없으면 표의 행 자체를 뺀다" 는 처리가
  -- concat 결과가 NULL 이 되는 것에 기대고 있어서, 여기서 '' 로 바꾸면 빈 행이 생긴다.
  select replace(replace(replace(replace(t,
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

create or replace function public.notify_new_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key  text;
  v_to   text;
  v_from text;
  v_when text;
begin
  -- 붙여넣을 때 딸려오는 줄바꿈·공백을 걸러낸다. 눈에 안 보여서 찾기 어려운 원인이다.
  select btrim(value) into v_key  from public.app_settings where key = 'resend_api_key';
  select btrim(value) into v_to   from public.app_settings where key = 'notify_email';
  select btrim(value) into v_from from public.app_settings where key = 'notify_from';

  -- 설정이 없으면 조용히 넘어간다. 알림을 안 붙였다고 신청 저장이 막히면 안 된다.
  -- 자리표시 문구가 그대로 남아 있는 경우(키를 안 채우고 실행)도 같이 걸러낸다.
  if v_key is null or v_to is null or v_key = '' or v_to = ''
     or left(v_key, 3) <> 're_' then
    return new;
  end if;

  v_from := coalesce(v_from, '한결 글로벌문서 센터 <onboarding@resend.dev>');
  -- to_char 의 서식 문자열에서 한글은 큰따옴표로 감싸 그대로 출력되게 한다
  v_when := to_char(new.created_at at time zone 'Asia/Seoul', 'MM"월" DD"일" HH24:MI');

  perform net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || v_key,
                 'Content-Type',  'application/json'
               ),
    body    := jsonb_build_object(
      'from',    v_from,
      'to',      jsonb_build_array(v_to),
      'subject', '[새 신청] ' || new.name || ' · ' || new.country || ' ' || new.doc_type,
      'html',
        '<div style="font-family:sans-serif;font-size:15px;line-height:1.7">'
        || '<h2 style="margin:0 0 4px">새 견적·상담 신청</h2>'
        || '<p style="margin:0 0 16px;color:#666">' || v_when || ' 접수 · 접수번호 '
        || new.order_no || '</p>'
        || '<table cellpadding="6" style="border-collapse:collapse;font-size:14px">'
        || '<tr><td style="color:#666">이름</td><td><b>' || html_escape(new.name) || '</b></td></tr>'
        || '<tr><td style="color:#666">연락처</td><td><b>' || html_escape(new.phone) || '</b></td></tr>'
        || '<tr><td style="color:#666">제출 국가</td><td>' || html_escape(new.country) || '</td></tr>'
        || '<tr><td style="color:#666">서류 종류</td><td>' || html_escape(new.doc_type) || '</td></tr>'
        || '<tr><td style="color:#666">인증 방식</td><td>' || html_escape(new.cert_type) || '</td></tr>'
        -- 값이 없으면 행 자체를 뺀다 (concat 이 NULL 이 되어 coalesce 가 '' 를 준다)
        || coalesce('<tr><td style="color:#666">이메일</td><td>' || html_escape(new.email) || '</td></tr>', '')
        || coalesce('<tr><td style="color:#666">요청사항</td><td>' || html_escape(new.memo) || '</td></tr>', '')
        || '</table>'
        || '<p style="margin:20px 0 0;font-size:13px;color:#666">'
        || '담당자 확인 후 절차와 총액을 안내해 주세요.</p></div>'
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    -- 알림이 실패해도 신청서 저장은 반드시 성공해야 한다
    raise warning '알림 메일 발송 실패: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists applications_notify on public.applications;
create trigger applications_notify
  after insert on public.applications
  for each row
  execute function public.notify_new_application();

-- ---------------------------------------------------------------------------
-- 12. 알림 설정 (한 번만)
--
--    (1) resend.com 에 가입하고 API Keys 에서 키를 만든다 (re_ 로 시작).
--    (2) 아래 세 줄의 주석을 풀고 값을 채워 실행한다.
--
--    보내는 주소(notify_from)를 생략하면 Resend 의 기본 발신 주소를 쓴다. 그 경우
--    받는 주소는 Resend 에 가입한 본인 이메일이어야 한다 (테스트 발신 주소의 제약).
--    다른 주소로도 보내려면 Resend 에서 도메인을 인증하고 notify_from 을 그 도메인
--    주소로 바꾼다.
-- ---------------------------------------------------------------------------
-- insert into public.app_settings (key, value) values
--   ('resend_api_key', 're_여기에_키'),
--   ('notify_email',   'beefmeat777@gmail.com')
-- on conflict (key) do update set value = excluded.value, updated_at = now();

-- 설정 확인 (키는 앞 8자만):
-- select key, left(value, 8) || '…' as value, updated_at from public.app_settings;

-- 알림을 잠시 끄려면:
-- delete from public.app_settings where key = 'resend_api_key';

-- ---------------------------------------------------------------------------
-- 13. 알림이 안 오면 — 발송 결과 확인
--    pg_net 은 응답을 이 표에 남긴다. status_code 200 이면 Resend 가 받은 것이다.
-- ---------------------------------------------------------------------------
-- select id, status_code, content, created
--   from net._http_response order by created desc limit 5;

-- ---------------------------------------------------------------------------
-- 14. 확인용 — 대시보드에서 쌓인 신청서 보기
-- ---------------------------------------------------------------------------
-- select order_no, created_at, name, phone, country, doc_type, cert_type, status
--   from public.applications order by created_at desc;
