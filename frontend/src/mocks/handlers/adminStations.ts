import { delay, http, HttpResponse } from 'msw';
import { fail, isAdminLoggedIn, ok } from '@/mocks/core';
import { STATIONS } from '@/mocks/stations';

/**
 * 관리자 히트맵·대여소 목업 — AdminCycleController 실스키마 기준.
 * 같은 (날짜·대여소·시간)이면 항상 같은 값이 나오게 sin 기반 결정적 노이즈를 쓴다
 * (재생을 반복해도 화면이 흔들리지 않게). 출근(8시)·퇴근(18시) 피크.
 */
const HEATMAP_HOUR_WEIGHT = [
  1, 0, 0, 0, 0, 1, 3, 7, 10, 6, 4, 4, 5, 4, 3, 4, 6, 9, 10, 7, 5, 4, 3, 2,
];

/** 오늘로부터 daysAgo일 전을 YYYY-MM-DD로 (추이 목업용) */
function mockDateString(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 특정 날짜의 (대여소 × 시간) 결정적 대여·반납 건수 */
function mockHourCounts(date: string, stationIdx: number, hour: number) {
  const dateSeed = [...date].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  // 날짜별 물량 차이(0.65~1.25배) — 7일 추이 그래프가 실제처럼 오르내리게
  const dayFactor = 0.65 + ((dateSeed * 7) % 10) * 0.06;
  // 0~1 결정적 노이즈. k로 대여/반납이 서로 다른 수열을 갖게 한다
  const noise = (k: number) =>
    (Math.sin(dateSeed * 3.7 + stationIdx * 13.1 + hour * 2.3 + k) + 1) / 2;
  // 대여소마다 규모 차이 (도심 큰 곳, 외곽 작은 곳)
  const scale = 0.5 + (stationIdx % 4) * 0.4;
  return {
    rentCnt: Math.round(HEATMAP_HOUR_WEIGHT[hour] * scale * dayFactor * (0.5 + noise(0))),
    returnCnt: Math.round(
      HEATMAP_HOUR_WEIGHT[(hour + 23) % 24] * scale * dayFactor * (0.5 + noise(9)),
    ),
  };
}

/** 하루 전체 합계 (대여소 상세·추이용) */
function mockDayTotals(date: string, stationIdx: number) {
  let rentCnt = 0;
  let returnCnt = 0;
  for (let hour = 0; hour < 24; hour++) {
    const counts = mockHourCounts(date, stationIdx, hour);
    rentCnt += counts.rentCnt;
    returnCnt += counts.returnCnt;
  }
  return { rentCnt, returnCnt };
}

/** 관리자 히트맵(01)·대여소 상세(02)·추이 — 실서버처럼 시간 스냅샷/전체 합계 형태로 준다 */
export const adminStationHandlers = [
  // ── 히트맵 — 기준 시각(datetime) 직전 1시간 스냅샷 (하루치가 아니다) ──
  http.get('/api/admin/heatmap', async ({ request }) => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const datetime = new URL(request.url).searchParams.get('datetime') ?? '';
    const date = datetime.slice(0, 10);
    const hour = Number(datetime.slice(11, 13));
    if (!date || Number.isNaN(hour)) return fail(400, '조회 시각이 올바르지 않습니다.');
    const points = STATIONS.map((station, stationIdx) => ({
      time: datetime,
      stationId: station.stationId,
      // xPos=경도, yPos=위도 (coords.ts 규약)
      xPos: station.lng,
      yPos: station.lat,
      ...mockHourCounts(date, stationIdx, hour),
    }));
    return HttpResponse.json(ok(points));
  }),

  // ── 대여소별 추이 — 오늘 제외 (term=day|week) ──
  // trend가 아래 :stationId에 잡히지 않도록 반드시 먼저 등록한다
  http.get('/api/admin/station/trend', async ({ request }) => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const searchParams = new URL(request.url).searchParams;
    const stationId = searchParams.get('stationId') ?? '';
    const term = searchParams.get('term') ?? '';
    if (term !== 'day' && term !== 'week') return fail(400, '조회 기간이 올바르지 않습니다.');
    const stationIdx = STATIONS.findIndex((station) => station.stationId === stationId);
    if (stationIdx < 0) return fail(404, '존재하지 않는 대여소입니다.');
    const days = term === 'day' ? 1 : 7;
    const points = Array.from({ length: days }, (_, i) => {
      const date = mockDateString(days - i);
      const totals = mockDayTotals(date, stationIdx);
      return { date, rentalCnt: totals.rentCnt, returnCnt: totals.returnCnt };
    });
    return HttpResponse.json(ok(points));
  }),

  // ── 대여소 상세 — 현재 수량과 오늘·24시간 전 통계뿐 (이름·주소·배치 목록 없음) ──
  http.get('/api/admin/station/:stationId', async ({ params }) => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const station = STATIONS.find((s) => s.stationId === String(params.stationId));
    if (!station) return fail(404, '존재하지 않는 대여소입니다.');

    const stationIdx = STATIONS.indexOf(station);
    const today = mockDayTotals(mockDateString(0), stationIdx);
    const yesterday = mockDayTotals(mockDateString(1), stationIdx);
    return HttpResponse.json(
      ok({
        currentBikeCnt: station.currentBikes,
        todayRentalCnt: today.rentCnt,
        todayReturnCnt: today.returnCnt,
        currentReportCnt: (stationIdx * 3) % 5,
        yesterdayBikeCnt: Math.max(0, station.currentBikes + ((stationIdx % 3) - 1) * 2),
        yesterdayRentalCnt: yesterday.rentCnt,
        yesterdayReturnCnt: yesterday.returnCnt,
        yesterdayReportCnt: (stationIdx * 2) % 5,
      }),
    );
  }),
];
