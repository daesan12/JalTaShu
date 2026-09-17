import { apiGet } from '@/shared/api/client';

/**
 * 02 대여소 상세 — API 명세상 둘 다 구현 O이지만 응답 형태를 못 봐 임시 스키마.
 * 연동 단계에서 실제 응답과 대조한다. 401은 관리자 가드가 처리(skipAuthRedirect).
 */

/** 배치 자전거 한 대 */
export interface AdminStationCycle {
  cycleId: string;
  /** 서버 enum을 화면 라벨로 바꾸는 건 각 화면에서 — 목업은 라벨을 그대로 준다 */
  statement: '정상' | '정지';
  lastUsedAt: string;
}

/** GET /admin/station/{stationId} */
export interface AdminStationDetail {
  stationId: string;
  name: string;
  address: string;
  /** 거치대 수 */
  rackCnt: number;
  /** 현재 배치 자전거 수 */
  cycleCnt: number;
  todayRentCnt: number;
  yesterdayRentCnt: number;
  todayReturnCnt: number;
  yesterdayReturnCnt: number;
  cycles: AdminStationCycle[];
}

/** GET /admin/station/trend?stationId=&term= 의 한 점 (인수인계 문서의 응답 필드 그대로) */
export interface StationTrendPoint {
  /** YYYY-MM-DD */
  date: string;
  rentalCnt: number;
  returnCnt: number;
}

export function getAdminStation(stationId: string): Promise<AdminStationDetail> {
  return apiGet<AdminStationDetail>(`/admin/station/${encodeURIComponent(stationId)}`, {
    skipAuthRedirect: true,
  });
}

/** 최근 7일 추이 — 인수인계 경로가 /admin/station/trend?term= 이라 대여소는 쿼리로 가정 */
export function getAdminStationTrend(stationId: string): Promise<StationTrendPoint[]> {
  return apiGet<StationTrendPoint[]>(
    `/admin/station/trend?stationId=${encodeURIComponent(stationId)}&term=week`,
    { skipAuthRedirect: true },
  );
}
