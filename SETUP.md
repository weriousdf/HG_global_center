# 설정 · 운영 안내

한결 글로벌문서 센터 웹사이트를 처음 설정하고 운영하는 방법. 프로젝트 현황과 남은 일은
[README.md](README.md) 를 보세요.

## 폴더 구성

| 경로 | 무엇인가 |
| --- | --- |
| `docs/` | **실동작 웹사이트.** 이걸 인터넷에 올린다. 이름이 `docs` 인 이유는 아래 참고. |
| `docs/index.html` | 고객 화면 (랜딩·서비스 안내·견적 신청·진행상황 조회) |
| `docs/admin.html` | 관리자 화면 (로그인 후 접수 목록) |
| `supabase/schema.sql` | Supabase 에 한 번 실행하는 테이블·함수 정의 |
| `한결 글로벌문서 프로토타입.dc.html` | 초기 디자인 목업(참고용). 데이터 저장 기능은 없다. |
| `_ds/organic-.../` | Organic 디자인 시스템 원본 |
| `ios-frame.jsx`, `image-slot.js` | 목업에서 쓰던 부품 |

## 동작 구조

```
고객 브라우저                      Supabase (내 온라인 서버)
─────────────                     ──────────────────────────
docs/ 의 견적 신청 폼
  국가 · 서류 · 인증방식
  이름 · 연락처 ──── HTTPS ────▶  submit_application() 함수
                                      │
                                      ▼
                                  applications 테이블에 행 추가
                                  접수번호 HG-2609-0001 발급
  접수번호 표시  ◀────────────────────┘
```

고객은 `applications` 테이블을 **읽을 수 없다.** 테이블은 RLS 로 잠겨 있고 정책이 하나도
없어서, 익명 방문자가 할 수 있는 일은 `submit_application()` 함수 호출(=저장) 뿐이다.
쌓인 신청서는 Supabase 대시보드에서 본인만 조회한다.

## 처음 한 번만 하는 설정

### 1. Supabase 에 테이블 만들기

