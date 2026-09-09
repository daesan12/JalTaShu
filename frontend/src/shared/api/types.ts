import type { PredictionHorizon } from '@/shared/config/constants';

/**
 * 백엔드 공통 응답 래퍼 (backend/good-tashu ApiResponse.java와 동일 형태)
 * HTTP status와 body의 code는 항상 일치. 에러 시 data는 null.
 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
}

/** 대여소 (실시간 잔여 포함) — ID 체계는 KLID와 동일한 ST00xx */
export interface Station {
  stationId: string;
  name: string;
  lat: number;
  lng: number;
  /** 현재 잔여 대수 (실시간 스냅샷 s) */
  currentBikes: number;
}

/**
 * 예측 재고 — Redis 캐시 `pred:{station_id}:{horizon_min}` 스키마와 대응.
 * 예측 캐시가 죽으면(TTL 만료) 백엔드는 prediction 없이 currentBikes만 내려줌 → nullable로 다룰 것.
 */
export interface StationPrediction {
  stationId: string;
  horizonMin: PredictionHorizon;
  /** 도착 시점 예상 잔여 대수 (UI는 점 추정 단독 표시 금지 — 위험 배지 병기) */
  bikes: number;
  /** 도착 시점 고갈 확률 0~1 */
  probOut: number;
  /** 예측 생성 시각 (ISO 8601, KST) */
  updatedAt: string;
}
