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

/** GET /cycle/statics (CycleStatisticsResponse 실측) — 거리 m, 시간 초 */
export interface UsageStats {
  totalUseCnt: number;
  totalDistance: number;
  totalCycleRidingTime: number;
}

/** GET /cycle/usage/list 한 건 (CycleUsageListResponse 실측) — totalDuration은 초 */
export interface UsageSummary {
  usageId: number;
  startingPoint: UsagePoint;
  endPoint: UsagePoint;
  startingDate: string;
  totalDuration: number;
  cycleId: string;
}

/** GET /cycle/usage/{usageId} (CycleUsageDetailResponse 실측) — 경로를 저장하지 않은 기록은 path 계열이 null */
export interface UsageDetail {
  totalDuration: number;
  totalDistance: number | null;
  startingPoint: UsagePoint;
  endPoint: UsagePoint;
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
 * 서버가 **가장 최근에 반납한 이용 기록**에 알아서 붙이므로 usageId를 보내지 않는다.
 * 그래서 이 앱으로 대여·반납하지 않았거나(NOT_EXIST_USAGE) 이미 경로가 저장된
 * 기록이면(PATH_ALREADY_EXISTS) 실패한다 — 호출한 쪽이 실패를 삼키지 말고 알려야 한다.
 */
export interface SaveUsagePathInput {
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
