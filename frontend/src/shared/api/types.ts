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
 * 대여소 예상 대수 한 점 — 대여소 상세의 대수 추이 그래프에서 쓴다.
 * ⚠ 백엔드 스펙 미확정 프론트 가정(2026-09-14). 실제 응답이 오면 이 타입과 `api/stations.ts`만 고친다.
 */
export interface StationForecastPoint {
  /** 예측 시각 (ISO 8601) */
  dateTime: string;
  /** 그 시각의 예상 잔여 대수 */
  bikeCnt: number;
}

/**
 * 07 메인 지도용 대여소 — 백엔드 `GET /map/bike-station` 대응. 응답 필드명은 미확정이라 임시 스키마.
 * - 백엔드 원본은 `xPos`=경도, `yPos`=위도(확정). 실제 응답이 오면 이 파일과 api/stations.ts에서만 lat/lng로 맞춘다
 * - 도보 시간·거리는 화면에 표시하지 않으므로 받지도, 계산하지도 않는다
 */
export interface BikeStation extends Station {
  /** 데이터 갱신 시각 (ISO 8601, KST) — 명세의 `time`. 07 갱신 배지에서 사용 */
  updatedAt: string;
  /**
   * 앞으로의 예상 대수. 목록 응답에 함께 온다고 **가정**한다(별도 상세 API로 갈라지면 `api/stations.ts`만 고친다).
   * 예측 모델이 아직이라 값이 없을 수 있어 optional — 없으면 그래프 자리에 안내만 띄운다
   */
  futureData?: StationForecastPoint[];
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
 * 장소 검색 결과 한 건 — 백엔드 `GET /map?query=`(#18) 응답 그대로.
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

/**
 * 최근 검색 한 건 — 백엔드 `GET /map/recent`(2026-09-14 `8ecfd37`) 응답.
 * 검색 결과(`PlaceSearchResult`)와 모양이 같지만 삭제(`DELETE /map/recent/{placeId}`)에 쓸
 * `placeId`가 더 있다. 같은 타입 하나로 둘 다 쓰면 검색 결과 쪽엔 없는 필드가 있는 것처럼 보인다.
 */
export interface RecentPlace extends PlaceSearchResult {
  placeId: number;
}

/** 백엔드 좌표 필드 쌍 — `xPos`=경도, `yPos`=위도(확정). 지도에 찍을 때는 `posToLatLng()`로만 바꾼다 */
export interface Pos {
  xPos: number;
  yPos: number;
}

/** 경로 후보 종류 — 서버 `routes[].type` 그대로. BIKE=일반, UPHILL=오르막 회피, WALK=자전거 없이 도보만 */
export type RouteType = 'BIKE' | 'UPHILL' | 'WALK';

/** 구간 이동 수단 — 서버 `legs[].mode` */
export type TravelMode = 'WALK' | 'BICYCLE';

/**
 * 경로 응답 안의 좌표 — GeoJSON 순서라 **`[경도, 위도]`**다.
 * 이 프로젝트의 다른 API는 `{xPos, yPos}`를 쓰므로 여기만 형태가 다르다.
 * 지도에 찍을 때는 반드시 `osrmToLatLng()`로만 바꾼다(좌표 뒤집힘이 1순위 버그).
 */
export type GeoPos = [number, number];

/** 대여·반납 대여소 — 경로가 어느 대여소를 쓰는지 서버가 알려준다 */
export interface RouteStation {
  stationId: string;
  name: string;
  location: GeoPos;
}

/**
 * 회전 안내 한 건 — 그 step이 **시작될 때** 하는 동작이다.
 *
 * ⚠ 이름이 `behave`지만 **이동 수단이 아니다.** 예전에 WALK/BIKE/RENT/RETURN으로 가정했던 그 필드가
 * 아니라 OSRM 회전 정보다. 이동 수단은 `RouteLeg.mode`에 따로 있다.
 * 화면(12 회전 안내·음성)은 다음 이슈에서 만들고, 여기서는 타입만 갖춰 둔다.
 */
export interface RouteManeuver {
  /** OSRM maneuver type — `depart`·`turn`·`arrive`·`roundabout` 등 */
  type: string;
  /** 방향 — `left`·`right`·`slight left` 등. 직진이면 없을 수 있다 */
  modifier: string | null;
  /** 회전교차로에서 나갈 출구 번호. 회전교차로가 아니면 없다 */
  exit: number | null;
  /** 이 동작을 하는 지점 */
  location: GeoPos;
  /** 서버가 만들어 준 한국어 안내문("우회전하세요") — 그대로 보여주면 된다 */
  instruction: string;
}

/** 경로선 좌표 한 점. 고도가 좌표마다 붙어 온다 */
export interface RoutePoint {
  location: GeoPos;
  /** 고도(m) */
  altitude: number;
}

/** 회전과 회전 사이 한 토막 */
export interface RouteStep {
  /** 거리(m) */
  distance: number;
  /** 소요 시간(초) */
  time: number;
  roadName: string;
  travelMode: string;
  points: RoutePoint[];
  behave: RouteManeuver;
}

/** 이동 수단 단위 구간 — 도보 → 자전거 → 도보. **경계를 서버가 나눠 준다**(프론트가 추정하지 않는다) */
export interface RouteLeg {
  mode: TravelMode;
  /** 거리(m) */
  distance: number;
  /** 소요 시간(초) */
  time: number;
  steps: RouteStep[];
}

/**
 * 경로 후보 하나 — 백엔드 `GET /map/path` 응답 `routes[]`의 원소.
 * 후보는 **최대 2개**(BIKE·UPHILL)이고, 출발·도착에서 가장 가까운 대여소가 같으면 WALK 1개만 온다.
 */
export interface RouteCandidate {
  type: RouteType;
  /** 대여 대여소. 자전거를 타지 않는 WALK 후보는 없다 */
  startStation: RouteStation | null;
  /** 반납 대여소. 자전거를 타지 않는 WALK 후보는 없다 */
  endStation: RouteStation | null;
  /** 총 거리(m) */
  totalDistance: number;
  /** 총 소요 시간(초) */
  totalTime: number;
  legs: RouteLeg[];
  /**
   * 대여 대여소 도착 시점에 확보 가능한 대수.
   * **아직 응답에 없다**(AI 예측 대기, 2026-09-17에 곧 준다고 함) — 값이 들어오면 10의 "확보 우선"
   * 칩과 "도착 시 N대" 표시가 그대로 살아난다. 그때까지 optional.
   */
  expectedBikeCnt?: number;
}

/** `GET /map/path` 응답 — 후보 배열이 `routes` 한 겹 안에 들어 있다 */
export interface PathResponse {
  routes: RouteCandidate[];
}
