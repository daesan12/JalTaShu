import { delay, http, HttpResponse } from 'msw';
import { fail, ok, requireAuth } from '@/mocks/core';

/** 이동 기록 목업 (22·23 — 잘타슈 내비게이션 기록, 프레임 데이터 기반) */
const RIDE_PAGE_SIZE = 5;
const RIDE_SUMMARIES = [
  {
    id: 12,
    from: '봉명동',
    to: '대전시청',
    date: '2026-08-28',
    durationMin: 23,
    bikeCode: 'DJ-10482',
  },
  {
    id: 11,
    from: '충남대 정문',
    to: '유성온천역',
    date: '2026-08-26',
    durationMin: 15,
    bikeCode: 'DJ-10517',
  },
  {
    id: 10,
    from: '대전역',
    to: '중앙로지하상가',
    date: '2026-08-24',
    durationMin: 11,
    bikeCode: 'DJ-10233',
  },
  {
    id: 9,
    from: '대전시청',
    to: '갤러리아타임월드',
    date: '2026-08-21',
    durationMin: 9,
    bikeCode: 'DJ-10904',
  },
  {
    id: 8,
    from: '월평역',
    to: '정부청사역',
    date: '2026-08-19',
    durationMin: 18,
    bikeCode: 'DJ-10064',
  },
  {
    id: 7,
    from: '한밭수목원',
    to: '엑스포과학공원',
    date: '2026-08-17',
    durationMin: 21,
    bikeCode: 'DJ-10371',
  },
  {
    id: 6,
    from: '유성구청',
    to: '충남대 정문',
    date: '2026-08-14',
    durationMin: 12,
    bikeCode: 'DJ-10517',
  },
  {
    id: 5,
    from: '갑천네이처브리지',
    to: '월평역',
    date: '2026-08-11',
    durationMin: 17,
    bikeCode: 'DJ-10482',
  },
  {
    id: 4,
    from: '시청역',
    to: '대전역',
    date: '2026-08-08',
    durationMin: 26,
    bikeCode: 'DJ-10233',
  },
  {
    id: 3,
    from: '카이스트 본원',
    to: '유성온천역',
    date: '2026-08-05',
    durationMin: 14,
    bikeCode: 'DJ-10788',
  },
  {
    id: 2,
    from: '정부청사역',
    to: '한밭수목원',
    date: '2026-08-02',
    durationMin: 10,
    bikeCode: 'DJ-10064',
  },
  {
    id: 1,
    from: '대전시청',
    to: '봉명동',
    date: '2026-07-30',
    durationMin: 24,
    bikeCode: 'DJ-10904',
  },
];

/** 상세의 고도·경로는 대표 프로파일 하나를 공유 (프레임의 봉명동→대전시청 기준) */
const RIDE_ELEVATION_BARS = (
  [
    ['flat', 0.15],
    ['flat', 0.2],
    ['climb', 0.35],
    ['climb', 0.4],
    ['steep', 0.6],
    ['steep', 0.8],
    ['gentle', 0.7],
    ['gentle', 0.5],
    ['flat', 0.35],
    ['gentle', 0.3],
    ['climb', 0.4],
    ['gentle', 0.3],
    ['climb', 0.45],
    ['steep', 0.6],
    ['gentle', 0.5],
    ['flat', 0.25],
  ] as const
).map(([grade, value]) => ({ grade, value }));

const RIDE_PATH = [
  {
    kind: 'walk',
    points: [
      [8, 54],
      [22, 54],
    ],
  },
  {
    kind: 'climb',
    points: [
      [22, 54],
      [27, 46],
      [38, 46],
    ],
  },
  {
    kind: 'steep',
    points: [
      [38, 46],
      [43, 38],
      [54, 38],
    ],
  },
  {
    kind: 'gentle',
    points: [
      [54, 38],
      [59, 30],
      [70, 30],
    ],
  },
  {
    kind: 'flat',
    points: [
      [70, 30],
      [75, 22],
      [84, 22],
    ],
  },
  {
    kind: 'walk',
    points: [
      [84, 22],
      [92, 18],
    ],
  },
];

/** 이동 기록 (22·23 — 백엔드 API 미정, 임시 스키마) */
export const rideHandlers = [
  http.get('/api/rides', async ({ request }) => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const page = Math.max(1, Number(new URL(request.url).searchParams.get('page')) || 1);
    const totalPages = Math.ceil(RIDE_SUMMARIES.length / RIDE_PAGE_SIZE);
    return HttpResponse.json(
      ok({
        stats: { totalRides: 42, totalDistanceKm: 128.4, totalDurationMin: 972 },
        rides: RIDE_SUMMARIES.slice((page - 1) * RIDE_PAGE_SIZE, page * RIDE_PAGE_SIZE),
        page,
        totalPages,
      }),
    );
  }),

  http.get('/api/rides/:rideId', async ({ params }) => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const summary = RIDE_SUMMARIES.find((r) => r.id === Number(params.rideId));
    if (!summary) return fail(404, '존재하지 않는 이동 기록입니다.');

    const distanceKm = Number((summary.durationMin * 0.165).toFixed(1));
    const bikeMin = Math.max(1, summary.durationMin - 9);
    const bikeKm = Number(Math.max(0.1, distanceKm - 0.58).toFixed(1));
    return HttpResponse.json(
      ok({
        ...summary,
        distanceKm,
        avgSpeedKmh: 13,
        totalAscentM: 45,
        maxGradePct: 6,
        elevationBars: RIDE_ELEVATION_BARS,
        segments: [
          {
            type: 'walk',
            durationMin: 5,
            distanceM: 320,
            description: `${summary.from} 인근 대여소까지`,
          },
          {
            type: 'bike',
            durationMin: bikeMin,
            distanceM: Math.round(bikeKm * 1000),
            description: '',
            ascentM: 45,
            maxGradePct: 6,
          },
          { type: 'walk', durationMin: 4, distanceM: 260, description: `${summary.to}까지` },
        ],
        path: RIDE_PATH,
      }),
    );
  }),
];
