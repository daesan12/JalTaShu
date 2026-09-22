import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { RouteCandidate } from '@/shared/api/types';
import { routeLatLngs } from '@/features/map/lib/routeSegments';
import { loadNaverMaps, subscribeMapAuthFailure } from '@/features/map/lib/naverMaps';
import { DAEJEON_CENTER, DEFAULT_ZOOM } from '@/features/map/lib/mapDefaults';
import type { RecommendedRouteLocationState } from '@/features/map/lib/recommendedRouteIntent';
import { getRecommendedCourseRoute } from '@/features/mypage/api/recommendedCourseRoutes';
import { readCssToken } from '@/shared/lib/cssToken';

interface CourseRoutePreviewProps {
  courseId: string;
  startQuery: string;
  endQuery: string;
}

function CourseMapCanvas({ route }: { route: RouteCandidate }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<naver.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let instance: naver.maps.Map | null = null;
    let cancelled = false;
    void loadNaverMaps().then((result) => {
      if (cancelled) return;
      if (!result.ok || containerRef.current === null) {
        setFailed(true);
        return;
      }
      instance = new result.maps.Map(containerRef.current, {
        center: new result.maps.LatLng(DAEJEON_CENTER.lat, DAEJEON_CENTER.lng),
        zoom: DEFAULT_ZOOM,
        draggable: false,
        scrollWheel: false,
        pinchZoom: false,
        keyboardShortcuts: false,
        disableDoubleClickZoom: true,
      });
      setMap(instance);
    });
    return () => {
      cancelled = true;
      instance?.destroy();
      setMap(null);
    };
  }, []);

  useEffect(() => subscribeMapAuthFailure(() => setFailed(true)), []);

  useEffect(() => {
    if (map === null) return;
    const points = routeLatLngs(route).map(({ lat, lng }) => new naver.maps.LatLng(lat, lng));
    if (points.length === 0) return;
    const line = new naver.maps.Polyline({
      map,
      path: points,
      strokeColor: readCssToken('--color-primary'),
      strokeWeight: 6,
      strokeOpacity: 0.92,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      clickable: false,
    });
    map.fitBounds(points, { top: 30, right: 26, bottom: 30, left: 26 });
    return () => line.setMap(null);
  }, [map, route]);

  return (
    <div className="relative h-56 overflow-hidden rounded-[22px] bg-background">
      <div
        ref={containerRef}
        className="size-full"
        aria-label="추천 코스 전체 경유지 경로 지도"
      />
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background px-8 text-center text-sm text-muted">
          지도를 불러오지 못했습니다. 지도 탭에서 다시 확인해 주세요.
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between text-[11px] font-bold">
        <span className="rounded-full bg-surface/95 px-3 py-1.5 text-primary shadow-sm backdrop-blur">
          출발
        </span>
        <span className="rounded-full bg-surface/95 px-3 py-1.5 text-ink shadow-sm backdrop-blur">
          도착
        </span>
      </div>
    </div>
  );
}

export function CourseRoutePreview({ courseId, startQuery, endQuery }: CourseRoutePreviewProps) {
  const navigate = useNavigate();
  const routeQuery = useQuery({
    queryKey: ['recommended-course', 'static-route', courseId],
    queryFn: () => getRecommendedCourseRoute(courseId),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const route = routeQuery.data?.route ?? null;
  const loading = routeQuery.isLoading;
  const error = routeQuery.isError || (!loading && route === null);

  function openOnMap() {
    if (route === null) return;
    const state: RecommendedRouteLocationState = {
      recommendedRoute: { courseId },
    };
    navigate('/', { state });
  }

  return (
    <section className="mt-6" aria-labelledby="course-map-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-primary">ROUTE PREVIEW</p>
          <h3 id="course-map-heading" className="mt-1 text-[17px] font-bold text-ink">
            전체 코스 경로
          </h3>
        </div>
        <p className="text-right text-[11px] leading-relaxed text-muted">
          실제 도로 기준
          <br />
          경로 미리보기
        </p>
      </div>

      {loading ? (
        <div className="flex h-56 animate-pulse items-center justify-center rounded-[22px] bg-background text-sm text-muted">
          경로를 불러오는 중이에요
        </div>
      ) : route !== null ? (
        <CourseMapCanvas route={route} />
      ) : (
        <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-[22px] bg-background px-8 text-center">
          <p className="text-sm leading-relaxed text-muted">코스 경로를 불러오지 못했습니다.</p>
          <button
            type="button"
            onClick={() => {
              void routeQuery.refetch();
            }}
            className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-ink"
          >
            다시 불러오기
          </button>
        </div>
      )}

      <div className="mt-3 rounded-[22px] border border-line bg-surface p-4 shadow-[0_10px_28px_rgba(24,33,21,0.08)]">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
              <path
                d="M5 19c2.5-5 4.5-8 8-8h6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="5" cy="19" r="2" fill="currentColor" />
              <circle cx="19" cy="11" r="2" fill="currentColor" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{startQuery}</p>
            <p className="mt-1 truncate text-sm text-muted">{endQuery}까지</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openOnMap}
          disabled={route === null || error}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-bold text-white shadow-[0_8px_20px_rgba(86,132,43,0.24)] transition-[transform,filter] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45"
        >
          지도에서 경로 확인
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
            <path
              d="m9 5 7 7-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted">
          모든 경유지를 잇는 코스를 지도에서 보고 안내를 시작할 수 있어요.
          <br />
          실제 도로 계산 거리는 공식 안내 거리와 다를 수 있어요.
        </p>
      </div>
    </section>
  );
}
