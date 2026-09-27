import { apiGet } from '@/shared/api/client';

/**
 * 대여소별 하루 이용 합계 한 줄 (#149).
 *
 * 기간 집계 API(`/admin/station/usage`)가 백엔드에 없어서, 이미 있는 히트맵 API를 쓴다.
 * 히트맵은 **기준 시각 직전 1시간**만 집계하므로 하루를 24번 나눠 불러 대여소별로 더한다.
 * 그 시간에 기록이 없는 대여소는 응답에 없다(INNER JOIN) — 하루 내내 0건이면 목록에서 빠진다.
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

/** GET /admin/heatmap?datetime= 응답 한 점 (AdminHeatmapResponse 실측) */
interface HeatmapPoint extends StationUsage {
  /** 조회 기준 시각 — 요청한 datetime이 그대로 온다 */
  time: string;
}

/** 하루(date 00:00~24:00)를 덮는 기준 시각 24개 — 01:00 … 23:00, 다음 날 00:00 */
export function hourlyDatetimes(date: string): string[] {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const nextDate = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
  return Array.from({ length: 24 }, (_, i) =>
    i < 23 ? `${date}T${pad(i + 1)}:00:00` : `${nextDate}T00:00:00`,
  );
}

/**
 * date(KST, YYYY-MM-DD) 하루의 대여소별 대여·반납 합계.
 * 24번을 한꺼번에 보내고, 하나라도 실패하면 전체 실패로 본다(일부만 더한 숫자를 보여 주지 않는다).
 * 401은 RequireAdminAuth 가드가 처리하므로 전역(모바일 로그인) 리다이렉트에서 제외한다.
 */
export async function getStationUsage(date: string): Promise<StationUsage[]> {
  const hours = await Promise.all(
    hourlyDatetimes(date).map((datetime) =>
      apiGet<HeatmapPoint[]>('/admin/heatmap', {
        params: { datetime },
        skipAuthRedirect: true,
      }),
    ),
  );
  const byStation = new Map<string, StationUsage>();
  for (const point of hours.flat()) {
    const row = byStation.get(point.stationId);
    if (row) {
      row.rentCnt += point.rentCnt;
      row.returnCnt += point.returnCnt;
    } else {
      byStation.set(point.stationId, {
        stationId: point.stationId,
        stationName: point.stationName,
        xPos: point.xPos,
        yPos: point.yPos,
        rentCnt: point.rentCnt,
        returnCnt: point.returnCnt,
      });
    }
  }
  return [...byStation.values()];
}
