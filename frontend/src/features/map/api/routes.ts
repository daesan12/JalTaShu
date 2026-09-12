import { apiGet } from '@/shared/api/client';
import type { Pos, RoutePath } from '@/shared/api/types';

/**
 * 백엔드 `GET /map/path` — 출발·목적지만 보내고 **경로 후보를 전부** 받는다(2026-09-13 결정).
 * 오르막 적게·확보 우선 같은 정렬·필터는 서버에 보내지 않고 10 화면의 칩이 프론트에서 처리한다.
 * 출발 시각도 보내지 않는다(지금 출발 기준). 시각을 바꾸는 기능은 서버 재계산이 필요해 월요일 안건.
 * ⚠ 파라미터 이름은 9/14 백엔드 확인 전 프론트 가정 — 바뀌면 이 파일만 고친다.
 */
export interface RoutePathRequest {
  start: Pos;
  end: Pos;
}

export function getRoutePaths({ start, end }: RoutePathRequest) {
  return apiGet<RoutePath[]>('/map/path', {
    params: {
      startXPos: start.xPos,
      startYPos: start.yPos,
      endXPos: end.xPos,
      endYPos: end.yPos,
    },
  });
}
