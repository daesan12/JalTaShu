import { delay, http, HttpResponse } from 'msw';
import type {
  PathResponse,
  PlaceSearchResult,
  Pos,
  RecentPlace,
  RouteCandidate,
  RouteLeg,
  RoutePoint,
  RouteStation,
  RouteStep,
  RouteType,
  Station,
  StationForecastPoint,
  TravelMode,
} from '@/shared/api/types';
import { fail, ok, requireAuth } from '@/mocks/core';
import { STATIONS } from '@/mocks/stations';

/**
 * 대여소 예상 대수 목업 — **1분 간격 15점**.
 *
 * 백엔드가 Redis `pred:{stationId}:{1..15}`를 그대로 읽어 주는 모양이다(`HORIZONS_MIN`).
 * 예전 목업은 30분 간격 6칸이라는 옛 가정이었는데, 그 상태로는 칸이 좁아서 생기는 문제를
 * 로컬에서 볼 수 없었다(#105에서 라벨 겹침을 실서버에서야 발견했다).
 *
 * 1분 간격이라 값이 완만하게 움직인다. 대여소마다 다르게 보이도록 ID 끝자리로 위상을 바꾼다.
 * 예측이 아직 없는 대여소도 화면에서 확인할 수 있게 ST0005는 비워 둔다.
 */
function forecastFor(station: Station): StationForecastPoint[] {
  if (station.stationId === 'ST0005') return [];
  const seed = Number(station.stationId.slice(-1));
  const start = Date.now();
  return Array.from({ length: 15 }, (_, i) => {
    // 15분 동안 1~2대 안에서 완만하게 오르내린다 — 반올림 경계(2대)를 지나가야
    // "같은 2대인데 색이 다른" 문제가 로컬에서 재현된다
    const swing = Math.sin((i + seed * 3) / 7) * 1.5;
    // 실제 예측값은 소수로 온다(6.8 등) — 화면이 반올림을 제대로 하는지 목업에서도 확인한다
    const bikeCnt = Math.max(0, Math.round((station.currentBikes + swing) * 10) / 10);
    return {
      dateTime: new Date(start + (i + 1) * 60_000).toISOString(),
      bikeCnt,
      probOut: bikeCnt < 1 ? 0.9 : bikeCnt < 3 ? 0.3 : 0.05,
    };
  });
}

/**
 * 실시간 스냅샷이 없는 대여소 — 백엔드는 `currentCnt`·`time`을 **둘 다 null**로 준다.
 * 마커에 '-'가 뜨고 상태가 회색이 되는 경로를 로컬에서도 볼 수 있게 한 곳을 비워 둔다.
 * 07 첫 화면(대전시청 중심)에서 바로 보이는 대여소로 골랐다 — 지도를 옮겨야 보이면 확인을 건너뛰게 된다.
 */
const STATION_WITHOUT_REALTIME = 'ST0006';

/** 실시간 스냅샷 관측 시각 — 수집기가 올린 시각을 흉내 낸다(대여소 공통) */
function snapshotTime(): string {
  return new Date(Date.now() - 42_000).toISOString();
}

