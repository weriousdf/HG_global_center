/* 한결 글로벌문서 센터 — 실동작 웹앱
 *
 * 목업(`한결 글로벌문서 프로토타입.dc.html`)을 그대로 옮기고, 견적·상담 신청을
 * Supabase 에 저장하도록 만든 버전. 빌드 도구 없이 브라우저에서 바로 돈다.
 *
 * 화면 변형은 URL 쿼리로 고른다 (고객에게는 보이지 않는다):
 *   ?layout=a|b       a=신청 우선(기본), b=설명 우선
 *   ?flow=step|single step=단계형 위저드(기본), single=한 화면 요약형
 *   ?preview=1        위 두 축을 바꿔볼 수 있는 검토용 바를 띄운다
 */

// ═══════════════════════════════════════════════════════════════════════════
// 데이터 — 선택지와 안내 문구
// ═══════════════════════════════════════════════════════════════════════════

// 칩 목록은 자주 오는 것만 보여 주고, 없는 것은 '기타' 로 직접 입력받는다.
// 아포스티유 협약국 전체를 처리하는데 칩에 8개국만 두면 나머지 나라 고객이 막힌다.
const OTHER = '기타';
const COUNTRIES = ['미국', '중국', '일본', '베트남', '캐나다', '독일', '호주', '인도네시아', OTHER];
const DOCS = ['부모여행동의서', '유학 구비서류', '이민 서류', '비자·체류 서류', '정관', '계약서', '위임장(POA)', '경력 서류', OTHER];

/** '기타' 직접 입력칸의 항목별 설정. maxlength 는 schema.sql 의 길이 검사와 맞춘다. */
const OTHER_FIELDS = {
  country: { other: 'countryOther', label: '어느 나라인가요?', 이름: '국가',
             placeholder: '예: 몽골, 카자흐스탄, 사우디아라비아', max: 40 },
  doc:     { other: 'docOther',     label: '어떤 서류인가요?', 이름: '서류',
             placeholder: '예: 혼인관계증명서, 사업자등록증, 재직증명서', max: 60 },
};
const CERTS = ['아포스티유', '대사관 인증'];

const TRUST = [
  { num: '아포스티유 협약국 전체', label: '처리 국가', note: '협약 비가입국은 대사관 인증으로 처리' },
  { num: '20개국', label: '대사관 인증 처리국', note: '주요 진출·체류 국가 기준' },
  { num: '연 3,000건', label: '연간 처리 건수', note: '기업·개인 합계' },
  { num: '제휴 법무법인', label: '공증 촉탁', note: '제휴 법무법인 수는 확정 후 반영' },
  { num: '사전 고정', label: '가격 투명성', note: '신청 시 절차와 총액을 미리 확정' },
];

const PROCESS = [
  { no: '01', title: '전문 번역', body: '제출 기관이 요구하는 형식과 용어로 번역합니다.' },
  { no: '02', title: '법무법인 공증 촉탁', body: '제휴 법무법인을 통해 번역·원본 공증을 진행합니다.' },
  { no: '03', title: '아포스티유', body: '협약 가입국에 제출하는 서류는 아포스티유로 마칩니다.' },
  { no: '04', title: '대사관 인증 · 발송', body: '비가입국은 해당 대사관 인증까지 마친 뒤 지정한 곳으로 보냅니다.' },
];

const PRICES = [
  { item: '번역', scope: '서류 1종 · 원본 대조', days: '1–2 영업일', cost: '[00,000]원' },
  { item: '공증 촉탁', scope: '제휴 법무법인 공증', days: '1 영업일', cost: '[00,000]원' },
  { item: '아포스티유', scope: '외교부·법무부 발급', days: '1–2 영업일', cost: '[00,000]원' },
  { item: '대사관 인증', scope: '해당국 대사관 접수·수령', days: '3–5 영업일', cost: '[00,000]원' },
];

const INTRO = '한결 글로벌문서 센터는 해외 법인설립·주재원 파견·계약서·정관 등 기업 서류부터 부모동의서·유학·이민·외국인 비자까지, 국가 간 번역·공증·아포스티유·대사관 인증을 원스톱으로 처리하는 글로벌 문서 센터입니다.';
const B2C = '미성년자 부모여행동의서, 유학·이민 구비서류, 외국인 비자 발급 및 국내 체류 수속 서류의 번역·공증·인증 전 과정을 신속하고 정확하게 원스톱으로 해결합니다.';
const B2B = '해외 법인설립, 주재원 파견, 해외 투자·진출에 필수적인 정관·계약서·위임장(POA)·특허·경력 서류 등의 전문 번역부터 법무법인 공증 촉탁, 아포스티유 및 각국 대사관 인증까지 일괄 지원합니다.';

// ═══════════════════════════════════════════════════════════════════════════
// 상태
// ═══════════════════════════════════════════════════════════════════════════

const query = new URLSearchParams(location.search);

