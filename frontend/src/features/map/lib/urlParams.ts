/**
 * 07 지도 홈의 화면 단계를 URL 쿼리로 관리한다. 라우트는 `/` 그대로라 지도가 살아 있고,
 * 안드로이드·브라우저 뒤로가기가 그대로 "한 단계 닫기"가 된다.
 * 페이지와 훅(useJourneyPlanner 등)이 같은 키를 읽어야 해서 한 곳에 둔다.
 */

/** 08 검색 오버레이 열림(`/?search=1`) */
export const SEARCH_PARAM = 'search';

/**
 * 10 경로 비교(`/?routes=1`). 뒤로가기·← 버튼이 곧 "비교 끝내기 → 목적지 확인 시트".
 * 시트는 기본으로 확장(카드 목록)돼 열리고 아래로 끌면 Peek(2026-09-13 만두 결정). 확장↔Peek은 state라
 * 뒤로가기 단계에 끼지 않는다(Figma 10-1의 "확장→Peek 축소" 단계는 뺌).
 * 후보 목록은 state에만 있어 새로고침하면 사라진다 — 목적지(#26)와 같은 결정.
 */
export const ROUTES_PARAM = 'routes';

/**
 * 11 경로 상세 — 10 위에 한 단계 더(`/?routes=1&detail=1`).
 * 뒤로가기·← 는 비교(10)로 돌아가고, 거기서 한 번 더 뒤로 가면 목적지 확인 시트다.
 */
export const DETAIL_PARAM = 'detail';

/**
 * 12 경로 안내 — 11 위에 한 단계 더(`?routes=1&detail=1&guide=1`).
 * 안내 종료·뒤로가기는 상세(11)로 돌아간다.
 */
export const GUIDE_PARAM = 'guide';

/**
 * 08 "지도에서 선택" — 검색 위에 한 단계 더(`?search=1&pick=1`).
 * 취소·뒤로가기는 검색으로 돌아가고, 확정하면 검색까지 한 번에 닫는다.
 */
export const PICK_PARAM = 'pick';

/**
 * 08에서 출발지를 고르는 중이면 `?search=1&field=start`(목적지 검색 위에 한 단계 더).
 * "지도에서 선택"까지 들어가면 `?search=1&field=start&pick=1`. 값이 없거나 다르면 목적지 모드다.
 */
export const FIELD_PARAM = 'field';
export const START_FIELD_VALUE = 'start';

/**
 * QR 스캔에서 돌아올 때 실린 자전거 번호(`/?code=22B01262`).
 * 다른 파라미터와 달리 화면 단계가 아니라 **한 번 처리하고 지우는 일회성 입력**이다 —
 * 남겨 두면 뒤로가기나 새로고침으로 같은 대여가 다시 나간다.
 */
export const CODE_PARAM = 'code';