/** 08 장소 검색 목업 — 네이버 지역검색 응답을 백엔드가 정리한 형태(xPos=경도, yPos=위도) */
const PLACES: PlaceSearchResult[] = [
  {
    title: '대전광역시청',
    address: '대전광역시 서구 둔산동 1420',
    roadAddress: '대전광역시 서구 둔산로 100',
    xPos: 127.3845,
    yPos: 36.3504,
  },
  {
    title: '대전시청역 1번 출구',
    address: '대전광역시 서구 둔산동',
    roadAddress: '대전광역시 서구 둔산로 지하 100',
    xPos: 127.3858,
    yPos: 36.3516,
  },
  {
    title: '대전시청 남문광장',
    address: '대전광역시 서구 둔산동 1420',
    roadAddress: '대전광역시 서구 둔산로 100',
    xPos: 127.3849,
    yPos: 36.3495,
  },
  {
    title: '대전역',
    address: '대전광역시 동구 정동 1-1',
    roadAddress: '대전광역시 동구 중앙로 215',
    xPos: 127.4346,
    yPos: 36.3315,
  },
  {
    title: '대전복합터미널',
    address: '대전광역시 동구 용전동 63-3',
    roadAddress: '대전광역시 동구 동서대로 1689',
    xPos: 127.4372,
    yPos: 36.3512,
  },
  {
    title: '충남대학교 정문',
    address: '대전광역시 유성구 궁동 220',
    roadAddress: '대전광역시 유성구 대학로 99',
    xPos: 127.3442,
    yPos: 36.3623,
  },
  {
    title: '유성온천역 5번 출구',
    address: '대전광역시 유성구 봉명동',
    roadAddress: '대전광역시 유성구 계룡로 지하 105',
    xPos: 127.3383,
    yPos: 36.3538,
  },
  {
    title: '한밭수목원',
    address: '대전광역시 서구 만년동 396',
    roadAddress: '대전광역시 서구 둔산대로 169',
    xPos: 127.3887,
    yPos: 36.3667,
  },
  {
    title: '대전월드컵경기장',
    address: '대전광역시 유성구 노은동 270',
    roadAddress: '대전광역시 유성구 월드컵대로 32',
    xPos: 127.3216,
    yPos: 36.3664,
  },
  {
    title: '정부대전청사',
    address: '대전광역시 서구 둔산동 920',
    roadAddress: '대전광역시 서구 청사로 189',
    xPos: 127.3915,
    yPos: 36.3616,
  },
  {
    title: '갑천 네이처브리지',
    address: '대전광역시 서구 만년동',
    roadAddress: '대전광역시 서구 둔산대로 123',
    xPos: 127.3893,
    yPos: 36.3688,
  },
  {
    title: '카이스트 본원',
    address: '대전광역시 유성구 구성동 373-1',
    roadAddress: '대전광역시 유성구 대학로 291',
    xPos: 127.3604,
    yPos: 36.3722,
  },
  {
    title: '한밭도서관',
    address: '대전광역시 중구 문화동 145-3',
    roadAddress: '대전광역시 중구 문화로 23',
    xPos: 127.4046,
    yPos: 36.3172,
  },
  {
    title: '대전유성구도서관',
    address: '대전광역시 유성구 봉명동 1013',
    roadAddress: '대전광역시 유성구 유성대로 654',
    xPos: 127.3416,
    yPos: 36.3542,
  },
  {
    title: '대전시립 가오도서관',
    address: '대전광역시 동구 가오동 158',
    roadAddress: '대전광역시 동구 은어송로 58',
    xPos: 127.4529,
    yPos: 36.3062,
  },
  {
    title: '대전학생교육문화원 도서관',
    address: '대전광역시 서구 둔산동 1339',
    roadAddress: '대전광역시 서구 둔산서로 175',
    xPos: 127.3742,
    yPos: 36.3605,
  },
  {
    title: '대전서구어린이도서관',
    address: '대전광역시 서구 갈마동 1012',
    roadAddress: '대전광역시 서구 갈마로 105',
    xPos: 127.3667,
    yPos: 36.3466,
  },
  {
    title: '한밭대학교 도서관',
    address: '대전광역시 유성구 덕명동 16-1',
    roadAddress: '대전광역시 유성구 동서대로 125',
    xPos: 127.2986,
    yPos: 36.351,
  },
];

/**
 * 경로 후보 목업(10) — 출발·도착 사이를 잇는 경로를 만든다.
 * 가운데를 좌우로 휘게 해 후보마다 길이·고도가 다르다. 실제 OSRM 경로가 아니다.
 */
const EARTH_RADIUS_M = 6_371_000;
const BIKE_M_PER_SEC = 4.2; // ≈ 15km/h
const WALK_M_PER_SEC = 1.1; // ≈ 67m/분

