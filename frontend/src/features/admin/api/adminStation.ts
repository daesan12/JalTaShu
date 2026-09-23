import { apiGet } from '@/shared/api/client';

/**
 * 02 대여소 상세 — 백엔드 실구현(AdminCycleController) 스키마.
 * 이름·주소·거치대 수·배치 자전거 목록은 응답에 없다(백엔드 전달 목록).
 * 401은 관리자 가드가 처리(skipAuthRedirect).
 */

/** GET /admin/station/{stationId} (AdminStationDetailResponse 실측) — yesterday*는 24시간 전 기준 */
export interface AdminStationDetail {
  currentBikeCnt: number;
  todayRentalCnt: number;
  todayReturnCnt: number;
  /** 미해결 제보 수 */
  currentReportCnt: number;
  yesterdayBikeCnt: number;
  yesterdayRentalCnt: number;
  yesterdayReturnCnt: number;
  yesterdayReportCnt: number;
}

/** GET /admin/station/trend?stationId=&term= 의 한 점 — 오늘은 제외 */
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

/**
 * 지정한 대여소의 최근 7일 추이. term은 day|week.
 */
export function getAdminStationTrend(stationId: string): Promise<StationTrendPoint[]> {
  const query = new URLSearchParams({ stationId, term: 'week' });
  return apiGet<StationTrendPoint[]>(`/admin/station/trend?${query.toString()}`, {
    skipAuthRedirect: true,
  });
}
