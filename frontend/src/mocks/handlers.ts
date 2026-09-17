import { delay, http, HttpResponse } from 'msw';
import type {
  ApiResponse,
  BikeStation,
  PlaceSearchResult,
  RecentPlace,
  Pos,
  RoutePath,
  Station,
  StationForecastPoint,
  StationPrediction,
} from '@/shared/api/types';
import {
  NICKNAME_MAX,
  NICKNAME_MIN,
  NICKNAME_PATTERN,
  PREDICTION_HORIZONS,
  TERMS,
} from '@/shared/config/constants';

/** 백엔드 공통 래퍼와 동일한 형태로 감싸기 */
function ok<T>(data: T): ApiResponse<T> {
  return { code: 200, message: 'OK', data };
}

function fail(code: number, message: string) {
  return HttpResponse.json({ code, message, data: null }, { status: code });
}

/** 공지 팝업 목업 이미지 — 실제 이미지가 없어 색·번호만 있는 SVG를 data URI로 만든다 */
function placeholderImage(label: string, color: string): string {
  // Figma 공지 이미지 크기(283 x 276)와 같은 비율
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="566" height="552"><rect width="566" height="552" fill="${color}"/><text x="283" y="296" font-family="sans-serif" font-size="52" fill="#ffffff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** 백엔드는 모든 API가 세션 필수(.anyRequest().authenticated()) — 동일하게 흉내 */
function requireAuth() {
  return getAuthState().loggedIn ? null : fail(401, '로그인이 필요합니다.');
}

/** 가짜 로그인 세션 — 새로고침에도 유지되도록 localStorage 사용 (개발 초기화: 브라우저 저장소 삭제) */
const AUTH_STATE_KEY = 'msw_auth_state';

interface MockAuthState {
  loggedIn: boolean;
  nickname: string | null;
}

function getAuthState(): MockAuthState {
  try {
    const raw = localStorage.getItem(AUTH_STATE_KEY);
    if (raw) return JSON.parse(raw) as MockAuthState;
  } catch {
    // 파싱 실패 시 초기 상태
  }
  return { loggedIn: false, nickname: null };
}

function setAuthState(state: MockAuthState) {
  try {
    localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(state));
  } catch {
    // 저장 불가 환경 무시
  }
}

/*
 * 가짜 관리자 세션 — 이용자 세션과 완전히 별개다.
 * 백엔드에 관리자 로그인 API가 아직 없어 임시로 둔다. 확정되면 이 블록과 아래 핸들러 3개를 지운다.
 */
const ADMIN_AUTH_KEY = 'msw_admin_auth';

/** Figma 로그인 화면에 적힌 아이디가 admin이라 그대로 쓴다 */
const MOCK_ADMIN = {
  adminId: 1,
  id: 'admin',
  password: 'admin1234',
  name: '운영관리자',
  email: 'admin@tashu.kr',
};

function isAdminLoggedIn(): boolean {
  try {
    return localStorage.getItem(ADMIN_AUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

function setAdminLoggedIn(value: boolean) {
  try {
    localStorage.setItem(ADMIN_AUTH_KEY, String(value));
  } catch {
    // 저장 불가 환경 무시
  }
}

/** 가짜 민원 내역 — 새로고침에도 유지되도록 localStorage 사용 */
const REPORTS_KEY = 'msw_reports';

interface MockReport {
  id: number;
  type: string;
  bikeCode: string | null;
  tag: string | null;
  tagDetail: string | null;
  content: string;
  nickname: string;
  status: string;
  createdAt: string;
}

function getMockReports(): MockReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (raw) return JSON.parse(raw) as MockReport[];
  } catch {
    // 파싱 실패 시 빈 목록
  }
  return [];
}

function setMockReports(reports: MockReport[]) {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  } catch {
    // 저장 불가 환경 무시
  }
}

/** 가짜 Open API 신청 내역 — 새로고침에도 유지되도록 localStorage 사용 */
const OPEN_API_KEY = 'msw_openapi_requests';

interface MockOpenApiRequest {
  id: number;
  purpose: string;
  reason: string;
  status: string;
  createdAt: string;
}

function getOpenApiRequests(): MockOpenApiRequest[] {
  try {
    const raw = localStorage.getItem(OPEN_API_KEY);
    if (raw) return JSON.parse(raw) as MockOpenApiRequest[];
  } catch {
    // 파싱 실패 시 빈 목록
  }
  return [];
}

function setOpenApiRequests(requests: MockOpenApiRequest[]) {
  try {
    localStorage.setItem(OPEN_API_KEY, JSON.stringify(requests));
  } catch {
    // 저장 불가 환경 무시
  }
}
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

