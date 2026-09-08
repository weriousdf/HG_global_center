// ---------------------------------------------------------------------------
// Supabase 연결 설정
//
// Supabase 대시보드 > Project Settings > API 에서 두 값을 복사해 아래에 넣으세요.
//   1) Project URL              → SUPABASE_URL
//   2) Project API keys 의 anon (public) 키 → SUPABASE_ANON_KEY
//
// anon 키는 브라우저에 공개되도록 설계된 키입니다. 이 파일은 커밋해도 됩니다.
// ⚠️ service_role 키는 절대 여기에 넣지 마세요. 그 키는 모든 데이터를 읽고 지울 수
//    있어서, 웹페이지에 넣는 순간 누구나 신청서 전체를 볼 수 있게 됩니다.
// ---------------------------------------------------------------------------
window.HG_CONFIG = {
  SUPABASE_URL: 'https://여기에-프로젝트-URL.supabase.co',
  SUPABASE_ANON_KEY: '여기에-anon-public-키',
};
