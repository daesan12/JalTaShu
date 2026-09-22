import type { PlaceSearchResult, RouteCandidate } from '@/shared/api/types';

export interface RecommendedCourseWaypoint {
  name: string;
  xPos: number;
  yPos: number;
}

export interface RecommendedCourseRoute {
  id: string;
  name: string;
  waypoints: RecommendedCourseWaypoint[];
  route: RouteCandidate;
}

const cache = new Map<string, Promise<RecommendedCourseRoute>>();

function isCourseRoute(value: unknown): value is RecommendedCourseRoute {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<RecommendedCourseRoute>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.waypoints) &&
    candidate.waypoints.length >= 2 &&
    typeof candidate.route === 'object' &&
    candidate.route !== null
  );
}

/**
 * 서버 A의 자전거 OSRM으로 미리 계산해 둔 추천 코스를 읽는다.
 * 런타임 API가 아니라 정적 파일이므로 로컬 MSW에서도 실제 도로 경로가 그대로 보인다.
 */
export function getRecommendedCourseRoute(courseId: string): Promise<RecommendedCourseRoute> {
  const cached = cache.get(courseId);
  if (cached !== undefined) return cached;

  const request = fetch(`${import.meta.env.BASE_URL}recommended-routes/${courseId}.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error('추천 코스 파일을 불러오지 못했습니다.');
      const value: unknown = await response.json();
      if (!isCourseRoute(value) || value.id !== courseId) {
        throw new Error('추천 코스 파일 형식이 올바르지 않습니다.');
      }
      return value;
    })
    .catch((error) => {
      cache.delete(courseId);
      throw error;
    });
  cache.set(courseId, request);
  return request;
}

export function waypointToPlace(waypoint: RecommendedCourseWaypoint): PlaceSearchResult {
  return {
    title: waypoint.name,
    address: '',
    roadAddress: '',
    xPos: waypoint.xPos,
    yPos: waypoint.yPos,
  };
}