/** 대전 실제 좌표 기반 목업 대여소 (07-1 팝업 와이어프레임 데이터 반영) */
const STATIONS: Station[] = [
  { stationId: 'ST0001', name: '유성구청역 대여소', lat: 36.362, lng: 127.3565, currentBikes: 7 },
  {
    stationId: 'ST0002',
    name: '월드컵경기장역 대여소',
    lat: 36.3664,
    lng: 127.3216,
    currentBikes: 3,
  },
  { stationId: 'ST0003', name: '시청역 대여소', lat: 36.3505, lng: 127.3848, currentBikes: 1 },
  { stationId: 'ST0004', name: '대전역 대여소', lat: 36.3315, lng: 127.4346, currentBikes: 5 },
  { stationId: 'ST0005', name: '충남대학교 정문', lat: 36.3623, lng: 127.3442, currentBikes: 0 },
  { stationId: 'ST0006', name: '갑천네이처브리지', lat: 36.3688, lng: 127.3893, currentBikes: 8 },
  { stationId: 'ST0007', name: '카이스트 본원', lat: 36.3722, lng: 127.3604, currentBikes: 2 },
  { stationId: 'ST0008', name: '한밭수목원', lat: 36.3667, lng: 127.3887, currentBikes: 11 },
];

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

/**
 * 공지사항 저장소 — 관리자(06·08)가 CRUD하고, 모바일 고객센터 공지 목록도 같은 데이터를 읽는다
 * (관리자가 등록하면 앱 공지사항에 바로 뜨는 흐름을 목업으로 재현).
 */
const ADMIN_NOTICES_KEY = 'msw_admin_notices';

interface MockNotice {
  noticeId: number;
  title: string;
  content: string;
  createdAt: string;
}

const NOTICE_SEED_CONTENT =
  '안녕하세요, 대전광역시 공영자전거 타슈입니다.\n\n자세한 내용은 본문을 확인해 주세요. 이용에 참고 부탁드립니다.\n\n감사합니다.';

function seedNotices(): MockNotice[] {
  const seeded: MockNotice[] = [
    { noticeId: 5, title: '임시 폐쇄 대여소 안내 (2026. 9. 10.)', createdAt: '2026-09-10T09:00:00+09:00' },
    { noticeId: 4, title: '♣2026년 공공 데이터 활용 설문조사 실시', createdAt: '2026-08-25T09:00:00+09:00' },
    { noticeId: 3, title: '공영자전거 타슈 이용약관 개정 알림', createdAt: '2026-04-10T09:00:00+09:00' },
    { noticeId: 2, title: '"타슈" 대여 전 안전수칙 확인 후 대여하도록 절차 개선', createdAt: '2025-10-28T09:00:00+09:00' },
    { noticeId: 1, title: '타슈 대여소에 반드시 반납해주세요!!!', createdAt: '2023-08-02T09:00:00+09:00' },
  ].map((n) => ({ ...n, content: NOTICE_SEED_CONTENT }));
  // 관리자 목록 페이지네이션 확인용 — 월별 점검 공지를 채워 2페이지 이상 만든다
  for (let i = 0; i < 13; i++) {
    seeded.push({
      noticeId: 6 + i,
      title: `대여소 정기 점검 안내 (2025년 ${12 - i}월)`,
      content: NOTICE_SEED_CONTENT,
      createdAt: `2025-${String(12 - i).padStart(2, '0')}-03T09:00:00+09:00`,
    });
  }
  return seeded;
}

function getMockNotices(): MockNotice[] {
  try {
    const raw = localStorage.getItem(ADMIN_NOTICES_KEY);
    if (raw) return JSON.parse(raw) as MockNotice[];
  } catch {
    // 파싱 실패 시 시드로 초기화
  }
  const seeded = seedNotices();
  setMockNotices(seeded);
  return seeded;
}

function setMockNotices(notices: MockNotice[]) {
  try {
    localStorage.setItem(ADMIN_NOTICES_KEY, JSON.stringify(notices));
  } catch {
    // 저장 불가 환경 무시
  }
}

/** 관리자 제보(claim) 저장소 — API 3종 전부 백엔드 미구현이라 목업으로 CRUD한다 */
const ADMIN_CLAIMS_KEY = 'msw_admin_claims';

type MockClaimStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

interface MockClaim {
  claimId: number;
  cycleId: string;
  nickname: string;
  tag: string;
  content: string;
  statement: MockClaimStatus;
  adminContent: string | null;
  reportCnt: number;
  createdAt: string;
}

