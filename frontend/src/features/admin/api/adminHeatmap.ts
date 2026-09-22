import { apiGet } from '@/shared/api/client';

/**
 * GET /admin/heatmap?datetime= 응답 한 점 (AdminHeatmapResponse 실측).
 * 서버는 **기준 시각 직전 1시간**을 대여소별로 집계해 준다 — 하루치가 아니다.
 * 시간 슬라이더·재생은 시간대마다 이 API를 다시 부른다(react-query 캐시로 재생을 매끄럽게).
 */
export interface HeatmapPoint {
  /** 조회 기준 시각 (ISO 8601) — 요청한 datetime이 그대로 온다 */
  time: string;
  stationId: string;
  /** 경도 */
  xPos: number;
  /** 위도 */
  yPos: number;
  rentCnt: number;
  returnCnt: number;
}

/**
 * date(YYYY-MM-DD)와 hour(0~23)로 "그 시각 정각 기준 직전 1시간" 스냅샷을 받는다.
 * 401은 RequireAdminAuth 가드가 처리하므로 전역(모바일 로그인) 리다이렉트에서 제외한다.
 */
export function getAdminHeatmap(date: string, hour: number): Promise<HeatmapPoint[]> {
  const datetime = `${date}T${String(hour).padStart(2, '0')}:00:00`;
  return apiGet<HeatmapPoint[]>(`/admin/heatmap?datetime=${encodeURIComponent(datetime)}`, {
    skipAuthRedirect: true,
  });
}