const state = {
  screen: 'home',
  layout: query.get('layout') === 'b' ? 'b' : 'a',
  flow: query.get('flow') === 'single' ? 'single' : 'step',
  preview: query.get('preview') === '1',

  // 신청 선택값
  step: 1,
  country: null,
  countryOther: '',   // country === '기타' 일 때 고객이 직접 적는 나라 이름
  doc: null,
  docOther: '',       // doc === '기타' 일 때 고객이 직접 적는 서류 이름
  cert: '아포스티유',
  name: '',
  phone: '',
  email: '',
  memo: '',

  // 제출 상태
  sending: false,
  orderNo: null,
  error: null,

  // 진행상황 조회
  trackPhone: '',      // 조회 화면에 입력한 휴대폰 번호
  trackRows: null,     // 조회 결과. null=조회 전, []=일치하는 신청 없음
  trackLoading: false,
  trackError: null,
};

const STEP_COUNT = 4;

function set(patch) {
  Object.assign(state, patch);
  render();
}

/** 입력창 값은 화면 어디에도 되비추지 않으므로, 다시 그리지 않고 상태만 갱신한다.
 *  (매 타이핑마다 다시 그리면 커서와 한글 조합이 끊긴다) */
function setQuiet(patch) {
  Object.assign(state, patch);
}

// ═══════════════════════════════════════════════════════════════════════════
// 유틸
// ═══════════════════════════════════════════════════════════════════════════

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** 저장·표시에 쓸 값. '기타' 를 골랐으면 고객이 직접 적은 이름을 쓴다.
 *  그래서 DB 에 `'기타'` 라는 값이 들어가는 일은 없다. */
function picked(key) {
  if (state[key] === OTHER) return state[OTHER_FIELDS[key].other].trim();
  return state[key];
}

const chain = () => `전문 번역 → 법무법인 공증 촉탁 → ${state.cert} → 발송`;
const eta = () => (state.cert === '대사관 인증' ? '7–10 영업일' : '4–6 영업일');

/** 010-1234-5678 / 01012345678 / +82 10 ... 를 모두 통과시키는 느슨한 검사.
 *  엄격하게 막기보다 오타를 걸러내는 정도가 목적이다. */