const CLAIM_SEEDS: { tag: string; content: string }[] = [
  { tag: '브레이크', content: '브레이크가 잘 안 잡혀요. 내리막에서 위험합니다.' },
  { tag: '타이어', content: '앞바퀴 공기압이 거의 없어요.' },
  { tag: '체인', content: '체인이 자꾸 빠집니다. 두 번이나 다시 끼웠어요.' },
  { tag: '안장', content: '안장 높이 조절 레버가 고장났어요.' },
  { tag: '프레임', content: '프레임에 금이 간 것 같아요. 확인 부탁드립니다.' },
  { tag: '반납 오류', content: '반납했는데 앱에서 계속 대여 중으로 나와요.' },
  { tag: '기타', content: 'QR 코드 스티커가 훼손돼서 스캔이 안 됩니다.' },
];
const CLAIM_NICKNAMES = ['달리는거북', '바퀴요정', '자전거덕후', '탄방동주민', '출근라이더'];

function seedClaims(): MockClaim[] {
  const statuses: MockClaimStatus[] = [
    'OPEN', 'OPEN', 'IN_PROGRESS', 'OPEN', 'RESOLVED', 'OPEN', 'IN_PROGRESS', 'RESOLVED',
  ];
  return Array.from({ length: 26 }, (_, i) => {
    const seed = CLAIM_SEEDS[i % CLAIM_SEEDS.length];
    const statement = statuses[i % statuses.length];
    return {
      claimId: 26 - i,
      cycleId: `DJ-1${String((i * 7) % 90).padStart(4, '0')}`,
      nickname: CLAIM_NICKNAMES[i % CLAIM_NICKNAMES.length],
      tag: seed.tag,
      content: seed.content,
      statement,
      adminContent: statement === 'RESOLVED' ? '점검 완료 후 재배치했습니다.' : null,
      reportCnt: (i * 3) % 6,
      // 최신 제보가 위로 오게 약 하루 간격으로 과거로 펼친다
      createdAt: new Date(Date.now() - (i * 26 + 3) * 3600_000).toISOString(),
    };
  });
}

function getMockClaims(): MockClaim[] {
  try {
    const raw = localStorage.getItem(ADMIN_CLAIMS_KEY);
    if (raw) return JSON.parse(raw) as MockClaim[];
  } catch {
    // 파싱 실패 시 시드로 초기화
  }
  const seeded = seedClaims();
  setMockClaims(seeded);
  return seeded;
}

function setMockClaims(claims: MockClaim[]) {
  try {
    localStorage.setItem(ADMIN_CLAIMS_KEY, JSON.stringify(claims));
  } catch {
    // 저장 불가 환경 무시
  }
}

/**
 * 관리자 자전거 목업 — CRUD가 없어 저장소 없이 결정적으로 생성한다.
 * 자전거 ID 체계(DJ-1XXXX)는 제보 시드와 같아 자전거 상세의 제보 탭이
 * 제보 관리(msw_admin_claims)와 같은 데이터를 보게 된다.
 */
const CYCLE_COUNT = 90;

function mockCycleId(index: number): string {
  return `DJ-1${String(index).padStart(4, '0')}`;
}

function mockCycleSummary(index: number) {
  const cycleId = mockCycleId(index);
  // 일부는 대여(이동) 중이라 배치 대여소가 없다
  const station = index % 9 === 4 ? null : STATIONS[index % STATIONS.length];
  const openClaimCnt = getMockClaims().filter(
    (c) => c.cycleId === cycleId && c.statement === 'OPEN',
  ).length;
  return {
    cycleId,
    stationId: station?.stationId ?? null,
    stationName: station?.name ?? null,
    statement: index % 9 === 2 ? 'SUSPENDED' : 'ACTIVE',
    openClaimCnt,
    lastUsedAt: new Date(Date.now() - ((index * 97) % 5000) * 60_000).toISOString(),
  };
}

function mockCycleRides(index: number) {
  return Array.from({ length: 10 }, (_, j) => {
    const durationMin = 8 + ((index + j * 5) % 35);
    const end = Date.now() - (j * 13 + index) * 3600_000;
    return {
      rideId: index * 100 + j,
      startAt: new Date(end - durationMin * 60_000).toISOString(),
      endAt: new Date(end).toISOString(),
      fromStation: STATIONS[(index + j) % STATIONS.length].name,
      toStation: STATIONS[(index + j * 3 + 1) % STATIONS.length].name,
      durationMin,
      distanceKm: Number((durationMin * 0.21).toFixed(1)),
    };
  });
}

/**
 * 관리자 사용자 목업 — 사용자 30명은 결정적으로 생성하고,
 * 밴 기록만 저장소(user_ban_records 흉내)에 둔다. 상태(NORMAL/BANNED)는
 * 백엔드처럼 "유효한 밴 기록이 있는가"에서 파생한다.
 */
const ADMIN_USER_BANS_KEY = 'msw_admin_user_bans';
const ADMIN_USER_COUNT = 30;

interface MockBanRecord {
  banId: number;
  userId: number;
  startedAt: string;
  scheduledEndAt: string;
  releasedAt: string | null;
  comment: string | null;
  adminName: string;
}