function distanceMeters(a: Pos, b: Pos): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.yPos - a.yPos);
  const dLng = toRad(b.xPos - a.xPos);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.yPos)) * Math.cos(toRad(b.yPos)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * 도시 도로처럼 **가로·세로로 꺾어 가는** 경로를 만든다.
 *
 * 예전 목업은 출발·도착을 잇는 매끈한 사인 곡선이었는데, 그러면 실제 OSRM 경로와 모양이 전혀
 * 달라서 회전 지점 표시나 회전 안내를 화면에서 확인할 수 없다. 꺾이는 지점을 실제로 만들고,
 * 그 지점의 회전 방향까지 함께 돌려준다.
 */
interface MockGeometry {
  points: Pos[];
  /** 좌표 인덱스 → 그 지점에서 꺾는 방향(`left`·`right`) */
  corners: Map<number, string>;
}

/** 세 점이 이루는 꺾임 방향 — 외적 부호로 좌/우를 가른다 */
function turnModifier(prev: Pos, corner: Pos, next: Pos): string {
  const cross =
    (corner.xPos - prev.xPos) * (next.yPos - corner.yPos) -
    (corner.yPos - prev.yPos) * (next.xPos - corner.xPos);
  return cross > 0 ? 'left' : 'right';
}

/**
 * 목업 규모 — 실제 도심 5km 경로에 가깝게 맞춘다.
 *
 * 회전 4번·좌표 22개짜리 장난감으로는 "회전 점이 빽빽하지 않은가" 같은 판단을 할 수 없다.
 * 모양은 실제 대전 도로와 다르지만 **개수와 밀도**가 비슷하면 화면을 깎는 데는 충분하다.
 */
/** 가로·세로 각각 몇 번 움직이는지 — 회전 횟수는 이 값의 약 2배가 된다 */
const RUNS_PER_AXIS = 9;
/** 한 구간(직선 주행)을 몇 개의 좌표로 쪼갤지 */
const POINTS_PER_RUN = 12;

/**
 * 구간 길이를 들쭉날쭉하게 만드는 값(0.5~1.5). 실제 도로는 한 블록 길이가 제각각이다.
 * `Math.random()`을 쓰지 않는 이유 — 같은 요청에 같은 경로가 나와야 화면을 비교하며 깎을 수 있다.
 */
function jitter(seed: number, index: number): number {
  const value = Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return 0.5 + (value - Math.floor(value));
}

/** 합이 1이 되도록 비율을 맞춘다 — 그래야 마지막 좌표가 도착지에 정확히 닿는다 */
function normalized(seed: number): number[] {
  const raw = Array.from({ length: RUNS_PER_AXIS }, (_, i) => jitter(seed, i));
  const total = raw.reduce((sum, value) => sum + value, 0);
  return raw.map((value) => value / total);
}

function gridPath(start: Pos, end: Pos, detour: number): MockGeometry {
  const dx = end.xPos - start.xPos;
  const dy = end.yPos - start.yPos;
  const xShare = normalized(detour);
  const yShare = normalized(detour + 1);

  // 가로 → 세로를 번갈아 밟는 계단 모양
  const waypoints: Pos[] = [start];
  let cursor = start;
  for (let i = 0; i < RUNS_PER_AXIS; i++) {
    cursor = { xPos: cursor.xPos + dx * xShare[i], yPos: cursor.yPos };
    waypoints.push(cursor);
    cursor = { xPos: cursor.xPos, yPos: cursor.yPos + dy * yShare[i] };
    waypoints.push(cursor);
  }
  // 비율을 더해 가며 생긴 오차가 남지 않도록 마지막은 도착지로 맞춘다
  waypoints[waypoints.length - 1] = end;

  // 후보마다 다른 길로 가도록 가운데를 옆으로 부풀린다. 양 끝에서는 0이라 출발·도착은 그대로다
  const bulged = waypoints.map((point, i) => {
    const t = i / (waypoints.length - 1);
    return { xPos: point.xPos, yPos: point.yPos + dx * detour * Math.sin(Math.PI * t) };
  });

  const points: Pos[] = [bulged[0]];
  const corners = new Map<number, string>();
  for (let i = 1; i < bulged.length; i++) {
    const from = bulged[i - 1];
    const to = bulged[i];
    for (let step = 1; step <= POINTS_PER_RUN; step++) {
      points.push({
        xPos: from.xPos + ((to.xPos - from.xPos) * step) / POINTS_PER_RUN,
        yPos: from.yPos + ((to.yPos - from.yPos) * step) / POINTS_PER_RUN,
      });
    }
    // 마지막 waypoint(도착)에서는 더 꺾지 않는다
    if (i < bulged.length - 1) {
      corners.set(points.length - 1, turnModifier(from, to, bulged[i + 1]));
    }
  }
  return { points, corners };
}

/** 백엔드 `PathService.instruction()`과 같은 문장을 만든다 — 프론트는 이걸 그대로 읽는다 */
function mockInstruction(type: string, modifier: string | null): string {
  if (type === 'depart') return '출발하세요';
  if (type === 'arrive') return '구간 목적지에 도착했습니다';
  switch (modifier) {
    case 'left':
      return '좌회전하세요';
    case 'right':
      return '우회전하세요';
    case 'slight left':
      return '왼쪽으로 완만하게 이동하세요';
    case 'slight right':
      return '오른쪽으로 완만하게 이동하세요';
    default:
      return '직진하세요';
  }
}

function mockManeuver(type: string, modifier: string | null, at: RoutePoint): RouteStep['behave'] {
  return { type, modifier, exit: null, location: at.location, instruction: mockInstruction(type, modifier) };
}

/** 좌표 → 서버 응답의 GeoJSON 좌표 `[경도, 위도]` */
function toGeo({ xPos, yPos }: Pos): [number, number] {
  return [xPos, yPos];
}

function pointDistance(a: RoutePoint, b: RoutePoint): number {
  return distanceMeters(
    { xPos: a.location[0], yPos: a.location[1] },
    { xPos: b.location[0], yPos: b.location[1] },
  );
}

/**
 * 구간 하나를 step으로 나눈다 — **꺾이는 지점에서 끊는다**(실제 OSRM과 같은 규칙).
 * step 경계 좌표는 앞뒤 step이 함께 갖고, 구간 끝에는 길이 0인 `arrive` step을 붙인다.
 */
function toLeg(
  points: RoutePoint[],
  corners: Map<number, string>,
  from: number,
  to: number,
  mode: TravelMode,
): RouteLeg {
  const speed = mode === 'WALK' ? WALK_M_PER_SEC : BIKE_M_PER_SEC;
  const cuts = [from];
  for (let i = from + 1; i < to; i++) {
    if (corners.has(i)) cuts.push(i);
  }
  cuts.push(to);

  const steps: RouteStep[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i];
    const b = cuts[i + 1];
    const slice = points.slice(a, b + 1);
    let distance = 0;
    for (let j = 1; j < slice.length; j++) distance += pointDistance(slice[j - 1], slice[j]);
    const modifier = corners.get(a) ?? null;
    steps.push({
      distance: Math.round(distance),
      time: Math.round(distance / speed),
      roadName: mode === 'WALK' ? '' : '대덕대로',
      travelMode: mode === 'WALK' ? 'walking' : 'cycling',
      points: slice,
      behave: mockManeuver(i === 0 ? 'depart' : 'turn', i === 0 ? null : modifier, slice[0]),
    });
  }
  // 실제 응답처럼 구간 끝에 길이 0인 도착 step을 둔다
  steps.push({
    distance: 0,
    time: 0,
    roadName: '',
    travelMode: mode === 'WALK' ? 'walking' : 'cycling',
    points: [points[to]],
    behave: mockManeuver('arrive', null, points[to]),
  });

  return {
    mode,
    distance: steps.reduce((sum, step) => sum + step.distance, 0),
    time: steps.reduce((sum, step) => sum + step.time, 0),
    steps,
  };
}

