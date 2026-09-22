import { apiPost } from '@/shared/api/client';

/**
 * 자전거 대여 요청 — 백엔드 `POST /api/cycle/rental`.
 * 실제 타슈처럼 "대여하기를 먼저 누르고 그다음 자전거를 확인"하는 순서다(방금 확인). 확인 방식은
 * QR이 정석이지만 카메라 화면은 경호님 `features/rental`(`useQrScanner`)이 이미 갖고 있어
 * 이번 이슈는 번호 직접 입력으로 간다. QR과 합치는 건 그 화면을 재사용하는 후속 이슈.
 */
export interface RentCycleRequest {
  cycleId: string;
  /**
   * 출발 대여소 — 현재 위치에서 가장 가까운 대여소(`nearestStationId`).
   * 서버는 처음 보는 자전거를 이때 등록하는데(지연 등록), 그 자전거가 어느 대여소에 있었는지는
   * 이 값으로만 알 수 있다. 위치 권한이 없으면 생략하고, 그때는 출발 대여소 없이 대여만 된다.
   */
  stationId?: string;
}

/** 성공 시 대여 시작 시각(ISO 8601)을 돌려준다 */
export function rentCycle({ cycleId, stationId }: RentCycleRequest): Promise<string> {
  return apiPost<string>('/cycle/rental', { cycleId, stationId });
}

/**
 * 자전거 반납 요청 — 백엔드 `POST /api/cycle/return`.
 * 대여와 달리 `stationId`가 필수다. 대여와 같은 방식으로 현재 위치에서 가장 가까운 대여소를
 * 고르고(`nearestStationId`), 위치를 못 얻었을 때만 열려 있던 대여소 시트의 대여소로 돌아간다.
 */
export interface ReturnCycleRequest {
  cycleId: string;
  stationId: string;
}

/** 성공 시 반납 시각(ISO 8601)을 돌려준다 */
export function returnCycle({ cycleId, stationId }: ReturnCycleRequest): Promise<string> {
  return apiPost<string>('/cycle/return', { cycleId, stationId });
}