const USER_NICKNAME_POOL = [
  '달리는거북', '바퀴요정', '자전거덕후', '탄방동주민', '출근라이더',
  '둔산질주', '갑천산책러', '유성불주먹', '주말라이더', '한밭바람',
];

function mockUserNickname(userId: number): string {
  const base = USER_NICKNAME_POOL[userId % USER_NICKNAME_POOL.length];
  return userId <= USER_NICKNAME_POOL.length ? base : `${base}${userId}`;
}

function seedUserBans(): MockBanRecord[] {
  const day = 24 * 3600_000;
  return [
    // 진행 중인 제재 — 목록에서 BANNED로 보이게
    {
      banId: 2,
      userId: 7,
      startedAt: new Date(Date.now() - 2 * day).toISOString(),
      scheduledEndAt: new Date(Date.now() + 5 * day).toISOString(),
      releasedAt: null,
      comment: '허위 제보 반복 접수 (3회)',
      adminName: '운영관리자',
    },
    // 해제된 과거 제재 — 밴 이력 탭에서 이력 예시로
    {
      banId: 1,
      userId: 7,
      startedAt: new Date(Date.now() - 40 * day).toISOString(),
      scheduledEndAt: new Date(Date.now() - 33 * day).toISOString(),
      releasedAt: new Date(Date.now() - 35 * day).toISOString(),
      comment: '방치 신고 허위 작성',
      adminName: '운영관리자',
    },
  ];
}

function getMockUserBans(): MockBanRecord[] {
  try {
    const raw = localStorage.getItem(ADMIN_USER_BANS_KEY);
    if (raw) return JSON.parse(raw) as MockBanRecord[];
  } catch {
    // 파싱 실패 시 시드로 초기화
  }
  const seeded = seedUserBans();
  setMockUserBans(seeded);
  return seeded;
}

function setMockUserBans(records: MockBanRecord[]) {
  try {
    localStorage.setItem(ADMIN_USER_BANS_KEY, JSON.stringify(records));
  } catch {
    // 저장 불가 환경 무시
  }
}

/** 백엔드 findFirstBy…ReleasedAtIsNullAndScheduledEndAtAfter(now)와 같은 판정 */
function activeBanOf(userId: number): MockBanRecord | null {
  const now = Date.now();
  return (
    getMockUserBans().find(
      (b) =>
        b.userId === userId && b.releasedAt === null && new Date(b.scheduledEndAt).getTime() > now,
    ) ?? null
  );
}

function mockUserSummary(userId: number) {
  return {
    userId,
    nickname: mockUserNickname(userId),
    recentUsingAt: new Date(Date.now() - ((userId * 131) % 4000) * 60_000).toISOString(),
    userStatement: activeBanOf(userId) ? 'BANNED' : 'NORMAL',
  };
}

