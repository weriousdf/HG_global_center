// ---------------------------------------------------------------------------
// Supabase 연결 설정
//
// 두 값은 대시보드의 서로 다른 화면에 있다 (2025년 개편 후 기준).
//
//   SUPABASE_URL
//     왼쪽 아래 Project Settings → Data API → "Project URL"
//     https://<프로젝트id>.supabase.co 형태
//
//   SUPABASE_ANON_KEY
//     Project Settings → API Keys → "Publishable key"
//     sb_publishable_... 로 시작한다. 예전 이름이 anon (public) 키였다.
//
// ⚠️ 두 값 모두 반드시 따옴표 ' ' 안에 넣어야 한다. 따옴표를 빼면 JavaScript 가
//    문자열이 아니라 변수 이름으로 읽어서 설정 전체가 만들어지지 않는다.
//
// Publishable key 는 브라우저에 공개되도록 설계된 키다. 이 파일은 커밋해도 된다.
// ⚠️ 같은 화면의 "Secret key" (sb_secret_... / 예전 service_role) 는 절대 넣지 않는다.
//    그 키는 모든 데이터를 읽고 지울 수 있어서, 웹페이지에 넣는 순간 누구나
//    신청서 전체를 볼 수 있게 된다.
// ---------------------------------------------------------------------------
window.HG_CONFIG = {
  SUPABASE_URL: 'https://wxceyxdxxsepwzvdwkur.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_KWhqjbE6t1a-NaEVIZoLzA_EGjpn5Sq',
};
