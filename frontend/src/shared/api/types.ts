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
 * 07 메인 지도용 대여소 — 백엔드 `GET /map/bike-station` 대응. 응답 필드명은 미확정이라 임시 스키마.
 * - 백엔드 원본은 `xPos`=경도, `yPos`=위도(확정). 실제 응답이 오면 이 파일과 api/stations.ts에서만 lat/lng로 맞춘다
 * - 도보 시간·거리는 화면에 표시하지 않으므로 받지도, 계산하지도 않는다
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

/**
 * 장소 검색 결과 한 건 — 백엔드 `GET /map?query=`(#18) 응답 그대로. 최근 검색(`GET /map/recent`)과
 * 저장 요청(`POST /map/location/recent`)도 같은 형태다.
 * `xPos`=경도, `yPos`=위도(백엔드 확정). 지도에 찍을 때는 `posToLatLng()`로만 바꾼다.
 */
export interface PlaceSearchResult {
  title: string;
  /** 지번 주소. 네이버 응답에 없으면 빈 문자열 */
  address: string;
  /** 도로명 주소. 네이버 응답에 없으면 빈 문자열 */
  roadAddress: string;
  xPos: number;
  yPos: number;
}

/** 백엔드 좌표 필드 쌍 — `xPos`=경도, `yPos`=위도(확정). 지도에 찍을 때는 `posToLatLng()`로만 바꾼다 */
export interface Pos {
  xPos: number;
  yPos: number;
}

/** 경로 구간 행동 — 백엔드 통보값(9/14 이의 없으면 확정). RENT/RETURN은 대여소에서의 대여·반납 */
export type RouteBehave = 'WALK' | 'BIKE' | 'RENT' | 'RETURN';

/**
 * 경로 후보 하나 — 백엔드 `GET /map/path`(OSRM 경유) 응답 배열의 원소.
 * ⚠ 9/14 백엔드 확인 전 프론트 가정. 실제 응답이 오면 이 타입과 `features/map/api/routes.ts`만 고친다.
 * - 최상위 배열 = 경로 후보 4개 (가정)
 * - `distance`(m)·`time`(초)·`behave`는 같은 인덱스가 같은 구간. 기본은 도보→자전거→도보 3구간이며,
 *   RENT/RETURN이 길이 0 구간으로 끼어 올 수 있다(백엔드 확인 필요)
 * - `altitude`는 `location`보다 촘촘해 인덱스로 대응시키지 않는다 → 11 고도 그래프는 위치(거리) 기준
 */
export interface RoutePath {
  distance: number[];
  time: number[];
  behave: RouteBehave[];
  /** 경로선 좌표 */
  location: Pos[];
  /** 고도 — (경도, 위도, 고도 m) 묶음 */
  altitude: (Pos & { altitude: number })[];
  /**
   * 대여 대여소에 도착하는 시점에 확보 가능한 대수 (필드명 가정 — 예측 모델 지원 여부는 협의 중).
   * 10·11에서 "도착 시 N대"로 표시. 확률은 표시하지 않는다
   */
  expectedBikeCnt: number;
}
