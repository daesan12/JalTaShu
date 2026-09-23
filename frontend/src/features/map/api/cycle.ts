import { apiPost } from '@/shared/api/client';

/**
 * 자전거 대여 요청 — 백엔드 `POST /api/cycle/rental`.
 * 현재 좌표와 가장 가까운 대여소를 함께 보내며, 서버가 두 좌표의 300m 제한을 다시 검증한다.
 */
export interface RentCycleRequest {
  cycleId: string;
  /**
   * 출발 대여소 — 현재 위치에서 300m 안에 있는 가장 가까운 대여소.
   * 서버는 처음 보는 자전거를 이때 등록하고, 현재 좌표로 거리 조건을 검증한다.
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
 * 현재 위치에서 300m 안에 있는 가장 가까운 대여소와 현재 좌표를 함께 보낸다.
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
