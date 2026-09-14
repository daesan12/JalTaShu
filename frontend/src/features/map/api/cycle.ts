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
