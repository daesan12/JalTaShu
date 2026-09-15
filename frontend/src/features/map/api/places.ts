import { apiDelete, apiGet, apiPost } from '@/shared/api/client';
import type { PlaceSearchResult, RecentPlace } from '@/shared/api/types';

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
export function getRecentPlaces(): Promise<RecentPlace[]> {
  return apiGet<RecentPlace[]>('/map/recent', { params: { limit: RECENT_PLACES_LIMIT } });
}

/** 결과에서 장소를 고른 시점에 저장 — 백엔드 `POST /map/location/recent` */
export function saveRecentPlace(place: PlaceSearchResult): Promise<void> {
  return apiPost<void>('/map/location/recent', place);
}

/** 최근 검색 한 건 삭제 — 백엔드 `DELETE /map/recent/{recentPlaceId}` */
export function deleteRecentPlace(placeId: number): Promise<void> {
  return apiDelete<void>(`/map/recent/${placeId}`);
}

/**
 * 화면에 보여줄 최근 검색 한 그룹 — 같은 장소로 합쳐진 서버 행들의 id를 전부 들고 있는다.
 * 이 그룹을 지우면 `placeIds` 전부를 삭제해야 방금 지운 항목이 그대로 남아 보이지 않는다.
 */
export interface DedupedRecentPlace extends PlaceSearchResult {
  placeIds: number[];
}

/**
 * 서버는 고를 때마다 한 줄씩 쌓으므로(중복 제거 여부는 백엔드 확인 중) 표시할 때 같은 장소를 하나로
 * 합친다. 이름과 좌표가 모두 같아야 같은 장소로 본다. 최신순 입력이 들어오므로 먼저 본 것(가장 최근
 * 것)의 정보를 남기고, 그 장소의 다른 행 id는 `placeIds`에 계속 추가한다.
 */
export function dedupePlaces(places: RecentPlace[]): DedupedRecentPlace[] {
  const order: string[] = [];
  const grouped = new Map<string, DedupedRecentPlace>();
  for (const place of places) {
    const key = `${place.title}|${place.xPos}|${place.yPos}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.placeIds.push(place.placeId);
      continue;
    }
    order.push(key);
    grouped.set(key, { ...place, placeIds: [place.placeId] });
  }
  return order.map((key) => grouped.get(key) as DedupedRecentPlace);
}
