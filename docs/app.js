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

// 아포스티유 협약국 전체를 처리하므로, 칩에 없는 나라는 '기타' 로 직접 입력받는다.
const COUNTRIES = ['미국', '중국', '일본', '베트남', '캐나다', '독일', '호주', '인도네시아', '기타'];
const COUNTRY_OTHER = '기타';
const COUNTRY_MAX = 40;
const DOCS = ['부모여행동의서', '유학 구비서류', '이민 서류', '비자·체류 서류', '정관', '계약서', '위임장(POA)', '경력 서류'];
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
  trackInput: '',
  trackFound: false,
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

/** 저장·표시에 쓸 국가 이름. '기타' 를 골랐으면 직접 적은 이름을 쓴다. */
function pickedCountry() {
  if (state.country === COUNTRY_OTHER) return state.countryOther.trim();
  return state.country;
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

/** 선택·입력이 제출 가능한 상태인지. 부족하면 안내 문구를 돌려준다. */
function validate() {
  if (!state.country) return '제출 국가를 선택해 주세요.';
  if (state.country === COUNTRY_OTHER && !state.countryOther.trim()) {
    return '제출 국가 이름을 직접 입력해 주세요.';
  }
  if (state.countryOther.trim().length > COUNTRY_MAX) {
    return `국가 이름이 너무 깁니다. ${COUNTRY_MAX}자 안으로 적어 주세요.`;
  }
  if (!state.doc) return '서류 종류를 선택해 주세요.';
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
      p_country: pickedCountry(),
      p_doc_type: state.doc,
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

/** '기타' 를 골랐을 때만 나타나는 국가 직접 입력칸. */
function countryOtherField() {
  if (state.country !== COUNTRY_OTHER) return '';
  return `<span class="field" style="margin-top:14px;max-width:320px">
    <label for="f-country-other">어느 나라인가요? <span class="req">*</span></label>
    <input class="input" id="f-country-other" type="text" maxlength="${COUNTRY_MAX}"
           placeholder="예: 몽골, 카자흐스탄, 사우디아라비아"
           data-field="countryOther" value="${esc(state.countryOther)}">
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
      <span class="summary-row"><span class="summary-key">제출 국가</span><span class="summary-val" data-live="country">${esc(pickedCountry() || '선택 전')}</span></span>
      <span class="summary-row"><span class="summary-key">서류 종류</span><span class="summary-val">${esc(state.doc ?? '선택 전')}</span></span>
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
        ${countryOtherField()}
        <p style="font-size:12.5px;margin:18px 0 0" class="muted-2">선택: <span data-live="country">${esc(pickedCountry() || '선택 전')}</span> · 다음 단계에서 서류 종류와 인증 방식을 고릅니다.</p>
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

/** 현재 단계에서 다음으로 넘어갈 수 있는지. */
function stepReady(step) {
  if (step === 1) return !!pickedCountry() && pickedCountry().length <= COUNTRY_MAX;
  if (step === 2) return !!state.doc;
  if (step === 3) return true;
  return validate() === null;
}

/** 위저드 버튼 문구. render 와 syncLive 가 같은 값을 쓰도록 한 곳에 둔다. */
function stepButtonLabel(step) {
  if (state.sending) return '보내는 중…';
  const ok = stepReady(step);
  if (step === STEP_COUNT) return ok ? '상담 신청 보내기' : '이름과 연락처를 입력해 주세요';
  if (ok) return '다음';
  if (step === 1 && state.country === COUNTRY_OTHER) return '국가 이름을 입력해 주세요';
  return '선택해 주세요';
}

function screenApplyStep() {
  const step = Math.min(Math.max(state.step, 1), STEP_COUNT);
  const def = STEP_DEFS[step - 1];
  const ok = stepReady(step);

  const body = step === 1 ? chips('country', COUNTRIES) + countryOtherField()
    : step === 2 ? chips('doc', DOCS)
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
        <div><h3 style="font-size:19px;margin:0 0 12px">제출 국가 <span class="req">*</span></h3>${chips('country', COUNTRIES)}${countryOtherField()}</div>
        <div><h3 style="font-size:19px;margin:0 0 12px">서류 종류 <span class="req">*</span></h3>${chips('doc', DOCS)}</div>
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
// 화면 — 진행상황 조회 (아직 목업. 실제 조회는 다음 단계에서 붙인다)
// ═══════════════════════════════════════════════════════════════════════════

const SAMPLE_TIMELINE = [
  { label: '접수', when: '9월 2일', status: '완료', cls: 'tag-neutral' },
  { label: '전문 번역', when: '9월 3–4일', status: '완료', cls: 'tag-neutral' },
  { label: '공증 촉탁', when: '9월 5일', status: '완료', cls: 'tag-neutral' },
  { label: '아포스티유 · 대사관 인증', when: '9월 8일', status: '진행중', cls: 'tag-accent' },
  { label: '발송', when: '예정', status: '대기', cls: 'tag-outline' },
];

const SAMPLE_ROWS = [
  { doc: '졸업증명서', country: '미국', stage: '아포스티유', status: '진행중', cls: 'tag-accent' },
  { doc: '성적증명서', country: '미국', stage: '아포스티유', status: '진행중', cls: 'tag-accent' },
  { doc: '부모여행동의서', country: '미국', stage: '발송 준비', status: '완료', cls: 'tag-accent-2' },
];

function screenTrack() {
  const found = state.trackFound ? `<div style="margin-top:36px">
    <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
      <h2 style="font-size:24px;margin:0">${esc(state.trackInput.trim() || '접수번호')}</h2>
      <span class="tag tag-accent-2">진행중</span>
      <span style="font-size:12.5px" class="muted-2">유학 구비서류 3건 · 미국 제출 · 접수 9월 2일</span>
    </div>
    <div class="timeline">
      ${SAMPLE_TIMELINE.map((t) => `<div class="tl-item">
        <span class="tl-bar"></span>
        <span class="tl-label">${esc(t.label)}</span>
        <span class="tl-when">${esc(t.when)}</span>
        <span class="tag ${t.cls}" style="align-self:flex-start;font-size:11px">${esc(t.status)}</span>
      </div>`).join('')}
    </div>
    <div style="margin-top:38px">
      <h3 style="font-size:19px;margin:0 0 12px">서류별 상태</h3>
      <div class="table-scroll">
        <table class="table">
          <thead><tr><th>서류</th><th>제출 국가</th><th>현재 단계</th><th>상태</th></tr></thead>
          <tbody>
            ${SAMPLE_ROWS.map((r) => `<tr>
              <td style="font-weight:600">${esc(r.doc)}</td>
              <td>${esc(r.country)}</td>
              <td class="muted">${esc(r.stage)}</td>
              <td><span class="tag ${r.cls}">${esc(r.status)}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>` : '<p style="margin-top:30px;font-size:14px" class="muted-2">접수번호를 입력하고 조회를 누르면 단계별 진행상황이 표시됩니다.</p>';

  return `<div class="sect" style="padding-top:30px">
    <h1 style="font-size:36px;margin:0 0 6px">접수 진행상황 조회</h1>
    <p style="font-size:14.5px;margin:0 0 22px" class="muted">신청 시 발급된 접수번호를 입력하세요.</p>
    ${banner('warn', '준비 중인 화면',
      '조회 기능은 아직 연결되지 않았습니다. 아래에 보이는 단계와 서류 목록은 화면 확인용 예시이며, 실제 접수 상태가 아닙니다. 진행 문의는 담당자에게 직접 연락해 주세요.')}
    <div class="track-row">
      <input class="input track-input" type="text" placeholder="예: HG-2609-0001" data-field="trackInput" value="${esc(state.trackInput)}">
      <button type="button" class="btn btn-primary" style="font-size:14.5px;padding:12px 24px" data-track="1">조회</button>
    </div>
    ${found}
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
  const t = e.target.closest('[data-go],[data-pick],[data-set],[data-step],[data-submit],[data-reset],[data-track]');
  if (!t) return;

  if (t.dataset.go) {
    const to = t.dataset.go;
    set({ screen: to, error: null, ...(to === 'apply' ? { orderNo: null } : {}) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (t.dataset.pick) {
    set({ [t.dataset.pick]: t.dataset.val, error: null });
    // '기타' 를 골랐으면 바로 적을 수 있게 커서를 넣어 준다
    if (t.dataset.pick === 'country' && t.dataset.val === COUNTRY_OTHER) {
      document.getElementById('f-country-other')?.focus();
    }
    return;
  }
  if (t.dataset.set) { set({ [t.dataset.set]: t.dataset.val }); return; }
  if (t.dataset.reset) {
    set({ orderNo: null, error: null, step: 1, country: null, countryOther: '', doc: null,
          cert: '아포스티유', name: '', phone: '', email: '', memo: '' });
    return;
  }
  if (t.dataset.submit) { submit(); return; }
  if (t.dataset.track) { set({ trackFound: true }); return; }

  if (t.dataset.step === 'prev') { set({ step: Math.max(1, state.step - 1), error: null }); return; }
  if (t.dataset.step === 'next') {
    if (state.step === STEP_COUNT) { submit(); return; }
    if (stepReady(state.step)) { set({ step: state.step + 1, error: null }); }
    else { set({ error: state.step === 1 ? '제출 국가를 선택해 주세요.' : '서류 종류를 선택해 주세요.' }); }
  }
});

/** 입력 중에는 화면을 다시 그리지 않으므로(커서와 한글 조합이 끊긴다), 값에 따라
 *  달라지는 부분만 직접 손본다 — 요약에 표시된 국가 이름과 진행 버튼. */
function syncLive() {
  // '기타' 로 직접 적는 국가 이름은 요약과 안내문에 바로 비친다
  document.querySelectorAll('[data-live="country"]').forEach((el) => {
    el.textContent = pickedCountry() || '선택 전';
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
  if (f === 'trackInput') { set({ trackFound: true }); return; }
  if (state.screen !== 'apply' || state.sending) return;
  e.preventDefault();
  // 국가 입력칸에서 Enter 는 제출이 아니라 다음 단계로
  if (f === 'countryOther' && state.flow !== 'single') {
    if (stepReady(state.step)) set({ step: Math.min(state.step + 1, STEP_COUNT), error: null });
    return;
  }
  submit();
});

render();
