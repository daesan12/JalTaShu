import { apiGet } from '@/shared/api/client';

/**
 * GET /admin/heatmap?date= 응답 한 점 — 시간대 × 대여소.
 * API 명세상 구현 O. 인수인계 문서의 필드 그대로이나 실제 응답과 대조 필요(연동 단계).
 */
export interface HeatmapPoint {
  /** 시간대 (0~23시) */
  time: number;
  stationId: string;
  /** 경도 */
  xPos: number;
  /** 위도 */
  yPos: number;
  rentCnt: number;
  returnCnt: number;
}

/**
 * 하루치 전체(시간 24 × 대여소)를 한 번에 받는다.
 * 슬라이더·재생은 프론트에서 time으로 필터링 — 시간대마다 재요청하면 재생이 끊긴다.
 * 401은 RequireAdminAuth 가드가 처리하므로 전역(모바일 로그인) 리다이렉트에서 제외한다.
 */
export function getAdminHeatmap(date: string): Promise<HeatmapPoint[]> {
  return apiGet<HeatmapPoint[]>(`/admin/heatmap?date=${encodeURIComponent(date)}`, {
    skipAuthRedirect: true,
  });
}
