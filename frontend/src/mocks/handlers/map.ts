import { delay, http, HttpResponse } from 'msw';
import type {
  BikeStation,
  PlaceSearchResult,
  Pos,
  RecentPlace,
  RoutePath,
  Station,
  StationForecastPoint,
  StationPrediction,
} from '@/shared/api/types';
import { PREDICTION_HORIZONS } from '@/shared/config/constants';
import { fail, ok, requireAuth } from '@/mocks/core';
import { STATIONS } from '@/mocks/stations';

/**
 * 대여소 예상 대수 목업 — 30분 간격 6칸(앞으로 3시간).
 * 대여소마다 다르게 보이도록 ID 끝자리로 오르내림을 바꾼다. 실제 값은 예측 모델이 완성되면 백엔드가 준다.
 * 예측이 아직 없는 대여소도 화면에서 확인할 수 있게 ST0005는 비워 둔다.
 */
function forecastFor(station: Station): StationForecastPoint[] | undefined {
  if (station.stationId === 'ST0005') return undefined;
  const seed = Number(station.stationId.slice(-1));
  const start = Date.now();
  return Array.from({ length: 6 }, (_, i) => {
    const swing = Math.round(Math.sin((i + seed) / 1.6) * 3);
    return {
      dateTime: new Date(start + (i + 1) * 30 * 60_000).toISOString(),
      bikeCnt: Math.max(0, station.currentBikes + swing),
    };
  });
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
 * 경로 후보 목업(10) — 출발·도착 사이를 잇는 4개 경로를 만든다.
 * 가운데를 좌우로 휘게 해 경로마다 길이·시간이 다르고, 10의 뱃지(가장 빠름/자전거 많음/…)가 각각 다른
 * 후보에 붙을 수 있게 확보 대수·고도도 다르게 준다. 실제 OSRM 경로가 아니다.
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

/** 출발→도착을 잇는 곡선. bend가 클수록 가운데가 옆으로 많이 휜다(−: 왼쪽, +: 오른쪽) */
function curvedPath(start: Pos, end: Pos, bend: number, points: number): Pos[] {
  const dx = end.xPos - start.xPos;
  const dy = end.yPos - start.yPos;
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    const bulge = Math.sin(Math.PI * t) * bend;
    return {
      xPos: start.xPos + dx * t - dy * bulge,
      yPos: start.yPos + dy * t + dx * bulge,
    };
  });
}

function pathLength(path: Pos[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceMeters(path[i - 1], path[i]);
  return total;
}

const MOCK_ROUTE_VARIANTS = [
  { bend: 0.05, walkM: 320, expectedBikeCnt: 1, hill: 72 },
  { bend: -0.12, walkM: 300, expectedBikeCnt: 4, hill: 45 },
  { bend: 0.22, walkM: 380, expectedBikeCnt: 3, hill: 18 },
  { bend: -0.3, walkM: 180, expectedBikeCnt: 6, hill: 60 },
] as const;

function buildMockRoutes(start: Pos, end: Pos): RoutePath[] {
  return MOCK_ROUTE_VARIANTS.map(({ bend, walkM, expectedBikeCnt, hill }) => {
    const location = curvedPath(start, end, bend, 12);
    const bikeM = Math.max(200, pathLength(location) - walkM * 2);
    // 고도는 경로보다 촘촘하게(3배) 주고, 가운데가 hill만큼 솟는 언덕 하나
    const altitude = curvedPath(start, end, bend, 36).map((p, i, arr) => ({
      ...p,
      altitude: 50 + Math.round(Math.sin((Math.PI * i) / (arr.length - 1)) * hill),
    }));
    return {
      distance: [walkM, Math.round(bikeM), walkM],
      time: [
        Math.round(walkM / WALK_M_PER_SEC),
        Math.round(bikeM / BIKE_M_PER_SEC),
        Math.round(walkM / WALK_M_PER_SEC),
      ],
      behave: ['WALK', 'BIKE', 'WALK'],
      location,
      altitude,
      expectedBikeCnt,
    };
  });
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
  // 07 메인 지도용. 도보 시간은 프론트에서 좌표로 계산하므로 내려주지 않는다.
  http.get('/api/map/bike-station', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    // 갱신 배지가 "N초 전"부터 올라가는 것을 확인할 수 있게 10초 전으로 고정
    const updatedAt = new Date(Date.now() - 10_000).toISOString();
    const stations: BikeStation[] = STATIONS.map((s) => ({
      ...s,
      updatedAt,
      futureData: forecastFor(s),
    }));
    return HttpResponse.json(ok(stations));
  }),

  http.get('/api/stations/:stationId/predictions', async ({ params }) => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const station = STATIONS.find((s) => s.stationId === params.stationId);
    if (!station) {
      return HttpResponse.json(
        { code: 404, message: '대여소를 찾을 수 없습니다.', data: null },
        { status: 404 },
      );
    }
    // 지평이 길수록 잔여가 조금씩 줄어드는 단순 목업
    const predictions: StationPrediction[] = PREDICTION_HORIZONS.map((horizonMin, i) => {
      const bikes = Math.max(0, station.currentBikes - i);
      return {
        stationId: station.stationId,
        horizonMin,
        bikes,
        probOut: bikes === 0 ? 0.9 : bikes < 3 ? 0.3 : 0.05,
        updatedAt: new Date().toISOString(),
      };
    });
    return HttpResponse.json(ok(predictions));
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
    const q = new URL(request.url).searchParams;
    const start: Pos = { xPos: Number(q.get('startXPos')), yPos: Number(q.get('startYPos')) };
    const end: Pos = { xPos: Number(q.get('endXPos')), yPos: Number(q.get('endYPos')) };
    if (![start.xPos, start.yPos, end.xPos, end.yPos].every(Number.isFinite)) {
      return fail(400, '출발지와 목적지 좌표가 필요합니다.');
    }
    return HttpResponse.json(ok(buildMockRoutes(start, end)));
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
