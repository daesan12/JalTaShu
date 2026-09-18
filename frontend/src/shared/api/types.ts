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

/** 대여소 예상 대수 한 점 — `GET /map/bike-station/{stationId}`의 `futureData` */
export interface StationForecastPoint {
  /** 예측 시각 (ISO 8601) */
  dateTime: string;
  /** 그 시각의 예상 잔여 대수. 예측값이라 소수로 온다(6.8 등) */
  bikeCnt: number;
  /** 그 시각의 고갈 확률 0~1 — **받기만 하고 화면에 표시하지 않는다**(확률 미표시 결정) */
  probOut: number;
}

/**
 * 07 메인 지도용 대여소 — 백엔드 `GET /map/bike-station` 응답을 화면용으로 옮긴 것.
 * 응답은 `currentCnt`·`time`·`xPos`(경도)·`yPos`(위도)이고, 이름 변환과 좌표 변환(`posToLatLng`)은
 * **`features/map/api/stations.ts` 한 곳에서만** 한다. 화면은 이 타입만 본다.
 * 도보 시간·거리는 표시하지 않으므로 받지도, 계산하지도 않는다.
 */
export interface BikeStation extends Omit<Station, 'currentBikes'> {
  address: string | null;
  /**
   * 현재 잔여 대수. 실시간 스냅샷에 없는 대여소는 **null**로 온다.
   * 0으로 바꾸지 않는다 — 자전거가 없다는 거짓말이 된다.
   */
  currentBikes: number | null;
  /** 그 대수가 **몇 시 기준**인지 (ISO 8601, 응답의 `time`). 스냅샷에 없으면 null */
  updatedAt: string | null;
}

/** 대여소 상세 — `GET /map/bike-station/{stationId}`. 예상 대수는 목록이 아니라 여기에만 있다 */
export interface BikeStationDetail {
  stationId: string;
  currentBikes: number | null;
  updatedAt: string | null;
  futureData: StationForecastPoint[];
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
 * 재탐색(`GET /map/re-route`)에 보내는 "지금 어디쯤 가는 중인지".
 * 도보는 대여소에 가는 길(WALK1)과 반납 뒤 목적지로 가는 길(WALK2)을 구분한다.
 */
export type TravelStatus = 'WALK1' | 'BIKE' | 'WALK2';

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