function phoneLooksValid(v) {
  const digits = v.replace(/[^0-9]/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

function emailLooksValid(v) {
  return v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** '기타' 를 골랐는데 이름을 안 적었거나 너무 긴 경우의 안내 문구. 없으면 null. */
function otherProblem(key) {
  if (state[key] !== OTHER) return null;
  const f = OTHER_FIELDS[key];
  const v = state[f.other].trim();
  if (!v) return `${f.이름} 이름을 직접 입력해 주세요.`;
  if (v.length > f.max) return `${f.이름} 이름이 너무 깁니다. ${f.max}자 안으로 적어 주세요.`;
  return null;
}

/** 선택·입력이 제출 가능한 상태인지. 부족하면 안내 문구를 돌려준다. */
function validate() {
  if (!state.country) return '제출 국가를 선택해 주세요.';
  const c = otherProblem('country');
  if (c) return c;
  if (!state.doc) return '서류 종류를 선택해 주세요.';
  const d = otherProblem('doc');
  if (d) return d;
  if (!state.name.trim()) return '이름을 입력해 주세요.';
  if (!state.phone.trim()) return '연락처를 입력해 주세요.';
  if (!phoneLooksValid(state.phone)) return '연락처를 다시 확인해 주세요.';
  if (!emailLooksValid(state.email.trim())) return '이메일 형식을 다시 확인해 주세요.';
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Supabase 연동
// ═══════════════════════════════════════════════════════════════════════════

const cfg = window.HG_CONFIG || {};

/** config.js 를 아직 채우지 않았으면 true. 이 경우 제출을 막고 안내를 띄운다. */
function configMissing() {
  const u = cfg.SUPABASE_URL || '';
  const k = cfg.SUPABASE_ANON_KEY || '';
  return !u || !k || u.includes('여기에') || k.includes('여기에');
}

/** 신청서를 Supabase 에 저장하고 접수번호를 돌려받는다.
 *  테이블에 직접 쓰지 않고 submit_application 함수를 호출한다 — 그래야
 *  익명 방문자가 남의 신청서를 읽을 권한 없이 저장만 할 수 있다. */
async function saveApplication() {
  const res = await fetch(`${cfg.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/submit_application`, {
    method: 'POST',
    headers: {
      apikey: cfg.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_name: state.name.trim(),
      p_phone: state.phone.trim(),
      p_country: picked('country'),
      p_doc_type: picked('doc'),
      p_cert_type: state.cert,
      p_email: state.email.trim() || null,
      p_memo: state.memo.trim() || null,
    }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.message || body.hint || body.error || detail;
    } catch { /* 본문이 JSON 이 아니면 상태 코드만 쓴다 */ }
    throw new Error(detail);
  }

  return await res.json(); // 접수번호 문자열
}

async function submit() {
  const problem = validate();
  if (problem) { set({ error: problem }); return; }

  if (configMissing()) {
    set({ error: 'Supabase 연결 설정이 아직 비어 있습니다. docs/config.js 의 SUPABASE_URL 과 SUPABASE_ANON_KEY 를 채워 주세요.' });
    return;
  }

  set({ sending: true, error: null });
  try {
    const orderNo = await saveApplication();
    set({ sending: false, orderNo, error: null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    set({
      sending: false,
      error: `신청서를 저장하지 못했습니다. ${e.message} — 잠시 후 다시 시도하거나 전화로 문의해 주세요.`,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 조각 렌더러
// ═══════════════════════════════════════════════════════════════════════════

/** 선택 칩 묶음. key 는 상태 필드명, items 는 라벨 배열. */
function chips(key, items) {
  return `<div class="chips">${items.map((label) => `
    <button type="button" class="btn chip ${state[key] === label ? 'btn-primary' : 'btn-secondary'}"
            data-pick="${key}" data-val="${esc(label)}">${esc(label)}</button>`).join('')}</div>`;
}

/** '기타' 를 골랐을 때만 나타나는 직접 입력칸. key 는 'country' 또는 'doc'. */
function otherField(key) {
  if (state[key] !== OTHER) return '';
  const f = OTHER_FIELDS[key];
  return `<span class="field" style="margin-top:14px;max-width:340px">
    <label for="f-other-${key}">${esc(f.label)} <span class="req">*</span></label>
    <input class="input" id="f-other-${key}" type="text" maxlength="${f.max}"
           placeholder="${esc(f.placeholder)}"
           data-field="${f.other}" value="${esc(state[f.other])}">
  </span>`;
}

function banner(kind, title, body) {
  return `<div class="banner banner-${kind}"><span class="banner-title">${esc(title)}</span>${body}</div>`;
}

function configBanner() {
  if (!configMissing()) return '';
  return banner('warn', '연결 설정 대기 중',
    '<code>docs/config.js</code> 에 Supabase 프로젝트 URL 과 anon 키를 넣으면 신청서가 실제로 저장됩니다. 지금은 제출이 막혀 있습니다.');
}

function errorBanner() {
  return state.error ? banner('error', '확인이 필요합니다', esc(state.error)) : '';
}

function previewBar() {
  if (!state.preview) return '';
  const btn = (k, v, label) => `<button type="button" class="btn ${state[k] === v ? 'btn-primary' : 'btn-secondary'}"
    style="font-size:11.5px;padding:5px 12px" data-set="${k}" data-val="${v}">${label}</button>`;
  return `<div style="display:flex;align-items:center;gap:18px;padding:10px 20px;background:var(--color-neutral-900);color:var(--color-neutral-100);font-size:11.5px;flex-wrap:wrap">
    <span style="letter-spacing:.12em;text-transform:uppercase;opacity:.6">검토용</span>
    <span style="display:flex;align-items:center;gap:7px"><span style="opacity:.65">레이아웃</span>
      ${btn('layout', 'a', 'A · 신청 우선')}${btn('layout', 'b', 'B · 설명 우선')}</span>
    <span style="display:flex;align-items:center;gap:7px"><span style="opacity:.65">신청 흐름</span>
      ${btn('flow', 'step', '단계형 위저드')}${btn('flow', 'single', '한 화면 요약형')}</span>
  </div>`;
}

/** 선택 요약 + 예상 절차 카드. */
function summaryCard(extra = '') {
  return `<div class="card elev-md apply-summary" style="padding:26px 28px;background:var(--color-surface)">
    <span class="card-kicker">선택 요약</span>
    <div style="display:grid;gap:10px;margin-top:10px">
      <span class="summary-row"><span class="summary-key">제출 국가</span><span class="summary-val" data-live="country">${esc(picked('country') || '선택 전')}</span></span>
      <span class="summary-row"><span class="summary-key">서류 종류</span><span class="summary-val" data-live="doc">${esc(picked('doc') || '선택 전')}</span></span>
      <span class="summary-row"><span class="summary-key">인증 방식</span><span class="summary-val">${esc(state.cert)}</span></span>
    </div>
    <span style="display:block;margin-top:20px;padding-top:18px;border-top:1px solid var(--color-divider);font-size:12px" class="muted-2">예상 절차</span>
    <span style="display:block;font-size:13.5px;line-height:1.7;margin-top:6px">${esc(chain())}</span>
    <span style="display:block;margin-top:16px;font-size:12.5px" class="muted-2">예상 소요 ${esc(eta())} · 총액은 담당자 확인 후 고정</span>
    ${extra}
  </div>`;
}

/** 이름·연락처 입력 묶음. 저장되는 개인정보는 이 네 칸이 전부다. */
function contactFields() {
  return `<div class="field-grid">
    <span class="field"><label for="f-name">이름 <span class="req">*</span></label>
      <input class="input" id="f-name" type="text" autocomplete="name" placeholder="홍길동"
             data-field="name" value="${esc(state.name)}"></span>
    <span class="field"><label for="f-phone">연락처 <span class="req">*</span></label>
      <input class="input" id="f-phone" type="tel" autocomplete="tel" placeholder="010-0000-0000"
             data-field="phone" value="${esc(state.phone)}"></span>
    <span class="field"><label for="f-email">이메일</label>
      <input class="input" id="f-email" type="email" autocomplete="email" placeholder="선택 · 견적서 받을 주소"
             data-field="email" value="${esc(state.email)}"></span>
    <span class="field" style="grid-column:1/-1"><label for="f-memo">추가 요청사항</label>
      <input class="input" id="f-memo" type="text" placeholder="선택 · 부수, 희망 수령일, 제출 기관 등"
             data-field="memo" value="${esc(state.memo)}"></span>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 화면 — 랜딩
// ═══════════════════════════════════════════════════════════════════════════

function screenHome() {
  const heroA = `<section class="hero">
    <div class="hero-blob"></div>
    <div class="hero-inner">
      <div>
        <span class="kicker">번역 · 공증 · 아포스티유 · 대사관 인증</span>
        <h1>국가 간 서류,<br>원스톱으로.</h1>
        <p>${esc(INTRO)}</p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" style="font-size:15px;padding:12px 24px" data-go="apply">서류 견적 받기</button>
          <button type="button" class="btn btn-secondary" style="font-size:15px;padding:12px 22px" data-go="track">접수 진행상황 조회</button>
        </div>
      </div>
      <div class="card elev-md" style="padding:26px 28px;background:var(--color-surface)">
        <span class="card-kicker">30초 견적 시작</span>
        <h3 style="font-size:22px;margin:2px 0 0">어느 나라에 제출하나요?</h3>
        <div style="margin-top:14px">${chips('country', COUNTRIES)}</div>
        ${otherField('country')}
        <p style="font-size:12.5px;margin:18px 0 0" class="muted-2">선택: <span data-live="country">${esc(picked('country') || '선택 전')}</span> · 다음 단계에서 서류 종류와 인증 방식을 고릅니다.</p>
        <button type="button" class="btn btn-primary btn-block" style="font-size:14.5px;padding:12px" data-go="apply">신청 계속하기</button>
      </div>
    </div>
  </section>`;

  const heroB = `<section class="hero">
    <div class="hero-blob" style="left:-120px;right:auto;bottom:-220px;top:auto;background:var(--color-accent-100)"></div>
    <div style="position:relative">
      <h1 style="font-size:60px;max-width:24ch">서류 하나로<br>막히는 일은<br>없어야 합니다.</h1>
      <p style="max-width:56ch;font-size:17px">${esc(INTRO)}</p>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" style="font-size:15px;padding:12px 24px" data-go="apply">견적·상담 신청</button>
        <button type="button" class="btn btn-ghost" style="font-size:15px" data-go="service">서비스 안내 보기</button>
      </div>
    </div>
  </section>`;

  return `
  ${state.layout === 'a' ? heroA : heroB}

  <section class="sect">
    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <h4 style="font-size:15px;margin:0" class="muted-2">숫자로 보는 처리 역량</h4>
      <span class="tag tag-neutral">제휴 법무법인 수 · 평균 처리일은 확정 후 교체</span>
    </div>
    <div class="trust-grid">
      ${TRUST.map((t) => `<div class="card" style="padding:20px 22px;background:var(--color-neutral-100);gap:6px">
        <span class="trust-num">${esc(t.num)}</span>
        <span class="trust-label">${esc(t.label)}</span>
        <span class="trust-note">${esc(t.note)}</span>
      </div>`).join('')}
    </div>
  </section>

  <section class="sect grid">
    <div class="card" style="padding:32px 34px;background:var(--color-accent-2-100)">
      <span class="card-kicker" style="color:var(--color-accent-2-800)">개인 · B2C</span>
      <h2 style="font-size:27px;margin:8px 0 0">개인 (B2C)</h2>
      <p style="font-size:14.5px;line-height:1.8;margin:12px 0 0">${esc(B2C)}</p>
      <button type="button" class="btn btn-primary" style="align-self:flex-start;margin-top:20px;font-size:14px;padding:10px 20px" data-go="apply">개인 서류 신청</button>
    </div>
    <div class="card" style="padding:32px 34px;background:var(--color-accent-100)">
      <span class="card-kicker">기업 · B2B / B2G</span>
      <h2 style="font-size:27px;margin:8px 0 0">기업 (B2B / B2G)</h2>
      <p style="font-size:14.5px;line-height:1.8;margin:12px 0 0">${esc(B2B)}</p>
      <button type="button" class="btn btn-secondary" style="align-self:flex-start;margin-top:20px;font-size:14px;padding:10px 20px" data-go="service">기업 서류 안내</button>
    </div>
  </section>

  <section class="sect">
    <h2 style="font-size:28px;margin:0 0 22px">처리 절차</h2>
    <div class="steps">
      ${PROCESS.map((s) => `<div class="step">
        <span class="step-no">${esc(s.no)}</span>
        <span><span class="step-title">${esc(s.title)}</span><span class="step-body">${esc(s.body)}</span></span>
      </div>`).join('')}
    </div>
  </section>

  <section class="sect">
    <div class="cta-band">
      <div>
        <h3 style="font-size:26px;margin:0">국가와 서류만 알려주시면 견적을 드립니다</h3>
        <p style="font-size:14.5px;line-height:1.75;margin:12px 0 0;max-width:44ch">제출 국가·서류 종류·희망 일정에 따라 절차와 비용을 사전에 고정해 안내합니다.</p>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary" style="font-size:15px;padding:13px 26px" data-go="apply">견적·상담 신청</button>
      </div>
    </div>
  </section>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 화면 — 서비스 안내
// ═══════════════════════════════════════════════════════════════════════════

function screenService() {
  return `
  <section class="sect-top">
    <span class="kicker" style="margin-bottom:14px">서비스 안내</span>
    <h1 style="font-size:42px;line-height:1.16;margin:0">무엇을, 어디까지 처리하나요</h1>
    <p class="lead" style="margin:20px 0 0">번역부터 법무법인 공증 촉탁, 아포스티유와 각국 대사관 인증, 발송까지 한 창구에서 진행합니다. 서류가 도착해야 하는 기관과 국가를 기준으로 절차를 설계합니다.</p>
  </section>

  <section class="sect grid">
    <div class="card" style="padding:30px 32px;background:var(--color-accent-2-100)">
      <span class="card-kicker" style="color:var(--color-accent-2-800)">개인 · B2C</span>
      <h2 style="font-size:24px;margin:8px 0 0">개인 (B2C)</h2>
      <p style="font-size:14.5px;line-height:1.8;margin:12px 0 0">${esc(B2C)}</p>
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:18px">
        ${['부모여행동의서', '유학 구비서류', '이민 서류', '비자·체류'].map((t) => `<span class="tag tag-accent-2">${esc(t)}</span>`).join('')}
      </div>
    </div>
    <div class="card" style="padding:30px 32px;background:var(--color-accent-100)">
      <span class="card-kicker">기업 · B2B / B2G</span>
      <h2 style="font-size:24px;margin:8px 0 0">기업 (B2B / B2G)</h2>
      <p style="font-size:14.5px;line-height:1.8;margin:12px 0 0">${esc(B2B)}</p>
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:18px">
        ${['정관', '계약서', '위임장(POA)', '특허', '경력 서류'].map((t) => `<span class="tag tag-accent">${esc(t)}</span>`).join('')}
      </div>
    </div>
  </section>

  <section class="sect">
    <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <h2 style="font-size:26px;margin:0">비용 안내</h2>
      <span class="tag tag-neutral">금액 미확정 — 확정 후 교체</span>
    </div>
    <div class="table-scroll">
      <table class="table">
        <thead><tr><th>항목</th><th>포함 범위</th><th>소요</th><th style="text-align:right">기준 금액</th></tr></thead>
        <tbody>
          ${PRICES.map((p) => `<tr>
            <td style="font-weight:600">${esc(p.item)}</td>
            <td class="muted">${esc(p.scope)}</td>
            <td>${esc(p.days)}</td>
            <td style="text-align:right">${esc(p.cost)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p style="font-size:12.5px;margin:16px 0 0" class="muted-2">서류 종류·제출 국가·부수에 따라 달라집니다. 신청 시 절차와 총액을 사전에 고정해 안내합니다.</p>
  </section>

  <section class="sect">
    <button type="button" class="btn btn-primary" style="font-size:15px;padding:13px 26px" data-go="apply">내 서류로 견적 받기</button>
  </section>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 화면 — 견적·상담 신청
// ═══════════════════════════════════════════════════════════════════════════

/** 제출 완료 화면. 접수번호는 Supabase 가 발급한 실제 번호다. */
function screenDone() {
  return `<div class="sect" style="padding-top:30px">
    <div class="card elev-md" style="padding:40px 44px;background:var(--color-surface);max-width:640px">
      <span class="ok-mark">✓</span>
      <h2 style="font-size:28px;margin:16px 0 0">상담 신청이 접수되었습니다</h2>
      <p style="font-size:14.5px;line-height:1.8;margin:10px 0 0">담당자가 영업일 기준 1일 안에 절차와 총액을 확정해 연락드립니다. 접수번호를 보관해 주세요.</p>
      <div class="order-pill">
        <span style="font-size:12px" class="muted-2">접수번호</span>
        <span class="order-no">${esc(state.orderNo)}</span>
      </div>
      <div class="btn-row" style="margin-top:22px">
        <button type="button" class="btn btn-primary" style="font-size:14.5px;padding:11px 22px" data-track-mine="1">진행상황 조회</button>
        <button type="button" class="btn btn-secondary" style="font-size:14.5px;padding:11px 22px" data-reset="1">새 신청 작성</button>
        <button type="button" class="btn btn-ghost" style="font-size:14.5px" data-go="home">처음으로</button>
      </div>
    </div>
  </div>`;
}

const STEP_DEFS = [
  { pill: '국가', title: '제출 국가를 고르세요', hint: '서류를 최종 제출하는 국가 기준입니다.' },
  { pill: '서류', title: '어떤 서류인가요?', hint: '여러 건이면 대표 서류를 먼저 고르고 나머지는 상담에서 추가합니다.' },
  { pill: '인증', title: '인증 방식', hint: '제출 기관 요구에 따라 달라집니다. 모르면 그대로 두고 넘어가세요.' },
  { pill: '연락처', title: '어디로 연락드릴까요?', hint: '견적과 진행 안내를 받을 이름과 연락처입니다.' },
];

/** 현재 단계에서 막고 있는 것. 없으면 null.
 *  '기타' 를 골라 둔 상태라면 "선택해 주세요" 가 아니라 "이름을 입력해 주세요" 여야 한다. */
function stepProblem(step) {
  if (step === 1) return state.country ? otherProblem('country') : '제출 국가를 선택해 주세요.';
  if (step === 2) return state.doc ? otherProblem('doc') : '서류 종류를 선택해 주세요.';
  if (step === 3) return null;
  return validate();
}

const stepReady = (step) => stepProblem(step) === null;

/** 위저드 버튼 문구. render 와 syncLive 가 같은 값을 쓰도록 한 곳에 둔다. */
function stepButtonLabel(step) {
  if (state.sending) return '보내는 중…';
  const ok = stepReady(step);
  if (step === STEP_COUNT) return ok ? '상담 신청 보내기' : '이름과 연락처를 입력해 주세요';
  if (ok) return '다음';
  const key = step === 1 ? 'country' : step === 2 ? 'doc' : null;
  if (key && state[key] === OTHER) return `${OTHER_FIELDS[key].이름} 이름을 입력해 주세요`;
  return '선택해 주세요';
}

function screenApplyStep() {
  const step = Math.min(Math.max(state.step, 1), STEP_COUNT);
  const def = STEP_DEFS[step - 1];
  const ok = stepReady(step);

  const body = step === 1 ? chips('country', COUNTRIES) + otherField('country')
    : step === 2 ? chips('doc', DOCS) + otherField('doc')
    : step === 3 ? chips('cert', CERTS)
    : contactFields();

  const nextLabel = stepButtonLabel(step);

  return `<div class="sect" style="padding-top:30px">
    <h1 style="font-size:36px;margin:0 0 6px">견적·상담 신청</h1>
    <p style="font-size:14.5px;margin:0 0 26px" class="muted">국가와 서류 종류를 고르면 절차와 예상 일정을 바로 확인할 수 있습니다.</p>
    ${configBanner()}${errorBanner()}
    <div class="two-col">
      <div>
        <div style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap">
          ${STEP_DEFS.map((d, i) => `<span class="tag ${i + 1 === step ? 'tag-accent' : 'tag-neutral'}" style="padding:6px 14px;font-size:12px">${i + 1}. ${esc(d.pill)}</span>`).join('')}
        </div>
        <h2 style="font-size:26px;margin:0">${esc(def.title)}</h2>
        <p style="font-size:13.5px;margin:8px 0 20px" class="muted">${esc(def.hint)}</p>
        ${body}
        <div class="btn-row" style="margin-top:32px">
          <button type="button" class="btn btn-secondary" style="font-size:14px;padding:11px 20px" data-step="prev" ${step === 1 ? 'disabled' : ''}>이전</button>
          <button type="button" class="btn ${ok && !state.sending ? 'btn-primary' : 'btn-secondary'}" style="font-size:14px;padding:11px 24px"
                  data-step="next" ${state.sending ? 'disabled' : ''}>${esc(nextLabel)}</button>
        </div>
      </div>
      ${summaryCard()}
    </div>
  </div>`;
}

function screenApplySingle() {
  const ok = validate() === null;
  return `<div class="sect" style="padding-top:30px">
    <h1 style="font-size:36px;margin:0 0 6px">견적·상담 신청</h1>
    <p style="font-size:14.5px;margin:0 0 26px" class="muted">국가와 서류 종류를 고르면 절차와 예상 일정을 바로 확인할 수 있습니다.</p>
    ${configBanner()}${errorBanner()}
    <div class="two-col">
      <div style="display:grid;gap:28px">
        <div><h3 style="font-size:19px;margin:0 0 12px">제출 국가 <span class="req">*</span></h3>${chips('country', COUNTRIES)}${otherField('country')}</div>
        <div><h3 style="font-size:19px;margin:0 0 12px">서류 종류 <span class="req">*</span></h3>${chips('doc', DOCS)}${otherField('doc')}</div>
        <div><h3 style="font-size:19px;margin:0 0 12px">인증 방식</h3>${chips('cert', CERTS)}</div>
        <div><h3 style="font-size:19px;margin:0 0 12px">신청자 정보</h3>${contactFields()}</div>
      </div>
      ${summaryCard(`<button type="button" class="btn btn-block ${ok && !state.sending ? 'btn-primary' : 'btn-secondary'}"
        style="font-size:14.5px;padding:12px;margin-top:20px" data-submit="1" ${state.sending ? 'disabled' : ''}>${
          state.sending ? '보내는 중…' : ok ? '상담 신청 보내기' : '국가·서류·연락처를 채워 주세요'
        }</button>`)}
    </div>
  </div>`;
}

function screenApply() {
  if (state.orderNo) return screenDone();
  return state.flow === 'single' ? screenApplySingle() : screenApplyStep();
}

// ═══════════════════════════════════════════════════════════════════════════
// 화면 — 진행상황 조회 (휴대폰 번호로 본인 확인)
// ═══════════════════════════════════════════════════════════════════════════

/** 진행 단계. 관리자가 이 순서로 상태를 넘긴다 (schema.sql 8번의 값과 같아야 한다). */
const STAGES = ['접수', '번역', '공증', '인증', '발송'];

/** 단계 이름을 고객이 읽을 문구로. 인증 단계는 신청한 인증 방식을 그대로 보여 준다. */
function stageLabel(stage, certType) {
  return {
    접수: '접수',
    번역: '전문 번역',
    공증: '법무법인 공증',
    인증: certType || '아포스티유 · 대사관 인증',
    발송: '발송',
  }[stage] ?? stage;
}

/** 지금 몇 번째 단계인지. '완료' 는 전 단계 통과로 본다. */
function stageIndex(status) {
  if (status === '완료') return STAGES.length;
  const i = STAGES.indexOf(status);
  return i < 0 ? 0 : i;
}

async function lookupTracking() {
  const digits = state.trackPhone.replace(/[^0-9]/g, '');
  if (digits.length < 9) {
    set({ trackError: '휴대폰 번호를 정확히 입력해 주세요.', trackRows: null });
    return;
  }
  if (configMissing()) {
    set({ trackError: 'Supabase 연결 설정이 아직 비어 있습니다.', trackRows: null });
    return;
  }

  set({ trackLoading: true, trackError: null });
  try {
    const res = await fetch(`${cfg.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/track_applications`, {
      method: 'POST',
      headers: {
        apikey: cfg.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_phone: state.trackPhone.trim() }),
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const b = await res.json();
        detail = b.message || b.hint || detail;
      } catch { /* JSON 이 아니면 상태 코드만 */ }
      throw new Error(detail);
    }
    set({ trackLoading: false, trackRows: await res.json(), trackError: null });
  } catch (e) {
    set({ trackLoading: false, trackRows: null, trackError: `조회하지 못했습니다. ${e.message}` });
  }
}

/** 2026-09-08T05:12:34Z → 9월 8일 (한국 시간) */
function dayText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' });
}

/** 신청 한 건의 진행 카드. */
function trackCard(row) {
  const cancelled = row.status === '취소';
  const cur = stageIndex(row.status);
  const done = row.status === '완료';

  const timeline = STAGES.map((stage, i) => {
    const state_ = cancelled ? 'off' : i < cur ? 'done' : i === cur ? 'now' : 'off';
    const bar = state_ === 'done' ? 'var(--color-accent-2-500)'
      : state_ === 'now' ? 'var(--color-accent-500)'
      : 'var(--color-neutral-300)';
    const tag = state_ === 'done' ? ['완료', 'tag-accent-2']
      : state_ === 'now' ? ['진행중', 'tag-accent']
      : ['대기', 'tag-outline'];
    return `<div class="tl-item">
      <span class="tl-bar" style="background:${bar}"></span>
      <span class="tl-label">${esc(stageLabel(stage, row.cert_type))}</span>
      <span class="tag ${tag[1]}" style="align-self:flex-start;font-size:11px">${tag[0]}</span>
    </div>`;
  }).join('');

  const badge = cancelled ? ['취소', 'tag-neutral']
    : done ? ['발송 완료', 'tag-accent-2']
    : ['진행중', 'tag-accent'];

  return `<div class="card" style="padding:28px 30px;background:var(--color-surface);margin-top:20px">
    <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
      <h2 style="font-size:22px;margin:0;font-family:ui-monospace,Menlo,monospace">${esc(row.order_no)}</h2>
      <span class="tag ${badge[1]}">${badge[0]}</span>
      <span style="font-size:12.5px" class="muted-2">${esc(row.name_masked)}님 · ${esc(dayText(row.created_at))} 접수</span>
    </div>
    <div style="display:grid;gap:10px;margin-top:18px;max-width:420px">
      <span class="summary-row"><span class="summary-key">제출 국가</span><span class="summary-val">${esc(row.country)}</span></span>
      <span class="summary-row"><span class="summary-key">서류 종류</span><span class="summary-val">${esc(row.doc_type)}</span></span>
      <span class="summary-row"><span class="summary-key">인증 방식</span><span class="summary-val">${esc(row.cert_type)}</span></span>
    </div>
    ${cancelled
      ? '<p style="margin:22px 0 0;font-size:13.5px" class="muted">취소된 신청입니다. 문의가 필요하면 담당자에게 연락해 주세요.</p>'
      : `<div class="timeline">${timeline}</div>`}
  </div>`;
}

function screenTrack() {
  const rows = state.trackRows;

  let result = '';
  if (state.trackLoading) {
    result = '<p style="margin-top:30px;font-size:14px" class="muted-2">조회하는 중…</p>';
  } else if (rows === null) {
    // 오류 배너가 이미 떠 있으면 같은 자리에 안내문을 또 붙이지 않는다
    result = state.trackError ? ''
      : '<p style="margin-top:30px;font-size:14px" class="muted-2">신청 시 남긴 휴대폰 번호를 입력하고 조회를 누르면 진행상황이 표시됩니다.</p>';
  } else if (rows.length === 0) {
    result = banner('warn', '일치하는 신청이 없습니다',
      '입력한 번호로 접수된 신청을 찾지 못했습니다. 번호를 다시 확인해 주시고, 계속 보이지 않으면 담당자에게 문의해 주세요.');
  } else {
    result = `<p style="margin:30px 0 0;font-size:13.5px" class="muted">신청 ${rows.length}건</p>`
      + rows.map(trackCard).join('');
  }

  return `<div class="sect" style="padding-top:30px">
    <h1 style="font-size:36px;margin:0 0 6px">접수 진행상황 조회</h1>
    <p style="font-size:14.5px;margin:0 0 22px" class="muted">신청할 때 남긴 <strong>휴대폰 번호</strong>를 입력하세요. 그 번호로 접수된 신청이 모두 표시됩니다.</p>
    ${state.trackError ? banner('error', '확인이 필요합니다', esc(state.trackError)) : ''}
    <div class="track-row">
      <input class="input track-input" type="tel" inputmode="tel" autocomplete="tel"
             placeholder="010-0000-0000" data-field="trackPhone" value="${esc(state.trackPhone)}">
      <button type="button" class="btn btn-primary" style="font-size:14.5px;padding:12px 24px" data-track="1"
              ${state.trackLoading ? 'disabled' : ''}>${state.trackLoading ? '조회 중…' : '조회'}</button>
    </div>
    <p style="margin:14px 0 0;font-size:12px" class="muted-2">접수번호는 필요하지 않습니다. 접수번호만으로 조회하게 두면 다른 사람의 진행상황이 노출될 수 있어, 본인 확인이 되는 휴대폰 번호로 조회합니다.</p>
    ${result}
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 렌더 · 이벤트
// ═══════════════════════════════════════════════════════════════════════════

const app = document.getElementById('app');

function render() {
  const screens = { home: screenHome, service: screenService, apply: screenApply, track: screenTrack };
  app.innerHTML = previewBar() + (screens[state.screen] || screenHome)();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go],[data-pick],[data-set],[data-step],[data-submit],[data-reset],[data-track],[data-track-mine]');
  if (!t) return;

  if (t.dataset.go) {
    const to = t.dataset.go;
    set({
      screen: to, error: null,
      ...(to === 'apply' ? { orderNo: null } : {}),
      ...(to === 'track' ? { trackRows: null, trackError: null } : {}),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (t.dataset.pick) {
    set({ [t.dataset.pick]: t.dataset.val, error: null });
    // '기타' 를 골랐으면 바로 적을 수 있게 커서를 넣어 준다
    if (t.dataset.val === OTHER && OTHER_FIELDS[t.dataset.pick]) {
      document.getElementById('f-other-' + t.dataset.pick)?.focus();
    }
    return;
  }
  if (t.dataset.set) { set({ [t.dataset.set]: t.dataset.val }); return; }
  if (t.dataset.reset) {
    set({ orderNo: null, error: null, step: 1, country: null, countryOther: '',
          doc: null, docOther: '', cert: '아포스티유',
          name: '', phone: '', email: '', memo: '' });
    return;
  }
  if (t.dataset.submit) { submit(); return; }
  if (t.dataset.trackMine) {
    // 방금 신청한 본인이므로 남긴 번호를 그대로 채워 조회한다
    set({ screen: 'track', trackPhone: state.phone, trackRows: null, trackError: null });
    lookupTracking();
    return;
  }
  if (t.dataset.track) { lookupTracking(); return; }

  if (t.dataset.step === 'prev') { set({ step: Math.max(1, state.step - 1), error: null }); return; }
  if (t.dataset.step === 'next') {
    if (state.step === STEP_COUNT) { submit(); return; }
    const problem = stepProblem(state.step);
    if (problem) { set({ error: problem }); }
    else { set({ step: state.step + 1, error: null }); }
  }
});

/** 입력 중에는 화면을 다시 그리지 않으므로(커서와 한글 조합이 끊긴다), 값에 따라
 *  달라지는 부분만 직접 손본다 — 요약에 표시된 국가 이름과 진행 버튼. */
function syncLive() {
  // '기타' 로 직접 적는 국가 이름은 요약과 안내문에 바로 비친다
  ['country', 'doc'].forEach((key) => {
    document.querySelectorAll(`[data-live="${key}"]`).forEach((el) => {
      el.textContent = picked(key) || '선택 전';
    });
  });

  if (state.screen !== 'apply' || state.orderNo || state.sending) return;

  const single = state.flow === 'single';
  const btn = document.querySelector(single ? '[data-submit]' : '[data-step="next"]');
  if (!btn) return;

  const ok = single ? validate() === null : stepReady(state.step);
  btn.classList.toggle('btn-primary', ok);
  btn.classList.toggle('btn-secondary', !ok);
  btn.textContent = single
    ? (ok ? '상담 신청 보내기' : '국가·서류·연락처를 채워 주세요')
    : stepButtonLabel(state.step);
}

// 입력창은 다시 그리지 않고 상태만 받아 둔다.
document.addEventListener('input', (e) => {
  const f = e.target.dataset && e.target.dataset.field;
  if (!f) return;
  setQuiet({ [f]: e.target.value });
  syncLive();
});

// 연락처 칸에서 Enter 를 누르면 바로 제출한다.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const f = e.target.dataset && e.target.dataset.field;
  if (!f) return;
  if (f === 'trackPhone') { lookupTracking(); return; }
  if (state.screen !== 'apply' || state.sending) return;
  e.preventDefault();
  // 국가 입력칸에서 Enter 는 제출이 아니라 다음 단계로
  if ((f === 'countryOther' || f === 'docOther') && state.flow !== 'single') {
    if (stepReady(state.step)) set({ step: Math.min(state.step + 1, STEP_COUNT), error: null });
    return;
  }
  submit();
});

render();
