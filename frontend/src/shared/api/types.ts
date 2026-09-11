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
 * 07 메인 지도용 대여소 — 백엔드 `GET /map/bike-station` 대응. 명세 미확정 항목이 있어 임시 스키마.
 * - 원본 명세의 `xPos`/`yPos` 중 어느 쪽이 위도인지 미확정 → 확정 전까지 lat/lng로 받는다고 가정
 * - 도보 시간은 서버에서 받지 않는다. 출발점이 사용자마다 달라 캐시가 안 먹히고, 위치가 바뀔 때마다
 *   재요청해야 해서 프론트에서 `walkMinutesBetween()`으로 추정한다 (coords.ts)
 */
export interface BikeStation extends Station {
  /** 데이터 갱신 시각 (ISO 8601, KST) — 명세의 `time`. 07 갱신 배지에서 사용 */
  updatedAt: string;
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
