# 한결 글로벌문서 솔루션 센터

해외·국내 간 서류 처리(번역 → 공증 → 아포스티유/대사관 인증 → 발송)를 원스톱으로 안내하고
견적·상담 신청을 받는 웹사이트.

## 폴더 구성

| 경로 | 무엇인가 |
| --- | --- |
| `web/` | **실동작 웹사이트.** 이걸 인터넷에 올린다. |
| `supabase/schema.sql` | Supabase 에 한 번 실행하는 테이블·함수 정의 |
| `한결 글로벌문서 프로토타입.dc.html` | 초기 디자인 목업(참고용). 데이터 저장 기능은 없다. |
| `_ds/organic-.../` | Organic 디자인 시스템 원본 |
| `ios-frame.jsx`, `image-slot.js` | 목업에서 쓰던 부품 |

## 동작 구조

```
고객 브라우저                      Supabase (내 온라인 서버)
─────────────                     ──────────────────────────
web/ 의 견적 신청 폼
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

1. 대시보드 **Project Settings → API** 로 간다.
2. **Project URL** 과 **Project API keys** 의 `anon` `public` 키를 복사한다.
3. `web/config.js` 를 열어 두 값을 붙여넣는다.

> `anon` 키는 브라우저에 공개되도록 만들어진 키라서 이 파일에 넣어도 된다.
> **`service_role` 키는 절대 넣지 않는다.** 그 키는 모든 데이터를 읽고 지울 수 있어서,
> 웹페이지에 들어가는 순간 누구나 신청서 전체를 볼 수 있게 된다.

### 3. 내 컴퓨터에서 확인

```powershell
python -m http.server 5173 --directory D:\aiffel_work\HG_global_center\web
```

브라우저에서 <http://localhost:5173> 을 열고 견적 신청을 한 번 넣어 본다.
접수번호가 나오면, Supabase **Table Editor → applications** 에 그 행이 보여야 한다.

키를 아직 안 넣었으면 신청 화면에 "연결 설정 대기 중" 안내가 뜨고 제출이 막힌다.

### 4. 인터넷에 올리기 (GitHub Pages)

고객이 접속할 수 있어야 하므로 정적 호스팅에 올린다. GitHub Pages 가 무료다.

1. GitHub 에 새 저장소를 만든다 (예: `hg-global-center`).
2. 이 폴더를 그 저장소에 올린다.
3. 저장소 **Settings → Pages** → Source 를 `main` 브랜치 / `/web` 폴더로 지정.
4. 몇 분 뒤 `https://<사용자명>.github.io/hg-global-center/` 에서 열린다.

> Claude Artifact 로는 배포할 수 없다. Artifact 페이지는 보안 정책상 외부 서버로의
> 통신이 차단되어 Supabase 를 호출하지 못한다.

## 쌓인 신청서 보기

Supabase **SQL Editor** 에서:

```sql
select order_no, created_at, name, phone, country, doc_type, cert_type, status
  from applications
 order by created_at desc;
```

**Table Editor → applications** 에서 표로 보거나 CSV 로 내려받아도 된다.

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
