import { apiGet, apiPost } from '@/shared/api/client';
import type { PlaceSearchResult } from '@/shared/api/types';

/** 최근 검색 표시 개수 — 백엔드 `limit` 파라미터로 그대로 보낸다 */
export const RECENT_PLACES_LIMIT = 10;

export const RECENT_PLACES_QUERY_KEY = ['map', 'recent-places'] as const;

export function placeSearchQueryKey(query: string) {
  return ['map', 'places', query] as const;
}

/** 08 장소 검색 — 백엔드 `GET /map?query=`. 네이버 지역검색 상한이 5건이라 최대 5건 */
export function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  return apiGet<PlaceSearchResult[]>('/map', { params: { query } });
}

/** 최근 고른 장소 — 백엔드 `GET /map/recent?limit=` (세션 사용자 기준, 최신순) */
export function getRecentPlaces(): Promise<PlaceSearchResult[]> {
  return apiGet<PlaceSearchResult[]>('/map/recent', { params: { limit: RECENT_PLACES_LIMIT } });
}

/** 결과에서 장소를 고른 시점에 저장 — 백엔드 `POST /map/location/recent` */
export function saveRecentPlace(place: PlaceSearchResult): Promise<void> {
  return apiPost<void>('/map/location/recent', place);
}

/**
 * 서버는 고를 때마다 한 줄씩 쌓으므로(중복 제거 여부는 9/14 확인) 표시할 때 같은 장소를 하나로 합친다.
 * 이름과 좌표가 모두 같아야 같은 장소로 본다. 최신순 입력이 들어오므로 먼저 본 것을 남긴다.
 */
export function dedupePlaces(places: PlaceSearchResult[]): PlaceSearchResult[] {
  const seen = new Set<string>();
  const result: PlaceSearchResult[] = [];
  for (const place of places) {
    const key = `${place.title}|${place.xPos}|${place.yPos}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(place);
  }
  return result;
}
