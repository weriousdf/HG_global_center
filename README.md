# 한결 글로벌문서 센터

해외·국내 간 서류 처리(번역 → 공증 → 아포스티유/대사관 인증 → 발송)를 원스톱으로 안내하고
견적·상담 신청을 받는 웹사이트.

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

## 화면 변형 미리보기

디자인 비교용 변형은 URL 쿼리로 고른다. 고객에게 노출되는 UI 는 없다.

| URL | 결과 |
| --- | --- |
| `/` | 레이아웃 A(신청 우선) + 단계형 위저드 — 기본값 |
| `/?layout=b` | 레이아웃 B(설명 우선) |
| `/?flow=single` | 신청을 한 화면 요약형으로 |
| `/?preview=1` | 위 두 축을 눌러 바꿀 수 있는 검토용 바 표시 |

## 아직 안 된 것

- **진행상황 조회** — 화면은 있지만 조회가 연결되지 않았다. 지금은 예시 데이터가 뜨고,
  그 사실을 알리는 안내문이 화면에 붙어 있다. 실제로 붙이려면 접수번호 + 휴대폰 뒷자리로
  본인 확인하는 함수(`track_application`)를 하나 더 만들어야 한다.
- 비용 표 실제 금액, 제휴 법무법인 수 (현재 `[00,000]원` 자리표시)
- 로고·사진 (현재 여백과 원형 도형으로 처리)
- 신청 폼 확장: 부수, 희망 수령일, 수령 방법, 파일 업로드
- 푸터의 사업자 정보·연락처·개인정보 처리방침