/**
 * 경로 후보 목업 — 실제 서버처럼 **2개**(일반·오르막 회피)를 만든다.
 * 출발·도착 대여소가 같은 경우(도보 1개만)는 지금 화면에서 재현할 일이 없어 만들지 않는다.
 * `expectedBikeCnt`는 **두 후보에 같은 값**을 준다. 백엔드가 그렇게 주기 때문이다 — 후보 둘은
 * 같은 대여소에서 빌려 자전거 구간만 다른 것이라 도보 구간도 출발 대여소도 같다.
 * 그래서 10의 "확보 우선" 칩이 막히는 상태가 로컬에서 그대로 재현된다.
 */
const MOCK_ROUTE_VARIANTS: { type: RouteType; detour: number; hill: number }[] = [
  { type: 'BIKE', detour: 0.06, hill: 72 },
  { type: 'UPHILL', detour: -0.18, hill: 18 },
];

/** 대여·반납 대여소가 놓이는 좌표 인덱스 — 꺾이는 지점(`POINTS_PER_RUN` 배수)에 맞춰 둔다 */
function stationIndexes(pointCount: number): { rent: number; return: number } {
  const runs = Math.round((pointCount - 1) / POINTS_PER_RUN);
  return {
    rent: Math.max(1, Math.round(runs * 0.15)) * POINTS_PER_RUN,
    return: Math.min(runs - 1, Math.round(runs * 0.85)) * POINTS_PER_RUN,
  };
}

/**
 * 대여 대여소 도착 시점 예상 대수 — 백엔드와 같은 방식으로 구한다.
 * 도보 구간 시간을 올려 분으로 만들고 그 지평의 예측을 읽는다(`pred:{stationId}:{분}`).
 * 지평이 1-15분이라 도보가 15분을 넘으면 값이 없다(`undefined`).
 */
