import { delay, http, HttpResponse } from 'msw';
import { fail, isAdminLoggedIn, ok } from '@/mocks/core';
import { STATIONS } from '@/mocks/stations';

/**
 * 관리자 히트맵 하루치 목업 — 시간 24 × 대여소.
 * 출근(8시)·퇴근(18시) 피크를 주고, 같은 (날짜·대여소·시간)이면 항상 같은 값이 나오게
 * sin 기반 결정적 노이즈를 쓴다 (재생을 반복해도 화면이 흔들리지 않게).
 */
const HEATMAP_HOUR_WEIGHT = [
  1, 0, 0, 0, 0, 1, 3, 7, 10, 6, 4, 4, 5, 4, 3, 4, 6, 9, 10, 7, 5, 4, 3, 2,
];

/** 오늘로부터 daysAgo일 전을 YYYY-MM-DD로 (대여소 상세·추이 목업용) */
function mockDateString(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 대여소 상세 목업 주소 — stationIdx 순환 */
const STATION_ADDRESSES = [
  '유성구 대학로 87',
  '유성구 월드컵대로 32',
  '서구 둔산로 100',
  '동구 중앙로 215',
  '유성구 궁동 220',
  '서구 만년로 68',
  '유성구 대학로 291',
  '서구 둔산대로 169',
];

function buildMockHeatmap(date: string) {
  const dateSeed = [...date].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  // 날짜별 물량 차이(0.65~1.25배) — 7일 추이 그래프가 실제처럼 오르내리게
  const dayFactor = 0.65 + ((dateSeed * 7) % 10) * 0.06;
  return STATIONS.flatMap((station, stationIdx) =>
    Array.from({ length: 24 }, (_, hour) => {
      // 0~1 결정적 노이즈. k로 대여/반납이 서로 다른 수열을 갖게 한다
      const noise = (k: number) =>
        (Math.sin(dateSeed * 3.7 + stationIdx * 13.1 + hour * 2.3 + k) + 1) / 2;
      // 대여소마다 규모 차이 (도심 큰 곳, 외곽 작은 곳)
      const scale = 0.5 + (stationIdx % 4) * 0.4;
      return {
        time: hour,
        stationId: station.stationId,
        // xPos=경도, yPos=위도 (coords.ts 규약)
        xPos: station.lng,
        yPos: station.lat,
        rentCnt: Math.round(HEATMAP_HOUR_WEIGHT[hour] * scale * dayFactor * (0.5 + noise(0))),
        returnCnt: Math.round(
          HEATMAP_HOUR_WEIGHT[(hour + 23) % 24] * scale * dayFactor * (0.5 + noise(9)),
        ),
      };
    }),
  );
}

/** 관리자 히트맵(01)·대여소 상세(02) — 두 화면의 숫자가 맞도록 같은 생성기를 쓴다 */
export const adminStationHandlers = [
  // ── 관리자 히트맵 (01 — API 명세 구현 O, 응답 형태는 인수인계 문서 기준 임시) ──
  http.get('/api/admin/heatmap', async ({ request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const date = new URL(request.url).searchParams.get('date') ?? '';
    return HttpResponse.json(ok(buildMockHeatmap(date)));
  }),

  // ── 관리자 대여소 상세 (02 — 구현 O, 응답 형태 임시) ──────────────────
  // ⚠ trend가 아래 :stationId에 잡히지 않도록 반드시 먼저 등록한다
  http.get('/api/admin/station/trend', async ({ request }) => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const stationId = new URL(request.url).searchParams.get('stationId') ?? '';
    if (!STATIONS.some((s) => s.stationId === stationId)) {
      return fail(404, '존재하지 않는 대여소입니다.');
    }
    // 오늘 포함 최근 7일 — 히트맵과 같은 생성기를 써서 두 화면의 숫자가 맞는다
    const points = Array.from({ length: 7 }, (_, i) => {
      const date = mockDateString(6 - i);
      const day = buildMockHeatmap(date).filter((p) => p.stationId === stationId);
      return {
        date,
        rentalCnt: day.reduce((sum, p) => sum + p.rentCnt, 0),
        returnCnt: day.reduce((sum, p) => sum + p.returnCnt, 0),
      };
    });
    return HttpResponse.json(ok(points));
  }),

  http.get('/api/admin/station/:stationId', async ({ params }) => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const station = STATIONS.find((s) => s.stationId === String(params.stationId));
    if (!station) return fail(404, '존재하지 않는 대여소입니다.');

    const stationIdx = STATIONS.indexOf(station);
    const sumDay = (date: string, key: 'rentCnt' | 'returnCnt') =>
      buildMockHeatmap(date)
        .filter((p) => p.stationId === station.stationId)
        .reduce((sum, p) => sum + p[key], 0);
    const today = mockDateString(0);
    const yesterday = mockDateString(1);

    return HttpResponse.json(
      ok({
        stationId: station.stationId,
        name: station.name,
        address: `대전광역시 ${STATION_ADDRESSES[stationIdx % STATION_ADDRESSES.length]}`,
        rackCnt: 10 + (stationIdx % 3) * 5,
        cycleCnt: station.currentBikes,
        todayRentCnt: sumDay(today, 'rentCnt'),
        yesterdayRentCnt: sumDay(yesterday, 'rentCnt'),
        todayReturnCnt: sumDay(today, 'returnCnt'),
        yesterdayReturnCnt: sumDay(yesterday, 'returnCnt'),
        cycles: Array.from({ length: station.currentBikes }, (_, i) => ({
          cycleId: `DJ-1${String(stationIdx)}${String(i).padStart(3, '0')}`,
          // 데모용: 세 번째 자전거는 정지 상태로 보여준다
          statement: i === 2 ? '정지' : '정상',
          lastUsedAt: new Date(Date.now() - (i * 47 + stationIdx * 13) * 60_000).toISOString(),
        })),
      }),
    );
  }),
];
