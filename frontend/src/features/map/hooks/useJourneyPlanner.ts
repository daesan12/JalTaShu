import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '@/shared/api/client';
import type { PlaceSearchResult, Pos, RouteCandidate } from '@/shared/api/types';
import { getRoutePaths } from '@/features/map/api/routes';
import type { RouteCompareSnap } from '@/features/map/components/RouteCompareSheet';
import type { useCurrentLocation } from '@/features/map/hooks/useCurrentLocation';
import { sortSummaries, summarizeRoutes, type RouteSort } from '@/features/map/lib/routeMetrics';
import type { PickedPlace } from '@/features/map/lib/reverseGeocode';
import { DETAIL_PARAM, ROUTES_PARAM } from '@/features/map/lib/urlParams';

/**
 * 위치를 못 얻었을 때는 **검색을 열던 시점에 보고 있던 지도 중심**에서 출발하는 경로를 찾는다.
 * - 고정 좌표로 찾으면 사용자가 있지도 않은 곳에서 출발하는 경로가 나온다
 * - 조회 시점의 중심을 쓰면 안 된다. 목적지를 고르면 지도가 그 위로 옮겨져 출발지와 목적지가 같아진다
 * 출발지가 내 위치가 아니라는 것은 반드시 알린다.
 */
const START_FALLBACK_NOTICE = '현재 위치를 몰라 지도에서 보던 곳에서 출발하는 경로를 찾습니다.';

/** 지도에서 고른 지점의 이름 — 역지오코딩이 실패했을 때만 쓰는 마지막 fallback */
const PICKED_PLACE_TITLE = '지도에서 선택한 위치';
/** 바꾸기(↕) 버튼으로 목적지 자리에 들어갈 때 쓰는, 이전 출발 위치의 이름 */
const SWAPPED_START_TITLE = '출발했던 위치';

interface RouteResult {
  /** 서버가 정렬·필터 없이 준 후보 전체 */
  routes: RouteCandidate[];
  /** 받은 시각(ms). 출발은 "지금"이라 도착 예정 시각의 기준이 된다 */
  fetchedAt: number;
}

/** 실제 위치에서 사용자가 고른 출발지까지 안내한 뒤 이어서 사용할 원래 경로. */
interface PendingRouteAfterStart {
  start: PlaceSearchResult;
  destination: PlaceSearchResult;
  route: RouteCandidate;
  staticRouteActive: boolean;
}

interface JourneyPlannerDeps {
  location: ReturnType<typeof useCurrentLocation>;
  showToast: (message: string) => void;
  /** 위치를 모를 때 쓸 출발지 — 검색을 열던 시점의 지도 중심 (페이지가 ref로 기억한다) */
  viewedCenterAsStart: () => Pos;
}

/**
 * 출발지·목적지 선택(08)과 경로 후보 조회·비교(10) 상태.
 * 두 덩어리는 떼기 어렵다 — 비교 중(`routes=1`)에 출발·목적지를 고치면 그 자리에서 다시 조회하기 때문.
 */