function mockExpectedBikeCnt(walkSeconds: number): number | undefined {
  const horizonMinutes = Math.max(1, Math.ceil(walkSeconds / 60));
  if (horizonMinutes > 15) return undefined;
  // 지평이 멀수록 조금씩 줄어드는 값. 소수로 온다
  return Math.round(Math.max(0, 5.4 - horizonMinutes * 0.23) * 10) / 10;
}

function buildMockRoutes(start: Pos, end: Pos): RouteCandidate[] {
  const routes = MOCK_ROUTE_VARIANTS.map(({ type, detour, hill }) => {
    const { points: path, corners } = gridPath(start, end, detour);
    const points: RoutePoint[] = path.map((pos, i) => ({
      location: toGeo(pos),
      // 가운데가 hill만큼 솟는 언덕 하나
      altitude: 50 + Math.round(Math.sin((Math.PI * i) / (path.length - 1)) * hill),
    }));
    const station = (index: number, name: string): RouteStation => ({
      stationId: `ST${String(index).padStart(4, '0')}`,
      name,
      location: points[index].location,
    });
    const index = stationIndexes(points.length);
    const legs = [
      toLeg(points, corners, 0, index.rent, 'WALK'),
      toLeg(points, corners, index.rent, index.return, 'BICYCLE'),
      toLeg(points, corners, index.return, points.length - 1, 'WALK'),
    ];
    return {
      type,
      startStation: station(index.rent, '목업 대여 대여소'),
      endStation: station(index.return, '목업 반납 대여소'),
      totalDistance: legs.reduce((sum, leg) => sum + leg.distance, 0),
      totalTime: legs.reduce((sum, leg) => sum + leg.time, 0),
      legs,
    };
  });
  // 후보마다 따로 계산하지 않는다 — 실제로도 같은 도보 구간에서 나온 한 값이 둘에 그대로 들어간다
  const expectedBikeCnt = mockExpectedBikeCnt(routes[0].legs[0].time);
  return routes.map((route) => ({ ...route, expectedBikeCnt }));
}

/** 최근 검색 목업 저장소 — 서버 `recent_places`처럼 고를 때마다 한 줄씩 쌓인다(중복 제거 없음) */
const RECENT_PLACES_KEY = 'msw_recent_places';
/** 최근 검색 목업의 placeId 발급 카운터 — 실제로는 DB auto increment 역할 */
const RECENT_PLACES_NEXT_ID_KEY = 'msw_recent_places_next_id';

function getMockRecentPlaces(): RecentPlace[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_PLACES_KEY) ?? '[]') as RecentPlace[];
  } catch {
    return [];
  }
}

function nextMockPlaceId(): number {
  const next = Number(localStorage.getItem(RECENT_PLACES_NEXT_ID_KEY) ?? '1');
  localStorage.setItem(RECENT_PLACES_NEXT_ID_KEY, String(next + 1));
  return next;
}

