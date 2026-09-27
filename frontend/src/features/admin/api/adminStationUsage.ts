import { apiGet } from '@/shared/api/client';

/**
 * 대여소별 기간 집계 한 줄 — `GET /admin/station/usage?from=&to=` (#147).
 *
 * ⚠ **백엔드 미구현 — 요청한 스키마로 가정했다.** 기존 히트맵 응답(`AdminHeatmapResponse`)에서
 * `time`만 뺀 모양이다. 실제 응답이 오면 이 파일만 맞춘다.
 * 이용이 0건인 대여소도 목록에 보여야 해서, 서버가 전체 대여소를 0건과 함께 주도록 요청했다
 * (지금 히트맵 쿼리는 INNER JOIN이라 0건이면 빠진다).
 */
export interface StationUsage {
  stationId: string;
  stationName: string;
  /** 경도 */
  xPos: number;
  /** 위도 */
  yPos: number;
  rentCnt: number;
  returnCnt: number;
}

/** from·to는 KST 날짜(YYYY-MM-DD)이고 **양 끝을 모두 포함**한다. 오늘만 볼 때는 from=to=오늘 */
export function getStationUsage(from: string, to: string): Promise<StationUsage[]> {
  return apiGet<StationUsage[]>('/admin/station/usage', {
    params: { from, to },
    skipAuthRedirect: true,
  });
}
