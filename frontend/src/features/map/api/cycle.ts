import { apiGet, apiPost } from '@/shared/api/client';

/**
 * 자전거 대여 요청 — 백엔드 `POST /api/cycle/rental`.
 * 현재 좌표와 가장 가까운 대여소를 함께 보낸다.
 */
export interface RentCycleRequest {
  cycleId: string;
  /**
   * 출발 대여소 — 현재 위치에서 가장 가까운 대여소.
   * 서버는 처음 보는 자전거를 이때 등록한다.
   */
  stationId: string;
  latitude: number;
  longitude: number;
}

/** 성공 시 대여 시작 시각(ISO 8601)을 돌려준다 */
export function rentCycle(request: RentCycleRequest): Promise<string> {
  return apiPost<string>('/cycle/rental', request);
}

/**
 * 자전거 반납 요청 — 백엔드 `POST /api/cycle/return`.
 * 현재 위치에서 가장 가까운 대여소와 현재 좌표를 함께 보낸다.
 */
export interface ReturnCycleRequest {
  cycleId: string;
  stationId: string;
  latitude: number;
  longitude: number;
}

export interface CycleReturnResult {
  cycleUsageId: number;
  /** 반납 시각(ISO 8601) */
  returnedAt: string;
}

/** 성공 시 경로를 정확한 이용 기록에 연결할 ID와 반납 시각을 돌려준다. */
export function returnCycle(request: ReturnCycleRequest): Promise<CycleReturnResult> {
  return apiPost<CycleReturnResult>('/cycle/return', request);
}

export interface CurrentRental {
  cycleId: string;
  /** 대여 시각(ISO 8601) */
  rentedAt: string;
}

export const CURRENT_RENTAL_QUERY_KEY = ['cycle', 'rental', 'current'] as const;

/**
 * 지금 반납하지 않은 대여 — 백엔드 `GET /api/cycle/rental/current`. 없으면 null.
 * 앱이 기억한 "빌린 자전거"(localStorage)는 다른 기기에서 반납했거나, 다른 계정으로 바꿨거나,
 * 앱 데이터를 지우면 서버와 어긋난다. 이 값으로 맞춘다.
 */
export function getCurrentRental(): Promise<CurrentRental | null> {
  return apiGet<CurrentRental | null>('/cycle/rental/current');
}
