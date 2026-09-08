/* 접수 관리 화면 — 관리자가 로그인해 신청서를 보는 페이지.
 *
 * 권한은 전부 서버(Supabase)가 판단한다. 이 파일은 화면만 그린다.
 * 브라우저 JavaScript 에서 키를 비교하는 방식은 소스를 열면 그대로 보이므로 쓰지 않는다.
 *
 *   1) 이메일·비밀번호로 Supabase 인증에 로그인해 access token(JWT)을 받는다.
 *   2) 그 토큰으로 applications 를 조회한다.
 *   3) 서버는 RLS 정책으로 "admins 표에 있는 계정" 인지 확인한다 (is_admin()).
 *      로그인만 했고 명단에 없으면 조회 결과가 0건으로 온다 — 오류가 아니라 빈 목록.
 */

const cfg = window.HG_CONFIG || {};
const SESSION_KEY = 'hg_admin_session';

function configMissing() {
  const u = cfg.SUPABASE_URL || '';
  const k = cfg.SUPABASE_ANON_KEY || '';
  return !u || !k || u.includes('여기에') || k.includes('여기에');
}

const base = () => (cfg.SUPABASE_URL || '').replace(/\/$/, '');

const state = {
  session: null,      // { access_token, refresh_token, expires_at, email }
  rows: null,         // 신청서 목록. null 이면 아직 안 불러온 상태
  loading: false,
  error: null,
  notice: null,
  search: '',
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ═══════════════════════════════════════════════════════════════════════════
// 세션 보관 — 새로 고쳐도 로그인이 유지되도록
// ═══════════════════════════════════════════════════════════════════════════

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }   // 시크릿 창 등에서 접근 자체가 막히는 경우
}

function saveSession(s) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* 저장이 막혀도 이번 세션 동안은 메모리로 동작한다 */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// Supabase 인증 · 조회
// ═══════════════════════════════════════════════════════════════════════════

/** 인증 응답에서 오류 문구를 최대한 사람이 읽을 수 있게 뽑아낸다. */
async function authError(res) {
  try {
    const b = await res.json();
    const msg = b.error_description || b.msg || b.message || b.error || '';
    if (/invalid login credentials/i.test(msg)) return '이메일 또는 비밀번호가 맞지 않습니다.';
    if (/email not confirmed/i.test(msg)) return '이메일 확인이 끝나지 않은 계정입니다. 대시보드에서 Auto Confirm 으로 계정을 만들어 주세요.';
    return msg || `로그인 실패 (HTTP ${res.status})`;
  } catch {
    return `로그인 실패 (HTTP ${res.status})`;
  }
}

async function signIn(email, password) {
  const res = await fetch(`${base()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: cfg.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await authError(res));

  const b = await res.json();
  return {
    access_token: b.access_token,
    refresh_token: b.refresh_token,
    expires_at: b.expires_at ?? (Math.floor(Date.now() / 1000) + (b.expires_in ?? 3600)),
    email: b.user?.email ?? email,
  };
}

/** 만료가 가까우면 토큰을 갱신한다. 실패하면 null (다시 로그인해야 함). */
async function refreshIfNeeded(session) {
  const soon = Math.floor(Date.now() / 1000) + 60;
  if (session.expires_at > soon) return session;

  const res = await fetch(`${base()}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: cfg.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) return null;

  const b = await res.json();
  return {
    access_token: b.access_token,
    refresh_token: b.refresh_token,
    expires_at: b.expires_at ?? (Math.floor(Date.now() / 1000) + (b.expires_in ?? 3600)),
    email: b.user?.email ?? session.email,
  };
}

