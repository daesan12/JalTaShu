/** 모바일 레이아웃 최대 폭 (px) — MobileLayout과 동일 값 */
export const APP_MAX_WIDTH = 430;

/** 예측 지평 (분) — MVP 확정: 5/10/15 */
export const PREDICTION_HORIZONS = [5, 10, 15] as const;
export type PredictionHorizon = (typeof PREDICTION_HORIZONS)[number];

/** 최근 검색 저장 최대 개수 (localStorage) */
export const RECENT_SEARCH_MAX = 10;
