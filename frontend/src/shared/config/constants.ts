/** 모바일 레이아웃 최대 폭 (px) — MobileLayout과 동일 값 */
export const APP_MAX_WIDTH = 430;

/** 예측 지평 (분) — MVP 확정: 5/10/15 */
export const PREDICTION_HORIZONS = [5, 10, 15] as const;
export type PredictionHorizon = (typeof PREDICTION_HORIZONS)[number];

/** 최근 검색 저장 최대 개수 (localStorage) */
export const RECENT_SEARCH_MAX = 10;

/** localStorage 키 모음 — 문자열 하드코딩 금지, 반드시 여기서 가져다 쓸 것 */
export const STORAGE_KEYS = {
  onboardingDone: 'onboarding_done',
  settings: 'app_settings',
} as const;

/**
 * 약관 정의 — 백엔드 sign-up의 필수 코드(SERVICE/PRIVACY/LOCATION)와 일치해야 함.
 * 버전 변경 시 여기만 수정.
 */
export const TERMS = [
  { code: 'SERVICE', version: '1.0', label: '서비스 이용약관', required: true },
  { code: 'PRIVACY', version: '1.0', label: '개인정보 처리방침', required: true },
  { code: 'LOCATION', version: '1.0', label: '위치기반서비스 이용약관', required: true },
  { code: 'MARKETING', version: '1.0', label: '마케팅 정보 수신', required: false },
] as const;
export type TermCode = (typeof TERMS)[number]['code'];

/** 닉네임 규칙 — 백엔드 InitUserRequestDto의 검증과 동일하게 유지 */
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 10;
export const NICKNAME_PATTERN = /^[a-zA-Z0-9ㄱ-ㅎ가-힣]*$/;