1. [supabase.com](https://supabase.com) 대시보드에서 프로젝트를 연다 (없으면 새로 만든다).
2. 왼쪽 메뉴 **SQL Editor** → **New query**.
3. `supabase/schema.sql` 내용을 전부 복사해 붙여넣고 **Run**.
4. 왼쪽 메뉴 **Table Editor** 에 `applications` 테이블이 보이면 성공.

### 2. 연결 키 넣기

두 값은 **같은 화면에 없다.** `Project Settings → API` 페이지에는 키만 있고 Project URL 은
없다. 여기서 URL 을 찾다가 헤매기 쉽다.

**키** — `Project Settings → API` → **Publishable key** (`sb_publishable_...` 로 시작)
→ `docs/config.js` 의 `SUPABASE_ANON_KEY`

**URL** — 메뉴를 헤매지 말고 **주소창에서 만드는 게 가장 확실하다.** 대시보드 주소가
`https://supabase.com/dashboard/project/wxceyxdxxsepwzvdwkur` 형태인데, 뒤의
`wxceyxdxxsepwzvdwkur` 가 프로젝트 ref 다. Project URL 은 항상 이 규칙이다:

```
https://<프로젝트ref>.supabase.co
```

→ `docs/config.js` 의 `SUPABASE_URL`

(대시보드에 라벨로 표시된 걸 보고 싶으면 `Project Settings → Data API` 페이지에 있다.
다만 Supabase 는 이 메뉴 이름을 종종 바꾸므로, 위의 주소창 방식이 오래 간다.)

결과가 이런 모양이어야 한다:

```js
window.HG_CONFIG = {
  SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_XXXXXXXXXXXXXXXXXXXXXXXX',
};
```

> **따옴표를 빼먹지 않는다.** 따옴표가 없으면 JavaScript 가 문자열이 아니라 변수 이름으로
> 읽어서 설정 전체가 만들어지지 않고, 신청 화면에 "연결 설정 대기 중" 만 계속 뜬다.

> Publishable key 는 브라우저에 공개되도록 만들어진 키라서 이 파일에 넣어도 되고, 저장소에
> 커밋해도 된다. (GitHub Pages 로 배포하면 브라우저가 이 파일을 받아가므로 커밋해야 한다.)
> **같은 화면의 `Secret key` (`sb_secret_...`, 예전 `service_role`) 는 절대 넣지 않는다.**
> 그 키는 모든 데이터를 읽고 지울 수 있어서, 웹페이지에 들어가는 순간 누구나 신청서
> 전체를 볼 수 있게 된다.

### 3. 내 컴퓨터에서 확인

```powershell
python -m http.server 5173 --directory D:\aiffel_work\HG_global_center\web
```

브라우저에서 <http://localhost:5173> 을 열고 견적 신청을 한 번 넣어 본다.
접수번호가 나오면, Supabase **Table Editor → applications** 에 그 행이 보여야 한다.

키를 아직 안 넣었으면 신청 화면에 "연결 설정 대기 중" 안내가 뜨고 제출이 막힌다.

### 4. 인터넷에 올리기 (GitHub Pages)

고객이 접속할 수 있어야 하므로 정적 호스팅에 올린다. GitHub Pages 가 무료다.

저장소는 이미 만들어져 있다 — <https://github.com/weriousdf/HG_global_center> (Public).

1. 저장소 **Settings → Pages** 로 간다.
2. Source 를 **Deploy from a branch** → 브랜치 `main` / 폴더 **`/docs`** 로 지정하고 Save.
3. 몇 분 뒤 <https://weriousdf.github.io/HG_global_center/> 에서 열린다.

> **사이트 폴더 이름이 왜 `docs` 인가**
> GitHub Pages 의 "Deploy from a branch" 방식은 폴더를 **저장소 루트 `/` 와 `/docs` 두 곳만**
> 지원한다. 임의의 폴더 이름은 고를 수 없다. 그래서 원래 `web/` 이던 폴더를 `docs/` 로
> 바꿨다. 문서가 아니라 웹사이트가 들어 있다.
>
> 이름을 `web/` 으로 되돌리고 싶으면 GitHub Actions 워크플로로 배포하면 된다. 대신
> 움직이는 부품이 하나 늘어난다.

> Claude Artifact 로는 배포할 수 없다. Artifact 페이지는 보안 정책상 외부 서버로의
> 통신이 차단되어 Supabase 를 호출하지 못한다.

## 쌓인 신청서 보기

### 방법 1 — 관리자 화면 (`admin.html`)

사이트에 붙어 있는 접수 관리 페이지다. 로그인하면 접수 목록이 표로 나오고, 이름·연락처·
접수번호로 검색하거나 CSV 로 내려받을 수 있다.

* 배포 후 주소: <https://weriousdf.github.io/HG_global_center/admin.html>
* 로컬: <http://localhost:5173/admin.html>

**처음 한 번, 관리자 계정을 만들어야 한다:**

1. Supabase 대시보드 **Authentication → Users → Add user**.
   이메일과 비밀번호를 정하고 **Auto Confirm User 를 켠다** (메일 확인 절차 생략).
2. **SQL Editor** 에서 `supabase/schema.sql` 7번 항목의 주석을 풀고, 본인 이메일로
   바꿔 실행한다:

   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = '내이메일@example.com'
   on conflict (user_id) do nothing;
   ```

이 두 번째 단계가 핵심이다. **로그인만 했다고 신청서를 볼 수 있는 게 아니라,
`admins` 표에 등록된 계정이어야 한다.** Supabase 는 회원가입이 열려 있으면 누구나 계정을
만들 수 있어서, "로그인한 사람" 기준으로 권한을 주면 아무나 신청서를 보게 된다.
로그인은 됐는데 목록이 비어 있으면 이 등록이 안 된 것이다.

직원이 늘면 1·2단계를 계정마다 반복한다. 권한을 뺄 때는:

```sql
delete from public.admins where email = '내보낼사람@example.com';
```

> 관리자 화면은 검색엔진에 노출되지 않는다 (`noindex` + `robots.txt`). 다만 주소를 아는
> 사람은 로그인 화면까지 볼 수 있다 — 로그인 자체는 Supabase 가 막아 준다.

### 방법 2 — Supabase 대시보드

관리자 화면 없이도 언제든 볼 수 있다. **Table Editor → applications** 에서 표로 보거나
CSV 로 내려받는다. 또는 **SQL Editor** 에서:

```sql
select order_no, created_at, name, phone, country, doc_type, cert_type, status
  from applications
 order by created_at desc;
```

## 새 신청 알림 메일

신청이 들어오면 지정한 주소로 메일이 온다. 관리자 화면을 계속 열어 두지 않아도 된다.
설정하지 않으면 알림만 안 가고 나머지는 정상 동작한다.

### 1. Resend 가입 (무료)

[resend.com](https://resend.com) 에 가입한다. 무료로 하루 100통, 월 3,000통까지 보낸다.

가입 후 **API Keys → Create API Key** 로 키를 만든다. `re_` 로 시작하는 문자열이다.
**이 키는 만들 때 한 번만 보여 주므로 그 자리에서 복사한다.**

> 도메인 인증 없이 쓰면 발신 주소가 Resend 의 `onboarding@resend.dev` 로 고정되고,
> **받는 주소는 Resend 에 가입한 본인 이메일만** 된다. 관리자 알림은 본인에게 오는
> 것이니 이대로 충분하다. 나중에 `@hangyeol...` 같은 자기 도메인으로 보내려면 Resend 에서
> 도메인을 인증하고 `notify_from` 설정을 추가한다.

### 2. 키와 받을 주소 등록

Supabase **SQL Editor** 에서 (`supabase/schema.sql` 12번 항목과 같은 내용):

```sql
insert into public.app_settings (key, value) values
  ('resend_api_key', 're_붙여넣기'),
  ('notify_email',   '내이메일@gmail.com')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

키는 `app_settings` 표에 들어가는데, 이 표는 `admins` 와 같은 방식으로 잠겨 있어서
웹페이지나 API 로는 아무도 읽을 수 없다. 대시보드에서만 보인다.

### 3. 확인

고객 화면에서 신청을 한 건 넣어 본다. 메일이 오지 않으면 발송 결과를 본다:

```sql
select id, status_code, content, created
  from net._http_response order by created desc limit 5;
```

| `status_code` | 뜻 |
| --- | --- |
| `200` | Resend 가 정상 접수. 메일함(스팸함도) 확인 |
| `400` `API key is invalid` | 키 값이 잘못됐다. 2단계에서 `re_여기에_키` 자리표시를 그대로 두고 실행했거나, Resend **목록 화면의 가려진 키**(`re_abc...`)를 복사한 경우다. 전체 키는 만드는 순간에만 보이므로 새로 만들어 그 자리에서 복사한다 |
| `401` · `403` | 키의 권한이 모자라다 |
| `422` | 받는 주소가 Resend 가입 이메일이 아니다 (도메인 미인증 상태의 제약) |
| 아무 행도 없음 | 설정이 등록되지 않았다 — 2단계를 다시 확인 |

### 알림 끄기

```sql
delete from public.app_settings where key = 'resend_api_key';
```

> 알림 메일에는 고객 이름·연락처가 담긴다. 담당자가 바로 연락하려면 필요한 정보지만,
> 그만큼 그 메일함과 Resend 계정도 고객 정보를 담는 곳이 된다는 뜻이다.

## 화면 변형 미리보기

디자인 비교용 변형은 URL 쿼리로 고른다. 고객에게 노출되는 UI 는 없다.

| URL | 결과 |
| --- | --- |
| `/` | 레이아웃 A(신청 우선) + 단계형 위저드 — 기본값 |
| `/?layout=b` | 레이아웃 B(설명 우선) |
| `/?flow=single` | 신청을 한 화면 요약형으로 |
| `/?preview=1` | 위 두 축을 눌러 바꿀 수 있는 검토용 바 표시 |

## 아직 안 된 것

- **관리자 화면에서 상태 변경** — 지금은 읽기만 된다. 신청서의 `status` 는 계속 `접수`
  로 남아 있어서, 고객이 진행상황을 조회해도 1단계만 보인다. 상태를 넘기려면 대시보드
  Table Editor 에서 직접 바꿔야 한다.
- 비용 표 실제 금액, 제휴 법무법인 수 (현재 `[00,000]원` 자리표시)
- 로고·사진 (현재 여백과 원형 도형으로 처리)
- 신청 폼 확장: 부수, 희망 수령일, 수령 방법, 파일 업로드
- 푸터의 사업자 정보·연락처·개인정보 처리방침
