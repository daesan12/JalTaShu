import { apiGet, apiPost } from '@/shared/api/client';

/**
 * 이동 기록 — 백엔드 실구현(CycleController /cycle/usage·statics) 스키마.
 * 좌표는 {latitude, longitude}로 오고 대여소 이름은 없다(전달 목록) —
 * 화면은 지도 대여소 목록과 좌표를 대조해 이름을 복원한다(lib/usageDisplay).
 */

export interface UsagePoint {
  latitude: number;
  longitude: number;
}

/** 경로 한 점 — 저장할 때(POST /cycle/usage)와 같은 PathInfo 형식 */
export type UsageTravelStatus = 'WALK1' | 'BIKE' | 'WALK2';

export interface UsagePathPoint {
  latitude: number;
  longitude: number;
  altitude: number;
  travelStatus: UsageTravelStatus;
  seq: number;
}

/**
 * GET /cycle/statics (CycleStatisticsResponse 실측) — 거리 m, 시간 초.
 * 거리는 **null일 수 있다** — 경로 거리가 없는 기록(QR로만 대여·반납)이 하나라도 있으면
 * 서버는 합계를 "미확정"으로 비운다. 0으로 찍으면 거짓이므로 화면은 "–"로 보여 준다.
 */
export interface UsageStats {
  totalUseCnt: number;
  totalDistance: number | null;
  totalCycleRidingTime: number;
}

/**
 * GET /cycle/usage/list 한 건 (CycleUsageListResponse 실측) — totalDuration은 초.
 * 출발·도착 좌표는 **null일 수 있다** — 경로 안내 없이 QR로 대여·반납만 한 기록은 좌표가 없다
 * (실서버 확인: 이 값을 있다고 믿고 읽다 이동 기록 탭이 통째로 죽었다).
 */
export interface UsageSummary {
  usageId: number;
  startingPoint: UsagePoint | null;
  endPoint: UsagePoint | null;
  startingDate: string;
  totalDuration: number;
  cycleId: string;
}

/** GET /cycle/usage/{usageId} (CycleUsageDetailResponse 실측) — 경로를 저장하지 않은 기록은 path 계열이 null */
export interface UsageDetail {
  totalDuration: number;
  totalDistance: number | null;
  startingPoint: UsagePoint | null;
  endPoint: UsagePoint | null;
  startingDate: string;
  cycleId: string;
  averageCycleRidingSpeed: number | null;
  pathInfo: { road: UsagePathPoint[] } | null;
  cycleRidingStartTime: string | null;
  cycleRidingEndTime: string | null;
}

export function getUsageStats(): Promise<UsageStats> {
  return apiGet<UsageStats>('/cycle/statics');
}

export function getUsageList(): Promise<UsageSummary[]> {
  return apiGet<UsageSummary[]>('/cycle/usage/list');
}

export function getUsageDetail(usageId: string): Promise<UsageDetail> {
  return apiGet<UsageDetail>(`/cycle/usage/${usageId}`);
}

/**
 * 안내가 끝난 경로를 이용 기록에 붙인다 — 백엔드 `POST /cycle/usage`.
 *
 * 반납 응답으로 받은 usageId를 함께 보내 정확한 이용 기록에 연결한다.
 * 다른 사용자의 이용이거나(NOT_EXIST_USAGE), 반납 전이거나, 이미 경로가 저장된
 * 기록이면 실패한다 — 호출한 쪽이 실패를 삼키지 말고 알려야 한다.
 */
export interface SaveUsagePathInput {
  /** 반납 응답으로 받은 이용 기록 ID */
  cycleUsageId: number;
  pathInfo: { road: UsagePathPoint[] };
  /** 안내 시작·종료 시각 (ISO 8601) */
  createdAt: string;
  finishedAt: string;
  /** 미터, 0 이상. 자전거 거리는 전체 거리를 넘을 수 없다(서버 검증) */
  totalDistance: number;
  bikeDistance: number;
}

export function saveUsagePath(input: SaveUsagePathInput): Promise<null> {
  return apiPost<null>('/cycle/usage', input);
}
