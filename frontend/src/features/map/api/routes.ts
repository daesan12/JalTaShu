import { apiGet } from '@/shared/api/client';
import type { PathResponse, Pos, RouteCandidate } from '@/shared/api/types';

/**
 * 백엔드 `GET /map/path` — 출발·목적지만 보내고 **경로 후보를 전부** 받는다(방법 B).
 * 정렬·라벨은 10 화면이 프론트에서 처리한다. 출발 시각도 보내지 않는다(항상 "지금 출발").
 *
 * ⚠ 이 API만 좌표를 **이름으로** 구분한다(`startLat`·`startLng`). 프로젝트의 다른 API는
 * `xPos`=경도·`yPos`=위도라, 여기서 `Pos`를 그대로 펼치면 위도·경도가 뒤바뀐다.
 */
export interface RoutePathRequest {
  start: Pos;
  end: Pos;
}

/** 응답은 `{routes:[...]}` 한 겹에 싸여 오므로 화면이 쓰기 좋게 배열만 돌려준다 */
export async function getRoutePaths({ start, end }: RoutePathRequest): Promise<RouteCandidate[]> {
  const res = await apiGet<PathResponse>('/map/path', {
    params: {
      startLat: start.yPos,
      startLng: start.xPos,
      endLat: end.yPos,
      endLng: end.xPos,
    },
  });
  return res.routes;
}