function mockUserRides(userId: number) {
  return Array.from({ length: 8 }, (_, j) => {
    const durationMin = 7 + ((userId + j * 7) % 38);
    const end = Date.now() - (j * 31 + userId * 3) * 3600_000;
    return {
      rideId: userId * 1000 + j,
      startAt: new Date(end - durationMin * 60_000).toISOString(),
      endAt: new Date(end).toISOString(),
      fromStation: STATIONS[(userId + j) % STATIONS.length].name,
      toStation: STATIONS[(userId + j * 5 + 2) % STATIONS.length].name,
      durationMin,
      distanceKm: Number((durationMin * 0.19).toFixed(1)),
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
/**
 * 이미 대여 중인 것으로 취급할 자전거 번호 — 대여 실패 경로를 검증할 때 이 값을 넣는다.
 * QrScanPage의 수동 입력 예시(22B01262)와 일부러 맞췄다 — 그 화면을 참고해 코드를 입력해도
 * 실패 케이스를 재현할 수 있게
 */
const RENTED_CYCLE_IDS = ['22B01262'];

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

export const handlers = [
  // ── 인증 (백엔드 세션 쿠키 방식을 흉내) ─────────────────────────────
  http.get('/api/users/me', async () => {
    await delay(300);
    const state = getAuthState();
    if (!state.loggedIn) return fail(401, '로그인이 필요합니다.');
    return HttpResponse.json(ok({ nickname: state.nickname }));
  }),

  // ── 이동 기록 (22·23 — 백엔드 API 미정, 임시 스키마) ────────────────
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

  // ── 공지사항 (고객센터 — 백엔드 API 미정, 임시 스키마) ──────────────
  // 관리자 공지 저장소를 그대로 읽는다 — 관리자가 등록/삭제하면 여기에도 반영
  http.get('/api/notices', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const notices = [...getMockNotices()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((n) => ({
        id: n.noticeId,
        title: n.title,
        date: n.createdAt.slice(0, 10).replaceAll('-', '/'),
      }));
    return HttpResponse.json(ok(notices));
  }),

  // ── Open API 신청 (자전거 정보 — 백엔드 API 미정, 임시 스키마) ──────
  http.post('/api/open-api/requests', async ({ request }) => {
    await delay(400);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as { purpose?: string; reason?: string };
    if (!body.purpose || !body.reason?.trim()) {
      return fail(400, '활용구분과 신청사유를 입력해 주세요.');
    }
    const requests = getOpenApiRequests();
    requests.unshift({
      id: Date.now(),
      purpose: body.purpose,
      reason: body.reason,
      status: '접수됨',
      createdAt: new Date().toISOString(),
    });
    setOpenApiRequests(requests);
    return HttpResponse.json({ code: 200, message: 'Open API 신청이 접수되었습니다.', data: null });
  }),

  http.get('/api/open-api/requests', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    return HttpResponse.json(ok(getOpenApiRequests()));
  }),

  // ── 공지 팝업 (07-1 — 백엔드 API 미정, 임시 스키마) ───────────────
  // 공지사항 목록과는 별개 데이터. 관리자 페이지에서 따로 CRUD하고, 등록 시 공지사항 하나를
  // 연결할 수 있다(linkedNoticeId). 연결하지 않은 팝업은 눌러도 이동하지 않는다.
  http.get('/api/notice-popups', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    return HttpResponse.json(
      ok([
        { id: 1, imageUrl: placeholderImage('공지 1', '#4c8a12'), linkedNoticeId: 5 },
        { id: 2, imageUrl: placeholderImage('공지 2', '#3c6e0e'), linkedNoticeId: null },
        { id: 3, imageUrl: placeholderImage('공지 3', '#f59e0b'), linkedNoticeId: 4 },
        { id: 4, imageUrl: placeholderImage('공지 4', '#0ea5e9'), linkedNoticeId: null },
        { id: 5, imageUrl: placeholderImage('공지 5', '#7c3aed'), linkedNoticeId: 3 },
      ]),
    );
  }),

  // ── 프로필 (24 — 백엔드 API 미정, 임시 스키마) ─────────────────────
  http.get('/api/users/me/stats', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    return HttpResponse.json(ok({ monthlyRides: 12, distanceKm: 38.2, durationMin: 84 }));
  }),

  http.put('/api/users/me', async ({ request }) => {
    await delay(400);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as { nickname?: string };
    const nickname = body.nickname ?? '';
    if (
      nickname.length < NICKNAME_MIN ||
      nickname.length > NICKNAME_MAX ||
      !NICKNAME_PATTERN.test(nickname)
    ) {
      return fail(400, '닉네임 형식이 올바르지 않습니다.');
    }
    setAuthState({ loggedIn: true, nickname });
    return HttpResponse.json({ code: 200, message: '닉네임이 변경되었습니다.', data: null });
  }),

  // 회원 탈퇴 — 백엔드 API 미정. 계정·데이터를 모두 삭제한다
  http.post('/api/users/withdraw', async () => {
    await delay(500);
    const authFail = requireAuth();
    if (authFail) return authFail;
    setAuthState({ loggedIn: false, nickname: null });
    setMockReports([]);
    setOpenApiRequests([]);
    return HttpResponse.json({ code: 200, message: '탈퇴가 완료되었습니다.', data: null });
  }),

  // 백엔드에 로그아웃 API가 아직 없음 — 확정 시 경로 맞출 것
  http.post('/api/auth/logout', async () => {
    await delay(300);
    setAuthState({ loggedIn: false, nickname: getAuthState().nickname });
    return HttpResponse.json(ok(null));
  }),

  // 실제 백엔드에는 없는 개발용 엔드포인트 — 카카오 OAuth 리다이렉트를 대신함
  http.post('/api/auth/mock-login', async () => {
    await delay(400);
    const state = getAuthState();
    setAuthState({ ...state, loggedIn: true });
    return HttpResponse.json(ok(null));
  }),

  http.post('/api/admin/auth/login', async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as { id?: string; password?: string };
    if (body.id !== MOCK_ADMIN.id || body.password !== MOCK_ADMIN.password) {
      return fail(401, '아이디 또는 비밀번호가 올바르지 않습니다.');
    }
    setAdminLoggedIn(true);
    return HttpResponse.json(ok(null));
  }),

  http.get('/api/admin/auth/me', async () => {
    await delay(200);
    if (!isAdminLoggedIn()) return fail(401, '로그인이 필요합니다.');
    const { password: _password, ...me } = MOCK_ADMIN;
    return HttpResponse.json(ok(me));
  }),

  http.post('/api/admin/auth/logout', async () => {
    await delay(200);
    setAdminLoggedIn(false);
    return HttpResponse.json(ok(null));
  }),

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

  // ── 관리자 제보 관리 (03 — API 전부 미구현, 목업 기준) ─────────────────
  http.get('/api/admin/cycle/claim', async () => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const claims = [...getMockClaims()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(ok(claims));
  }),

  http.patch('/api/admin/cycle/claim/:claimId', async ({ params, request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const body = (await request.json()) as { statement?: MockClaimStatus; content?: string };
    if (!body.statement) return fail(400, '변경할 상태를 선택해 주세요.');
    const claims = getMockClaims();
    const claim = claims.find((c) => c.claimId === Number(params.claimId));
    if (!claim) return fail(404, '존재하지 않는 제보입니다.');
    claim.statement = body.statement;
    claim.adminContent = body.content?.trim() || null;
    setMockClaims(claims);
    return HttpResponse.json(ok(claim));
  }),

  // ── 관리자 사용자 관리 (04·09 — 목록·밴·해제 구현 O(실측 스키마), 상세·이력 미구현) ──
  http.get('/api/admin/user/list', async ({ request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const url = new URL(request.url);
    const statement = url.searchParams.get('statement') ?? '';
    const order = url.searchParams.get('order') ?? 'newest';
    let users = Array.from({ length: ADMIN_USER_COUNT }, (_, i) => mockUserSummary(i + 1));
    if (statement) users = users.filter((u) => u.userStatement === statement);
    users.sort((a, b) =>
      order === 'oldest'
        ? a.recentUsingAt.localeCompare(b.recentUsingAt)
        : b.recentUsingAt.localeCompare(a.recentUsingAt),
    );
    return HttpResponse.json(ok(users));
  }),

  http.post('/api/admin/user/:userId/ban', async ({ params, request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const userId = Number(params.userId);
    if (userId < 1 || userId > ADMIN_USER_COUNT) return fail(404, '존재하지 않는 사용자입니다.');
    const body = (await request.json()) as { scheduledEndAt?: string; comment?: string };
    // 백엔드 @NotNull @Future 검증과 동일
    if (!body.scheduledEndAt || new Date(body.scheduledEndAt).getTime() <= Date.now()) {
      return fail(400, '제재 종료 시각은 미래여야 합니다.');
    }
    if ((body.comment ?? '').length > 100) return fail(400, '사유는 100자 이내여야 합니다.');
    if (activeBanOf(userId)) return fail(409, '이미 제재 중인 사용자입니다.');
    const records = getMockUserBans();
    records.unshift({
      banId: Math.max(0, ...records.map((r) => r.banId)) + 1,
      userId,
      startedAt: new Date().toISOString(),
      scheduledEndAt: body.scheduledEndAt,
      releasedAt: null,
      comment: body.comment?.trim() || null,
      adminName: MOCK_ADMIN.name,
    });
    setMockUserBans(records);
    return HttpResponse.json(ok(null));
  }),

  http.post('/api/admin/user/:userId/un-ban', async ({ params }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const userId = Number(params.userId);
    if (userId < 1 || userId > ADMIN_USER_COUNT) return fail(404, '존재하지 않는 사용자입니다.');
    // 백엔드 releaseActiveBan처럼 유효한 제재에 해제 시각만 기록
    const records = getMockUserBans();
    const active = records.find(
      (b) =>
        b.userId === userId &&
        b.releasedAt === null &&
        new Date(b.scheduledEndAt).getTime() > Date.now(),
    );
    if (active) active.releasedAt = new Date().toISOString();
    setMockUserBans(records);
    return HttpResponse.json(ok(null));
  }),

  http.get('/api/admin/user/:userId/ban-records', async ({ params }) => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const userId = Number(params.userId);
    const records = getMockUserBans()
      .filter((b) => b.userId === userId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return HttpResponse.json(ok(records));
  }),

  http.get('/api/admin/user/:userId', async ({ params }) => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const userId = Number(params.userId);
    if (Number.isNaN(userId) || userId < 1 || userId > ADMIN_USER_COUNT) {
      return fail(404, '존재하지 않는 사용자입니다.');
    }
    const active = activeBanOf(userId);
    return HttpResponse.json(
      ok({
        ...mockUserSummary(userId),
        joinedAt: new Date(Date.now() - (200 + userId * 9) * 24 * 3600_000).toISOString(),
        activeBan: active
          ? { scheduledEndAt: active.scheduledEndAt, comment: active.comment }
          : null,
        totalRides: 12 + ((userId * 11) % 120),
        totalDistanceKm: Number((30 + ((userId * 17) % 260)).toFixed(1)),
        totalDurationMin: 240 + ((userId * 53) % 1800),
        rides: mockUserRides(userId),
      }),
    );
  }),

  // ── 관리자 자전거 관리 (05·07 — 제보 탭 외 구현 O, 응답 형태 임시) ─────
  // ⚠ 고정 경로(list·statics)는 아래 :cycleId 핸들러들보다 먼저 등록한다
  http.get('/api/admin/cycle/list', async () => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const cycles = Array.from({ length: CYCLE_COUNT }, (_, i) => mockCycleSummary(i));
    return HttpResponse.json(ok(cycles));
  }),

  http.get('/api/admin/cycle/statics', async () => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const cycles = Array.from({ length: CYCLE_COUNT }, (_, i) => mockCycleSummary(i));
    return HttpResponse.json(
      ok({
        totalCnt: cycles.length,
        activeCnt: cycles.filter((c) => c.statement === 'ACTIVE').length,
        suspendedCnt: cycles.filter((c) => c.statement === 'SUSPENDED').length,
        claimedCnt: cycles.filter((c) => c.openClaimCnt > 0).length,
      }),
    );
  }),

  http.get('/api/admin/cycle/:cycleId/statics', async ({ params }) => {
    await delay(250);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const index = Number(String(params.cycleId).slice(-4));
    if (Number.isNaN(index) || index >= CYCLE_COUNT) return fail(404, '존재하지 않는 자전거입니다.');
    return HttpResponse.json(
      ok({
        totalRides: 40 + ((index * 7) % 160),
        totalDistanceKm: Number((80 + ((index * 13) % 300) + index / 10).toFixed(1)),
        totalDurationMin: 600 + ((index * 41) % 2400),
      }),
    );
  }),

  http.get('/api/admin/cycle/:cycleId/claim', async ({ params }) => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const cycleId = String(params.cycleId);
    const claims = getMockClaims()
      .filter((c) => c.cycleId === cycleId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(ok(claims));
  }),

  http.get('/api/admin/cycle/:cycleId', async ({ params }) => {
    await delay(350);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const cycleId = String(params.cycleId);
    const index = Number(cycleId.slice(-4));
    if (!/^DJ-1\d{4}$/.test(cycleId) || Number.isNaN(index) || index >= CYCLE_COUNT) {
      return fail(404, '존재하지 않는 자전거입니다.');
    }
    return HttpResponse.json(ok({ ...mockCycleSummary(index), rides: mockCycleRides(index) }));
  }),

  // ── 관리자 공지사항 (06·08 — 목록·상세는 구현 O, 등록·삭제는 구현 X라 목업 기준) ──
  http.get('/api/notice/list', async () => {
    await delay(300);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const notices = [...getMockNotices()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(ok(notices));
  }),

  http.get('/api/notice/:noticeId', async ({ params }) => {
    await delay(250);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const notice = getMockNotices().find((n) => n.noticeId === Number(params.noticeId));
    if (!notice) return fail(404, '존재하지 않는 공지입니다.');
    return HttpResponse.json(ok(notice));
  }),

  http.post('/api/admin/notice', async ({ request }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const body = (await request.json()) as { title?: string; content?: string };
    const title = body.title?.trim() ?? '';
    const content = body.content?.trim() ?? '';
    if (!title || !content) return fail(400, '제목과 내용을 입력해 주세요.');
    if (title.length > 60 || content.length > 2000) {
      return fail(400, '제목 60자, 내용 2000자를 넘을 수 없습니다.');
    }
    const notices = getMockNotices();
    const notice: MockNotice = {
      noticeId: Math.max(0, ...notices.map((n) => n.noticeId)) + 1,
      title,
      content,
      createdAt: new Date().toISOString(),
    };
    notices.unshift(notice);
    setMockNotices(notices);
    return HttpResponse.json(ok(notice));
  }),

  http.delete('/api/admin/notice/:noticeId', async ({ params }) => {
    await delay(400);
    if (!isAdminLoggedIn()) return fail(401, '관리자 로그인이 필요합니다.');
    const notices = getMockNotices();
    const noticeId = Number(params.noticeId);
    if (!notices.some((n) => n.noticeId === noticeId)) {
      return fail(404, '존재하지 않는 공지입니다.');
    }
    setMockNotices(notices.filter((n) => n.noticeId !== noticeId));
    return HttpResponse.json(ok(null));
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

  http.post('/api/auth/sign-up', async ({ request }) => {
    await delay(400);
    const state = getAuthState();
    if (!state.loggedIn) return fail(401, '로그인이 필요합니다.');

    const body = (await request.json()) as { agrees?: string[][]; nickname?: string };
    const agreedCodes = new Set((body.agrees ?? []).map((pair) => pair[0]));
    const requiredOk = TERMS.filter((t) => t.required).every((t) => agreedCodes.has(t.code));
    if (!requiredOk) return fail(400, '필수 약관에 모두 동의하지 않았습니다.');

    const nickname = body.nickname ?? '';
    if (
      nickname.length < NICKNAME_MIN ||
      nickname.length > NICKNAME_MAX ||
      !NICKNAME_PATTERN.test(nickname)
    ) {
      return fail(400, '닉네임 형식이 올바르지 않습니다.');
    }

    setAuthState({ loggedIn: true, nickname });
    return HttpResponse.json({ code: 200, message: '가입에 성공했습니다.', data: null });
  }),

  // ── 민원 (17-x — 백엔드 API 미정, 임시 스키마) ─────────────────────
  http.post('/api/reports', async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as {
      type?: string;
      bikeCode?: string | null;
      tag?: string | null;
      tagDetail?: string | null;
      content?: string;
    };
    if (!body.content?.trim()) return fail(400, '상세내용을 입력해 주세요.');
    const reports = getMockReports();
    reports.unshift({
      id: Date.now(),
      type: body.type ?? 'inquiry',
      bikeCode: body.bikeCode ?? null,
      tag: body.tag ?? null,
      tagDetail: body.tagDetail ?? null,
      content: body.content,
      nickname: getAuthState().nickname ?? '익명',
      status: '접수됨',
      createdAt: new Date().toISOString(),
    });
    setMockReports(reports);
    return HttpResponse.json({ code: 200, message: '민원이 접수되었습니다.', data: null });
  }),

  http.get('/api/reports/my', async () => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    return HttpResponse.json(ok(getMockReports()));
  }),

  // ── 자전거 (18 자전거 상태 — 백엔드 API 미정, 임시 스키마) ──────────
  http.get('/api/bikes/:code', async ({ params }) => {
    await delay(300);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const code = String(params.code);
    const dayMs = 24 * 60 * 60 * 1000;

    // 내가 접수한 고장신고 중 이 자전거에 달린 것 = 제보로 노출
    const myReports = getMockReports()
      .filter((r) => r.type === 'broken' && r.bikeCode === code)
      .map((r) => ({
        tag: r.tag ?? '기타',
        tagDetail: r.tagDetail ?? null,
        content: r.content,
        nickname: r.nickname,
        createdAt: r.createdAt,
      }));

    // 데모용 씨앗 제보 (1로 끝나는 코드는 깨끗한 자전거 — 다이어그램 기본 상태 확인용)
    const seedReports = code.endsWith('1')
      ? []
      : [
          {
            tag: '브레이크',
            tagDetail: null,
            content: '브레이크가 잘 안 잡혀요',
            nickname: '달리는거북',
            createdAt: new Date(Date.now() - 3 * dayMs).toISOString(),
          },
          {
            tag: '타이어',
            tagDetail: null,
            content: '앞바퀴 공기압이 낮아요',
            nickname: '바퀴요정',
            createdAt: new Date(Date.now() - 5 * dayMs).toISOString(),
          },
          {
            tag: '안장',
            tagDetail: null,
            content: '안장 높이가 고정되지 않아요',
            nickname: '둔산라이더',
            createdAt: new Date(Date.now() - 8 * dayMs).toISOString(),
          },
        ];

    return HttpResponse.json(
      ok({
        code,
        rideable: !code.endsWith('0'), // 0으로 끝나는 코드는 점검 필요 상태 (상태 배지 확인용)
        lastUsedAt: new Date(Date.now() - 2 * dayMs).toISOString(),
        lastStationName: '유성구청역 대여소',
        reports: [...myReports, ...seedReports],
      }),
    );
  }),

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

  http.post('/api/cycle/rental', async ({ request }) => {
    await delay(500);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as { cycleId?: string };
    const cycleId = body.cycleId?.trim().toUpperCase();
    if (!cycleId) return fail(400, '자전거 번호를 입력해 주세요.');
    if (RENTED_CYCLE_IDS.includes(cycleId)) {
      return fail(409, '이미 대여 중인 자전거입니다.');
    }
    return HttpResponse.json(ok(new Date().toISOString()));
  }),

  http.post('/api/cycle/return', async ({ request }) => {
    await delay(500);
    const authFail = requireAuth();
    if (authFail) return authFail;
    const body = (await request.json()) as { cycleId?: string; stationId?: string };
    const cycleId = body.cycleId?.trim().toUpperCase();
    if (!cycleId) return fail(400, '자전거 번호를 입력해 주세요.');
    if (!body.stationId || !STATIONS.some((station) => station.stationId === body.stationId)) {
      return fail(404, '존재하지 않는 대여소입니다.');
    }
    if (!RENTED_CYCLE_IDS.includes(cycleId)) {
      return fail(409, '대여 중인 자전거가 아닙니다.');
    }
    return HttpResponse.json(ok(new Date().toISOString()));
  }),
];