export function useJourneyPlanner({
  location,
  showToast,
  viewedCenterAsStart,
}: JourneyPlannerDeps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const compareInUrl = searchParams.get(ROUTES_PARAM) === '1';

  // 출발지를 직접 골랐을 때만 값이 있다. null이면 항상 현재 위치가 출발지다
  const [customStart, setCustomStart] = useState<PlaceSearchResult | null>(null);
  const [destination, setDestination] = useState<PlaceSearchResult | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeSort, setRouteSort] = useState<RouteSort[]>(['bikes']);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  const [compareSnap, setCompareSnap] = useState<RouteCompareSnap>('half');
  const [staticRouteActive, setStaticRouteActive] = useState(false);
  const [pendingRouteAfterStart, setPendingRouteAfterStart] =
    useState<PendingRouteAfterStart | null>(null);

  // 후보 요약은 후보가 바뀔 때만 다시 계산한다. 후보 종류 라벨은 서버가 준 `type`을 그대로 쓴다
  const routeSummaries = useMemo(
    () => (routeResult === null ? [] : summarizeRoutes(routeResult.routes)),
    [routeResult],
  );

  const routeSearch = useMutation({
    mutationFn: getRoutePaths,
    onSuccess: (routes) => {
      setRouteResult({ routes, fetchedAt: Date.now() });
      // 새 후보는 항상 카드 목록이 펼쳐진 상태로 보여준다
      setCompareSnap('half');
      // 기본 선택은 현재 칩 기준 1순위
      setSelectedRouteIndex(sortSummaries(summarizeRoutes(routes), routeSort)[0]?.index ?? null);
      // 다시 조회(이미 비교 중)일 때는 히스토리를 더 쌓지 않는다
      if (!compareInUrl) setSearchParams({ [ROUTES_PARAM]: '1' });
    },
    onError: (error) => {
      showToast(
        error instanceof ApiError ? error.message : '경로를 찾지 못했습니다. 다시 시도해 주세요.',
      );
    },
  });

  // 검색을 열 때 히스토리를 하나 쌓았으니 닫기는 뒤로가기와 같다
  function closeSearch() {
    navigate(-1);
  }

  /** 지금 위치, 실패하면 지도 중심(+안내). 출발지가 "현재 위치"로 확정된 경우에만 쓴다 */
  async function resolveCurrentLocationOrFallback(): Promise<Pos> {
    const start = await location.ensure();
    if (start.ok) return start.position;
    showToast(START_FALLBACK_NOTICE);
    return viewedCenterAsStart();
  }

  /** 출발지 좌표를 정한다 — 커스텀이 있으면 그대로, 없으면 현재 위치(실패 시 지도 중심 + 안내) */
  async function resolveStartPos(): Promise<Pos> {
    if (customStart !== null) return { xPos: customStart.xPos, yPos: customStart.yPos };
    return resolveCurrentLocationOrFallback();
  }

  /**
   * 10 비교 화면에서 출발·목적지를 바로 고쳤을 때 다시 조회한다. `start`·`end`를 항상 이 함수
   * 호출부가 직접 계산해 넘긴다 — `setCustomStart`/`setDestination` 직후 같은 함수 안에서
   * state를 다시 읽으면 아직 반영되지 않은 이전 값을 읽게 되기 때문이다(리액트 상태 갱신은 비동기).
   */
  function refetchRoutes(start: Pos, end: Pos) {
    setStaticRouteActive(false);
    routeSearch.mutate({ start, end });
  }

  // 고른 장소로 지도가 이동하고 핀·확인 시트가 뜬다(네이버 지도의 장소 확인 단계).
  // 10 화면에서 고쳤을 때(이미 비교 중)는 이전 후보를 버리는 대신 새 목적지로 바로 다시 조회한다
  function selectDestination(place: PlaceSearchResult) {
    setDestination(place);
    closeSearch();
    if (compareInUrl) void resolveStartPos().then((start) => refetchRoutes(start, place));
    else setRouteResult(null);
  }

  /**
   * 재탐색(12)으로 받은 경로로 갈아끼운다.
   * 안내 중이라 고를 여지가 없으므로 첫 후보를 그대로 쓴다 — 서버가 "지금 상황"에 맞춰 준 것이다.
   */
  function replaceRoutes(routes: RouteCandidate[]) {
    if (routes.length === 0) return;
    setStaticRouteActive(false);
    setRouteResult({ routes, fetchedAt: Date.now() });
    setSelectedRouteIndex(0);
  }

  // 목적지를 지우면 처음부터 다시 찾는 것과 같으므로 골라둔 출발지도 함께 되돌린다
  function clearDestination() {
    setDestination(null);
    setRouteResult(null);
    setCustomStart(null);
    setStaticRouteActive(false);
    setPendingRouteAfterStart(null);
  }

  /**
   * 출발지 고르는 화면(field='start')에서 장소를 고르면 — 한 단계만 되돌아간다.
   * 08에서 들어왔으면 목적지 검색 화면으로, 10에서 들어왔으면 비교 화면으로(같은 `navigate(-1)`).
   * 이미 비교 중이었다면 새 출발지로 바로 다시 조회한다.
   */
  function selectStart(place: PlaceSearchResult) {
    setCustomStart(place);
    closeSearch();
    if (compareInUrl && destination !== null) refetchRoutes(place, destination);
    else setRouteResult(null);
  }

  /** 추천 코스 화면에서 넘어온 고정 경로를 상세 화면에 바로 연다. */
  function openRecommendedRoute(
    start: PlaceSearchResult,
    end: PlaceSearchResult,
    route: RouteCandidate,
  ) {
    setCustomStart(start);
    setDestination(end);
    setRouteResult({ routes: [route], fetchedAt: Date.now() });
    setSelectedRouteIndex(0);
    setStaticRouteActive(true);
    setSearchParams({ [ROUTES_PARAM]: '1', [DETAIL_PARAM]: '1' }, { replace: true });
  }

  /**
   * "현재 위치 사용" — 골라둔 출발지를 지우고 자동(현재 위치)으로 되돌린다.
   * `customStart`를 참고하지 않고 곧장 현재 위치를 구한다 — 방금 지운 값이 아직
   * state에 반영되기 전이라 `resolveStartPos()`를 쓰면 지운 값을 다시 읽게 된다.
   */
  function resetStartToCurrentLocation() {
    setCustomStart(null);
    closeSearch();
    if (compareInUrl && destination !== null) {
      void resolveCurrentLocationOrFallback().then((start) => refetchRoutes(start, destination));
    } else {
      setRouteResult(null);
    }
  }

  /**
   * 바꾸기(↕) — 출발지·목적지를 서로 맞바꾼다. 출발지가 아직 "현재 위치"(커스텀 없음)라면
   * 그 자리를 채우기 위해 지금 위치를 하나의 장소로 확정해 목적지 쪽으로 옮긴다.
   * 이미 비교 중이었다면 바뀐 조합으로 바로 다시 조회한다.
   */
  function swapStartAndDestination() {
    if (destination === null) {
      showToast('목적지를 먼저 선택해 주세요.');
      return;
    }
    const newStart = destination;
    let newDestination: PlaceSearchResult;
    if (customStart === null) {
      if (location.position === null) {
        showToast('현재 위치를 몰라 바꿀 수 없습니다.');
        return;
      }
      newDestination = {
        title: SWAPPED_START_TITLE,
        address: '',
        roadAddress: '',
        xPos: location.position.xPos,
        yPos: location.position.yPos,
      };
    } else {
      newDestination = customStart;
    }
    setCustomStart(newStart);
    setDestination(newDestination);
    if (compareInUrl) refetchRoutes(newStart, newDestination);
    else setRouteResult(null);
  }

  /**
   * 08 "지도에서 선택" 확정 — 지도 중심 좌표를 목적지(또는 출발지)로 삼는다.
   * 역지오코딩으로 읽어 둔 이름·주소가 있으면 함께 넣는다(없으면 좌표만, 이름은 기본 문구).
   * 이미 비교 중이었다면 새 값으로 바로 다시 조회한다. (URL·히스토리 정리는 페이지가 한다)
   */
  function applyPickedPos(pos: Pos, isStart: boolean, place: PickedPlace | null) {
    const picked: PlaceSearchResult = {
      title: place?.title ?? PICKED_PLACE_TITLE,
      address: place?.address ?? '',
      roadAddress: place?.roadAddress ?? '',
      xPos: pos.xPos,
      yPos: pos.yPos,
    };
    if (isStart) {
      setCustomStart(picked);
      if (compareInUrl && destination !== null) refetchRoutes(picked, destination);
      else setRouteResult(null);
    } else {
      setDestination(picked);
      if (compareInUrl) void resolveStartPos().then((start) => refetchRoutes(start, picked));
      else setRouteResult(null);
    }
  }

  // "경로 찾기"·"다시 조회" — 출발지를 직접 골랐으면 그 좌표, 아니면 현재 위치(실패 시 지도 중심 + 안내)
  async function searchRoutes() {
    if (destination === null) return;
    const start = await resolveStartPos();
    refetchRoutes(start, { xPos: destination.xPos, yPos: destination.yPos });
  }

  /** 안내 직전에 쓰는 경로 조회. 실패 문구는 routeSearch의 공통 onError가 보여준다. */
  async function loadRoutesForGuide(start: Pos, end: Pos): Promise<boolean> {
    try {
      const routes = await routeSearch.mutateAsync({ start, end });
      if (routes.length > 0) return true;
      showToast('안내할 수 있는 경로를 찾지 못했습니다.');
      return false;
    } catch {
      return false;
    }
  }

  /** 사용자가 고른 출발지를 버리고 실제 GPS 위치에서 목적지까지 다시 계산한다. */
  async function startGuideFromCurrentLocation(current: Pos): Promise<boolean> {
    if (destination === null) return false;
    const loaded = await loadRoutesForGuide(current, destination);
    if (!loaded) return false;
    setCustomStart(null);
    setStaticRouteActive(false);
    setPendingRouteAfterStart(null);
    return true;
  }

  /**
   * 실제 위치 → 사용자가 고른 출발지 경로를 먼저 연다. 원래 선택한 경로는 보관했다가
   * 출발지 도착 시 `continueAfterReachingStart`가 다시 설치한다.
   */
  async function startGuideToCustomStart(
    current: Pos,
    selectedRoute: RouteCandidate,
  ): Promise<boolean> {
    if (customStart === null || destination === null) return false;
    const loaded = await loadRoutesForGuide(current, customStart);
    if (!loaded) return false;
    setPendingRouteAfterStart({
      start: customStart,
      destination,
      route: selectedRoute,
      staticRouteActive,
    });
    setDestination(customStart);
    setCustomStart(null);
    setStaticRouteActive(false);
    return true;
  }

  /** 중간 목적지인 선택 출발지에 도착하면 원래 경로로 바꾸고 같은 안내 화면을 이어간다. */
  function continueAfterReachingStart(): boolean {
    if (pendingRouteAfterStart === null) return false;
    setCustomStart(pendingRouteAfterStart.start);
    setDestination(pendingRouteAfterStart.destination);
    setRouteResult({ routes: [pendingRouteAfterStart.route], fetchedAt: Date.now() });
    setSelectedRouteIndex(0);
    setStaticRouteActive(pendingRouteAfterStart.staticRouteActive);
    setPendingRouteAfterStart(null);
    showToast('선택한 출발지에 도착했어요. 목적지 안내를 이어서 시작합니다.');
    return true;
  }

  // 정렬 칩이 바뀌면 이전 선택을 유지하지 않고 새 기준의 1순위 경로를 선택한다
  function changeRouteSort(next: RouteSort[]) {
    setRouteSort(next);
    setSelectedRouteIndex(sortSummaries(routeSummaries, next)[0]?.index ?? null);
  }

  // 10의 "바로 안내 시작" → 11 경로 상세. 카드 버튼은 선택과 무관하게 눌릴 수 있어 선택도 함께 맞춘다
  function openRouteDetail(index: number) {
    setSelectedRouteIndex(index);
    setSearchParams({ [ROUTES_PARAM]: '1', [DETAIL_PARAM]: '1' });
  }

  // 출발지 표시 문구 — 08 검색 화면과 10 비교 화면 상단 바가 같이 쓴다
  const startLabel = customStart?.title ?? (location.loading ? '현재 위치 확인 중…' : '현재 위치');

  return {
    destination,
    customStart,
    startLabel,
    routeResult,
    routeSummaries,
    routeSort,
    selectedRouteIndex,
    staticRouteActive,
    guidingToCustomStart: pendingRouteAfterStart !== null,
    setSelectedRouteIndex,
    compareSnap,
    setCompareSnap,
    searchPending: routeSearch.isPending,
    closeSearch,
    selectDestination,
    selectStart,
    openRecommendedRoute,
    resetStartToCurrentLocation,
    swapStartAndDestination,
    clearDestination,
    applyPickedPos,
    searchRoutes,
    changeRouteSort,
    openRouteDetail,
    replaceRoutes,
    startGuideFromCurrentLocation,
    startGuideToCustomStart,
    continueAfterReachingStart,
  };
}