/** 지도(07)·장소 검색(08)·경로 탐색(10)·최근 검색 */
export const mapHandlers = [
  // ── 대여소 ─────────────────────────────────────────────────────────
  /*
   * 07 메인 지도용 목록 — 백엔드 `BikeStationListItem` 그대로다(파라미터 없이 전체를 준다).
   * 좌표는 xPos=경도·yPos=위도, 대수는 currentCnt, 관측 시각은 time. 예상 대수는 여기 없고 상세에만 있다.
   */
  http.get('/api/map/bike-station', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const time = snapshotTime();
    const stations = STATIONS.map((s) => {
      const offline = s.stationId === STATION_WITHOUT_REALTIME;
      return {
        stationId: s.stationId,
        name: s.name,
        xPos: s.lng,
        yPos: s.lat,
        address: '대전광역시 (목업 주소)',
        currentCnt: offline ? null : s.currentBikes,
        time: offline ? null : time,
      };
    });
    return HttpResponse.json(ok(stations));
  }),

  // 대여소 상세 — 예상 대수(futureData)는 여기에만 있다. 시트를 확장했을 때만 불린다
  http.get('/api/map/bike-station/:stationId', async ({ params }) => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const station = STATIONS.find((s) => s.stationId === params.stationId);
    if (!station) return fail(404, '대여소를 찾을 수 없습니다.');
    // 실시간 정보가 없는 대여소는 백엔드가 상세를 막는다(BIKE_STATION_DATA_UNAVAILABLE)
    if (station.stationId === STATION_WITHOUT_REALTIME) {
      return fail(404, '대여소 실시간 정보를 찾을 수 없습니다.');
    }
    return HttpResponse.json(
      ok({
        stationId: station.stationId,
        currentCnt: station.currentBikes,
        time: snapshotTime(),
        futureData: forecastFor(station),
      }),
    );
  }),

  // ── 장소 검색 (08) — 백엔드 #18 MapController와 동일 경로 ─────────
  http.get('/api/map', async ({ request }) => {
    await delay(400);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const query = new URL(request.url).searchParams.get('query')?.trim() ?? '';
    if (!query) return fail(400, '검색어를 입력해주세요.');
    // 네이버 지역검색 display=5 → 최대 5건
    const results = PLACES.filter(
      (p) => p.title.includes(query) || p.address.includes(query) || p.roadAddress.includes(query),
    ).slice(0, 5);
    return HttpResponse.json(ok(results));
  }),

  // ── 경로 탐색 (→10) — 백엔드 `GET /map/path`(OSRM 경유). 후보를 전부 내려주고 정렬·필터는 프론트가 한다 ──
  http.get('/api/map/path', async ({ request }) => {
    // 실제 서버는 예측 계산까지 3~5초 걸릴 수 있다 — 로딩 상태가 보이게 조금 기다린다
    await delay(1500);
    const authFail = requireAuth();
    if (authFail) return authFail;
    // ⚠ 이 API만 좌표를 이름으로 구분한다(lat=위도, lng=경도). 다른 API의 xPos/yPos와 다르다
    const q = new URL(request.url).searchParams;
    const start: Pos = { xPos: Number(q.get('startLng')), yPos: Number(q.get('startLat')) };
    const end: Pos = { xPos: Number(q.get('endLng')), yPos: Number(q.get('endLat')) };
    if (![start.xPos, start.yPos, end.xPos, end.yPos].every(Number.isFinite)) {
      return fail(400, '출발지와 목적지 좌표가 필요합니다.');
    }
    const body: PathResponse = { routes: buildMockRoutes(start, end) };
    return HttpResponse.json(ok(body));
  }),

  /**
   * 재탐색 — 안내 중 경로를 벗어났을 때. 실서버는 지금 상황(어느 구간·어느 대여소·경로 종류)을
   * 유지한 채 다시 계산해 준다. 목업은 새 출발지로 같은 종류의 후보 하나만 돌려준다.
   */
  http.get('/api/map/re-route', async ({ request }) => {
    await delay(1200);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const q = new URL(request.url).searchParams;
    const start: Pos = { xPos: Number(q.get('startLng')), yPos: Number(q.get('startLat')) };
    const end: Pos = { xPos: Number(q.get('endLng')), yPos: Number(q.get('endLat')) };
    if (![start.xPos, start.yPos, end.xPos, end.yPos].every(Number.isFinite)) {
      return fail(400, '출발지와 목적지 좌표가 필요합니다.');
    }
    const routeType = q.get('routeType');
    const routes = buildMockRoutes(start, end).filter((route) => route.type === routeType);
    const body: PathResponse = { routes: routes.length > 0 ? routes : buildMockRoutes(start, end) };
    return HttpResponse.json(ok(body));
  }),

  http.get('/api/map/recent', async ({ request }) => {
    await delay(200);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const limit = Number(new URL(request.url).searchParams.get('limit'));
    if (!Number.isFinite(limit) || limit < 1) return fail(400, '조회 개수는 1 이상이어야 합니다.');
    return HttpResponse.json(ok(getMockRecentPlaces().slice(0, limit)));
  }),

  http.post('/api/map/location/recent', async ({ request }) => {
    await delay(200);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as Partial<PlaceSearchResult>;
    if (!body.title?.trim()) return fail(400, '장소 이름은 필수입니다.');
    const recent = getMockRecentPlaces();
    recent.unshift({
      placeId: nextMockPlaceId(),
      title: body.title.trim(),
      address: body.address ?? '',
      roadAddress: body.roadAddress ?? '',
      xPos: Number(body.xPos),
      yPos: Number(body.yPos),
    });
    localStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(recent));
    return HttpResponse.json({
      code: 200,
      message: '최근 검색한 장소가 등록되었습니다.',
      data: null,
    });
  }),

  http.delete('/api/map/recent/:placeId', async ({ params }) => {
    await delay(200);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const placeId = Number(params.placeId);
    const recent = getMockRecentPlaces();
    const next = recent.filter((place) => place.placeId !== placeId);
    if (next.length === recent.length) return fail(404, '이미 삭제된 최근 검색입니다.');
    localStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(next));
    return HttpResponse.json({ code: 200, message: '삭제되었습니다.', data: null });
  }),
];