async function fetchApplications() {
  const fresh = await refreshIfNeeded(state.session);
  if (!fresh) {
    signOut('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    return null;
  }
  if (fresh !== state.session) { state.session = fresh; saveSession(fresh); }

  const url = `${base()}/rest/v1/applications`
    + '?select=order_no,created_at,name,phone,email,country,doc_type,cert_type,memo,status'
    + '&order=created_at.desc';

  const res = await fetch(url, {
    headers: {
      apikey: cfg.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${state.session.access_token}`,
    },
  });

  if (res.status === 401) {
    signOut('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    return null;
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      detail = b.message || b.hint || detail;
    } catch { /* 본문이 JSON 이 아니면 상태 코드만 */ }
    throw new Error(detail);
  }

  return await res.json();
}

function signOut(notice = null) {
  state.session = null;
  state.rows = null;
  state.error = null;
  state.notice = notice;
  saveSession(null);
  render();
}

// ═══════════════════════════════════════════════════════════════════════════
// 표시용 가공
// ═══════════════════════════════════════════════════════════════════════════

/** 2026-09-08T05:12:34Z → 09/08 14:12 (한국 시간) */
function whenText(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ?? '';
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** 검색어가 걸리는 행인지. 이름·연락처·접수번호·국가·서류를 함께 본다. */
function matches(row, q) {
  if (!q) return true;
  const hay = [row.order_no, row.name, row.phone, row.email, row.country, row.doc_type, row.memo]
    .filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}

function toCsv(rows) {
  const head = ['접수번호', '접수일시', '이름', '연락처', '이메일', '제출국가', '서류종류', '인증방식', '상태', '요청사항'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.map(cell).join(',')];
  rows.forEach((r) => lines.push([
    r.order_no, r.created_at, r.name, r.phone, r.email,
    r.country, r.doc_type, r.cert_type, r.status, r.memo,
  ].map(cell).join(',')));
  // 엑셀이 UTF-8 로 열도록 BOM 을 앞에 붙인다 (없으면 한글이 깨진다)
  return '﻿' + lines.join('\r\n');
}

function downloadCsv() {
  const rows = (state.rows || []).filter((r) => matches(r, state.search));
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `한결_접수목록_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ═══════════════════════════════════════════════════════════════════════════
// 화면
// ═══════════════════════════════════════════════════════════════════════════

function banner(kind, title, body) {
  return `<div class="banner banner-${kind}" style="max-width:640px;margin:0 auto 20px">
    <span class="banner-title">${esc(title)}</span>${body}</div>`;
}

function screenLogin() {
  const cfgWarn = configMissing()
    ? banner('warn', '연결 설정 대기 중', '<code>config.js</code> 에 Supabase URL 과 키를 넣어야 로그인할 수 있습니다.')
    : '';

  return `<div class="sect" style="padding-top:20px">
    ${cfgWarn}
    ${state.error ? banner('error', '로그인할 수 없습니다', esc(state.error)) : ''}
    ${state.notice ? banner('warn', '안내', esc(state.notice)) : ''}
    <form class="card elev-md login-card" id="login-form">
      <h1>접수 관리</h1>
      <p style="font-size:13.5px;margin:0 0 20px" class="muted">등록된 관리자 계정으로 로그인하세요.</p>
      <span class="field">
        <label for="email">이메일</label>
        <input class="input" id="email" name="email" type="email" autocomplete="username" required>
      </span>
      <span class="field" style="margin-top:12px">
        <label for="password">비밀번호</label>
        <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
      </span>
      <button type="submit" class="btn btn-primary btn-block" style="margin-top:22px;padding:12px"
              ${state.loading || configMissing() ? 'disabled' : ''}>
        ${state.loading ? '확인 중…' : '로그인'}
      </button>
    </form>
  </div>`;
}

function screenList() {
  const rows = state.rows || [];
  const shown = rows.filter((r) => matches(r, state.search));

  const body = shown.length ? `<div class="table-scroll">
    <table class="table admin-table">
      <thead><tr>
        <th>접수번호</th><th>접수</th><th>이름</th><th>연락처</th><th>제출 국가</th>
        <th>서류 종류</th><th>인증</th><th>상태</th><th>요청사항</th><th>이메일</th>
      </tr></thead>
      <tbody>
        ${shown.map((r) => `<tr>
          <td class="order">${esc(r.order_no)}</td>
          <td class="when">${esc(whenText(r.created_at))}</td>
          <td style="font-weight:600">${esc(r.name)}</td>
          <td class="phone">${esc(r.phone)}</td>
          <td>${esc(r.country)}</td>
          <td>${esc(r.doc_type)}</td>
          <td>${esc(r.cert_type)}</td>
          <td><span class="tag ${r.status === '접수' ? 'tag-accent' : 'tag-neutral'}">${esc(r.status)}</span></td>
          <td class="memo">${esc(r.memo ?? '')}</td>
          <td class="when">${esc(r.email ?? '')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : `<p class="empty muted">${
    rows.length ? '검색 결과가 없습니다.'
      : '아직 접수된 신청서가 없습니다. 목록이 비어 있는데 신청서가 분명히 있다면, 이 계정이 관리자 명단(<code>admins</code>)에 등록되지 않은 것입니다 — <code>schema.sql</code> 7번을 실행해 주세요.'
  }</p>`;

  return `<div class="sect-top" style="padding-bottom:14px">
    <h1 style="font-size:32px;margin:0 0 4px">접수 목록</h1>
    <p style="font-size:13px;margin:0" class="muted">${esc(state.session.email)} 로 로그인</p>
  </div>
  ${state.error ? `<div class="sect" style="padding-bottom:0">${banner('error', '불러오지 못했습니다', esc(state.error))}</div>` : ''}
  <div class="admin-bar">
    <span class="admin-count">${shown.length}건</span>
    ${state.search ? `<span class="muted-2" style="font-size:12.5px">전체 ${rows.length}건 중</span>` : ''}
    <input class="input admin-search" type="search" id="search" placeholder="이름·연락처·접수번호 검색"
           value="${esc(state.search)}">
    <span class="spacer"></span>
    <button type="button" class="btn btn-secondary" style="font-size:13px;padding:8px 16px" id="reload"
            ${state.loading ? 'disabled' : ''}>${state.loading ? '불러오는 중…' : '새로 고침'}</button>
    <button type="button" class="btn btn-ghost" style="font-size:13px;padding:8px 14px" id="csv"
            ${shown.length ? '' : 'disabled'}>CSV 내려받기</button>
  </div>
  <div class="sect">${body}</div>`;
}

const app = document.getElementById('app');
const signoutBtn = document.getElementById('signout');

function render() {
  const loggedIn = !!state.session;
  signoutBtn.hidden = !loggedIn;
  app.innerHTML = loggedIn
    ? (state.rows === null && state.loading ? '<p class="empty muted">불러오는 중…</p>' : screenList())
    : screenLogin();
}

// ═══════════════════════════════════════════════════════════════════════════
// 동작
// ═══════════════════════════════════════════════════════════════════════════

async function load() {
  state.loading = true; state.error = null; render();
  try {
    const rows = await fetchApplications();
    if (rows) { state.rows = rows; state.error = null; }
  } catch (e) {
    state.error = e.message;
  } finally {
    state.loading = false; render();
  }
}

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'login-form') return;
  e.preventDefault();
  if (state.loading) return;

  const email = e.target.email.value.trim();
  const password = e.target.password.value;
  if (!email || !password) { state.error = '이메일과 비밀번호를 입력해 주세요.'; render(); return; }

  state.loading = true; state.error = null; state.notice = null; render();
  try {
    const session = await signIn(email, password);
    state.session = session;
    saveSession(session);
    state.loading = false;
    await load();
  } catch (err) {
    state.loading = false;
    state.error = err.message;
    render();
  }
});

document.addEventListener('click', (e) => {
  if (e.target.closest('#signout')) { signOut(); return; }
  if (e.target.closest('#reload')) { load(); return; }
  if (e.target.closest('#csv')) { downloadCsv(); }
});

// 검색은 다시 그리면 커서가 끊기므로, 행을 숨기고 건수만 갱신한다.
document.addEventListener('input', (e) => {
  if (e.target.id !== 'search') return;
  state.search = e.target.value;

  const rows = state.rows || [];
  const trs = app.querySelectorAll('.admin-table tbody tr');
  let shown = 0;
  rows.forEach((r, i) => {
    const ok = matches(r, state.search);
    if (ok) shown += 1;
    if (trs[i]) trs[i].classList.toggle('hidden', !ok);
  });

  const count = app.querySelector('.admin-count');
  if (count) count.textContent = `${shown}건`;
});

// 시작 — 저장된 세션이 있으면 바로 목록을 불러온다.
state.session = loadSession();
if (state.session) load();
else render();
