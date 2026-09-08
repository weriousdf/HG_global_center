// ---------------------------------------------------------------------------
// Supabase 연결 설정
//
// 두 값은 대시보드의 서로 다른 화면에 있다 (2025년 개편 후 기준).
//
//   SUPABASE_ANON_KEY
//     Project Settings → API → "Publishable key" (sb_publishable_... 로 시작)
//     예전 이름은 anon (public) 키였다.
//
//   SUPABASE_URL
//     주의: 위의 API 페이지에는 URL 이 없다. 주소창에서 만드는 게 가장 확실하다.
//     대시보드 주소 .../dashboard/project/<프로젝트ref> 의 <프로젝트ref> 를 떼어내
//     https://<프로젝트ref>.supabase.co 로 만든다.
//     (라벨로 보고 싶으면 Project Settings → Data API 페이지에 있다.)
//
// ⚠️ 두 값 모두 반드시 따옴표 ' ' 안에 넣어야 한다. 따옴표를 빼면 JavaScript 가
//    문자열이 아니라 변수 이름으로 읽어서 설정 전체가 만들어지지 않는다.
//
// Publishable key 는 브라우저에 공개되도록 설계된 키다. 이 파일은 커밋해도 된다.
// ⚠️ 같은 화면의 "Secret key" (sb_secret_... / 예전 service_role) 는 절대 넣지 않는다.
//    그 키는 모든 데이터를 읽고 지울 수 있어서, 웹페이지에 넣는 순간 누구나
//    신청서 전체를 볼 수 있게 된다.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 카카오톡 상담 버튼
//
// 두 값 모두 비워 두면 버튼이 화면에 나타나지 않는다. 하나만 넣어도 된다.
//
//   KAKAO_CHANNEL_URL  — 카카오톡 채널 (예전 이름 플러스친구)
//     center-pf.kakao.com 에서 채널을 만들고, 관리자홈 → 채널 정보 의
//     "채널 홈 URL" 을 복사한다. https://pf.kakao.com/_XXXXXXX 형태.
//     뒤에 /chat 을 붙이면 채널 홈을 거치지 않고 바로 대화창이 열린다.
//
//   KAKAO_OPENCHAT_URL — 오픈채팅방
//     카카오톡 앱 → 오픈채팅 탭 → 방 만들기 → 만든 방의 설정에서 링크 복사.
//     https://open.kakao.com/o/XXXXXXX 형태.
// ---------------------------------------------------------------------------
window.HG_CONFIG = {
  SUPABASE_URL: 'https://wxceyxdxxsepwzvdwkur.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_KWhqjbE6t1a-NaEVIZoLzA_EGjpn5Sq',

  KAKAO_CHANNEL_URL:  '',
  KAKAO_OPENCHAT_URL: '',
};
