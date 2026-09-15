import { apiPost } from '@/shared/api/client';

/**
 * 자전거 대여 요청 — 백엔드 `POST /api/cycle/rental`.
 * 실제 타슈처럼 "대여하기를 먼저 누르고 그다음 자전거를 확인"하는 순서다(방금 확인). 확인 방식은
 * QR이 정석이지만 카메라 화면은 경호님 `features/rental`(`useQrScanner`)이 이미 갖고 있어
 * 이번 이슈는 번호 직접 입력으로 간다. QR과 합치는 건 그 화면을 재사용하는 후속 이슈.
 */
export interface RentCycleRequest {
  cycleId: string;
}

/** 성공 시 대여 시작 시각(ISO 8601)을 돌려준다 */
export function rentCycle({ cycleId }: RentCycleRequest): Promise<string> {
  return apiPost<string>('/cycle/rental', { cycleId });
}

/**
 * 자전거 반납 요청 — 백엔드 `POST /api/cycle/return`.
 * 대여와 달리 반납할 대여소(`stationId`)가 필요하다. 07 대여소 마커를 눌러 그 시트가 열린
 * 상태에서 반납하는 흐름이라, `stationId`는 지금 열려 있는 대여소 시트의 대여소로 정해진다
 * (따로 검색해서 고르지 않는다).
 */
export interface ReturnCycleRequest {
  cycleId: string;
  stationId: string;
}

/** 성공 시 반납 시각(ISO 8601)을 돌려준다 */
export function returnCycle({ cycleId, stationId }: ReturnCycleRequest): Promise<string> {
  return apiPost<string>('/cycle/return', { cycleId, stationId });
}
