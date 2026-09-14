import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '@/shared/api/client';
import type { PlaceSearchResult, Pos, RoutePath } from '@/shared/api/types';
import { latLngToPos } from '@/shared/lib/coords';
import { Button } from '@/shared/ui/Button';
import { BIKE_STATIONS_QUERY_KEY, getBikeStations } from '@/features/map/api/stations';
import { NOTICE_POPUPS_QUERY_KEY, getNoticePopups } from '@/features/map/api/noticePopups';
import { getRoutePaths } from '@/features/map/api/routes';
import { CurrentLocationButton } from '@/features/map/components/CurrentLocationButton';
import { DestinationSheet } from '@/features/map/components/DestinationSheet';
import { MapView } from '@/features/map/components/MapView';
import { NoticeBanner } from '@/features/map/components/NoticeBanner';
import { NoticePopup } from '@/features/map/components/NoticePopup';
import { PlaceSearchOverlay } from '@/features/map/components/PlaceSearchOverlay';
import { RouteCompareControls } from '@/features/map/components/RouteCompareControls';
import { RouteDetailControls } from '@/features/map/components/RouteDetailControls';
import { RouteDetailSheet } from '@/features/map/components/RouteDetailSheet';
import { RouteGuideCard } from '@/features/map/components/RouteGuideCard';
import { RouteGuideSheet } from '@/features/map/components/RouteGuideSheet';
import {
  RouteCompareSheet,
  type RouteCompareSnap,
} from '@/features/map/components/RouteCompareSheet';
import { SearchBar } from '@/features/map/components/SearchBar';
import { StationPeekSheet } from '@/features/map/components/StationPeekSheet';
import { Toast } from '@/features/map/components/Toast';
import { UpdatedBadge } from '@/features/map/components/UpdatedBadge';
import { LOCATION_ERROR_TEXT, useCurrentLocation } from '@/features/map/hooks/useCurrentLocation';
import { useToast } from '@/features/map/hooks/useToast';
import { START_POS_FALLBACK } from '@/features/map/lib/mapDefaults';
import { NOTICES_PATH } from '@/features/map/lib/noticeLink';
import {
  hideNoticePopupForWeek,
  isNoticePopupHidden,
  markNoticePopupClosed,
} from '@/features/map/lib/noticePopupHide';
import { getRouteProgress } from '@/features/map/lib/routeProgress';
import { toLegs } from '@/features/map/lib/routeSegments';
import {
  assignBadges,
  sortSummaries,
  summarizeRoutes,
  type RouteSort,
} from '@/features/map/lib/routeMetrics';

/** 대여하기·턴바이턴 안내는 각각 별도 이슈라 지금은 안내만 띄운다 */
const COMING_SOON = '준비 중입니다.';

/**
 * 위치를 못 얻었을 때는 **검색을 열던 시점에 보고 있던 지도 중심**에서 출발하는 경로를 찾는다.
 * - 고정 좌표로 찾으면 사용자가 있지도 않은 곳에서 출발하는 경로가 나온다
 * - 조회 시점의 중심을 쓰면 안 된다. 목적지를 고르면 지도가 그 위로 옮겨져 출발지와 목적지가 같아진다
 * 출발지가 내 위치가 아니라는 것은 반드시 알린다.
 */
const START_FALLBACK_NOTICE = '현재 위치를 몰라 지도에서 보던 곳에서 출발하는 경로를 찾습니다.';

/**
 * 08 검색 오버레이 열림 상태를 URL 쿼리에 둔다(`/?search=1`).
 * 라우트는 `/` 그대로라 지도가 살아 있고, 안드로이드·브라우저 뒤로가기가 그대로 "검색 닫기"가 된다.
 */
const SEARCH_PARAM = 'search';

/**
 * 10 경로 비교도 같은 방식. `/?routes=1`이면 비교 중이고 뒤로가기·← 버튼이 곧 "비교 끝내기 → 목적지 확인 시트".
 * 시트는 기본으로 확장(카드 목록)돼 열리고 아래로 끌면 Peek(2026-09-13 만두 결정). 확장↔Peek은 state라
 * 뒤로가기 단계에 끼지 않는다(Figma 10-1의 "확장→Peek 축소" 단계는 뺌).
 * 후보 목록은 state에만 있어 새로고침하면 사라진다 — 목적지(#26)와 같은 결정.
 */
const ROUTES_PARAM = 'routes';

/**
 * 11 경로 상세도 같은 방식으로 10 위에 한 단계 더 쌓는다(`/?routes=1&detail=1`).
 * 뒤로가기·← 는 비교(10)로 돌아가고, 거기서 한 번 더 뒤로 가면 목적지 확인 시트다.
 */
const DETAIL_PARAM = 'detail';

/**
 * 12 경로 안내도 같은 방식으로 11 위에 한 단계 더(`?routes=1&detail=1&guide=1`).
 * 안내 종료·뒤로가기는 상세(11)로 돌아간다.
 */
const GUIDE_PARAM = 'guide';

/**
 * 시트가 열리면 하단 버튼을 시트 높이만큼 올린다.
 * 시트는 화면 맨 아래(탭바 64px 포함)에 붙으므로 실제 겹침은 시트 높이 − 64, 여기에 여백 12px.
 * - 대여소 시트(peek 110px): 110 − 64 + 12 = 58
 * - 목적지 시트(mini 200px): 200 − 64 + 12 = 148
 */
const LIFT_FOR_STATION_CLASS = '-translate-y-[58px]';
const LIFT_FOR_DESTINATION_CLASS = '-translate-y-[148px]';

interface RouteResult {
  /** 서버가 정렬·필터 없이 준 후보 전체 */
  routes: RoutePath[];
  /** 받은 시각(ms). 출발은 "지금"이라 도착 예정 시각의 기준이 된다 */
  fetchedAt: number;
}

/** 07 메인 지도 — 네이버 지도 + 대여소 마커 + 오버레이 UI */
export function MapHomePage() {
  const { message, showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchOpen = searchParams.get(SEARCH_PARAM) === '1';
  const compareInUrl = searchParams.get(ROUTES_PARAM) === '1';
  const detailInUrl = searchParams.get(DETAIL_PARAM) === '1';
  const guideInUrl = searchParams.get(GUIDE_PARAM) === '1';
  const [compareSnap, setCompareSnap] = useState<RouteCompareSnap>('half');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [destination, setDestination] = useState<PlaceSearchResult | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeSort, setRouteSort] = useState<RouteSort>('bikes');
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  // 현재위치 버튼을 누른 횟수 — 같은 자리에서 다시 눌러도 지도가 그 위치로 돌아오게 하는 신호
  const [locationFocusToken, setLocationFocusToken] = useState(0);
  const location = useCurrentLocation();
  // 읽기만 하므로 state가 아니라 ref에 둔다(지도를 옮길 때마다 화면을 다시 그릴 이유가 없다)
  const mapRef = useRef<naver.maps.Map | null>(null);
  const handleMapReady = useCallback((map: naver.maps.Map | null) => {
    mapRef.current = map;
  }, []);
  /** 검색을 열던 시점의 지도 중심 — 위치를 모를 때 출발지로 쓴다 */
  const viewedCenterRef = useRef<Pos | null>(null);

  function rememberViewedCenter() {
    const center = mapRef.current?.getCenter();
    if (center instanceof naver.maps.LatLng) {
      viewedCenterRef.current = latLngToPos({ lat: center.lat(), lng: center.lng() });
    }
  }

  /** 위치를 모를 때 쓸 출발지. 지도를 아직 못 읽었으면 초기 중심값 */
  function viewedCenterAsStart(): Pos {
    return viewedCenterRef.current ?? START_POS_FALLBACK;
  }

  // 한 번 닫으면 앱을 다시 켜기 전까지 뜨지 않는다. "7일간 보지 않기"는 저장소로 더 오래 막는다.
  // 닫힘 기억은 모듈(noticePopupHide)에 있고, 이 state는 화면을 다시 그리는 용도다
  const [popupClosed, setPopupClosed] = useState(isNoticePopupHidden);

  function closePopup() {
    markNoticePopupClosed();
    setPopupClosed(true);
  }

  // 마커와 갱신 배지가 같은 목록을 쓴다
  const { data: stations } = useQuery({
    queryKey: BIKE_STATIONS_QUERY_KEY,
    queryFn: getBikeStations,
  });
  const updatedAt = stations?.[0]?.updatedAt;
  // 목록이 갱신돼 선택한 대여소가 사라지면 시트도 닫힌다
  const selectedStation = stations?.find((s) => s.stationId === selectedStationId) ?? null;

  // 이미 숨긴 상태면 요청 자체를 하지 않는다
  const { data: popupNotices } = useQuery({
    queryKey: NOTICE_POPUPS_QUERY_KEY,
    queryFn: getNoticePopups,
    enabled: !popupClosed,
  });

  // 후보 요약·뱃지는 후보가 바뀔 때만 다시 계산한다. 뱃지는 응답에 없고 후보끼리 비교해 프론트가 붙인다
  const routeSummaries = useMemo(
    () => (routeResult === null ? [] : summarizeRoutes(routeResult.routes)),
    [routeResult],
  );
  const routeBadges = useMemo(() => assignBadges(routeSummaries), [routeSummaries]);

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

  function closeForWeek() {
    hideNoticePopupForWeek();
    closePopup();
  }

  function openSearch() {
    // 목적지를 고르면 지도가 그 위로 옮겨진다 — 사용자가 "지금 보고 있던 곳"은 지금 기록해 둬야 한다
    rememberViewedCenter();
    // 검색 화면이 시트를 덮지 못하므로(시트 z-index가 더 높음) 먼저 닫는다
    setSelectedStationId(null);
    setSearchParams({ [SEARCH_PARAM]: '1' });
  }

  // 열 때 히스토리를 하나 쌓았으니 닫기는 뒤로가기와 같다
  function closeSearch() {
    navigate(-1);
  }

  // 고른 장소로 지도가 이동하고 핀·확인 시트가 뜬다(네이버 지도의 장소 확인 단계).
  // 이전 목적지의 경로 후보는 더 맞지 않으니 버린다
  function selectDestination(place: PlaceSearchResult) {
    setDestination(place);
    setRouteResult(null);
    closeSearch();
  }

  function clearDestination() {
    setDestination(null);
    setRouteResult(null);
  }

  /** 08 검색 화면의 "현재 위치" 줄·"내 위치" 칩 — 위치만 새로 잡는다(지도는 오버레이에 가려 안 보인다) */
  async function refreshLocation() {
    const result = await location.request();
    if (!result.ok) showToast(LOCATION_ERROR_TEXT[result.error]);
  }

  /** 07 현재위치 버튼 — 위치를 새로 잡고 성공하면 지도를 그 자리로 옮긴다 */
  async function focusCurrentLocation() {
    const result = await location.request();
    if (!result.ok) {
      showToast(LOCATION_ERROR_TEXT[result.error]);
      return;
    }
    setLocationFocusToken((token) => token + 1);
  }

  // 출발지는 현재 위치다. 위치를 못 얻으면 지도 중심에서 찾되 그 사실을 알린다 —
  // 조회 자체를 막으면 권한을 거절한 사용자는 경로를 아예 못 본다
  async function searchRoutes() {
    if (destination === null) return;
    const start = await location.ensure();
    if (!start.ok) showToast(START_FALLBACK_NOTICE);
    routeSearch.mutate({
      start: start.ok ? start.position : viewedCenterAsStart(),
      end: { xPos: destination.xPos, yPos: destination.yPos },
    });
  }

  // ← 버튼: 비교를 끝내고 목적지 확인 시트로. 열 때 히스토리를 하나 쌓았으니 뒤로가기와 같다
  function exitCompare() {
    navigate(-1);
  }

  // 10의 "바로 안내 시작" → 11 경로 상세. 카드 버튼은 선택과 무관하게 눌릴 수 있어 선택도 함께 맞춘다
  function openRouteDetail(index: number) {
    setSelectedRouteIndex(index);
    setSearchParams({ [ROUTES_PARAM]: '1', [DETAIL_PARAM]: '1' });
  }

  // 11 ← 버튼: 상세를 닫고 비교(10)로. 열 때 히스토리를 하나 쌓았으니 뒤로가기와 같다
  function exitRouteDetail() {
    navigate(-1);
  }

  // 11의 "안내 시작" → 12 안내 진행
  function startGuide() {
    // 경로 전체를 보던 축척 그대로면 길이 안 보인다 — 안내를 시작할 때 현재 위치로 확대한다
    setLocationFocusToken((token) => token + 1);
    setSearchParams({ [ROUTES_PARAM]: '1', [DETAIL_PARAM]: '1', [GUIDE_PARAM]: '1' });
  }

  // "안내 종료"·뒤로가기 → 경로 상세(11)로
  function endGuide() {
    navigate(-1);
  }

  // 공지 상세 화면이 아직 없어 연결된 공지 번호와 상관없이 목록으로 보낸다
  function openNotice() {
    closePopup();
    navigate(NOTICES_PATH);
  }

  // 시트는 한 번에 하나만: 대여소를 탭하면 대여소 시트가 우선하고, 검색 중에는 전부 숨긴다.
  // 경로 후보가 있고 URL이 비교 중이면 목적지 확인 시트 대신 비교 시트·경로선·범례가 뜬다
  const stationSheetOpen = selectedStation !== null;
  const compareActive = routeResult !== null && compareInUrl && !searchOpen;
  // 11 상세는 비교 위에 한 단계 더 쌓인 상태다
  const detailActive = compareActive && detailInUrl;
  const detailRoute =
    detailActive && selectedRouteIndex !== null
      ? (routeResult?.routes[selectedRouteIndex] ?? null)
      : null;
  // 12 안내는 상세 위에 한 단계 더 쌓인 상태다
  const guideActive = detailActive && guideInUrl && detailRoute !== null;
  const compareSheetOpen = compareActive && !stationSheetOpen && !detailActive;
  const detailSheetOpen = detailActive && !stationSheetOpen && !guideActive;
  const destinationSheetOpen =
    destination !== null && !stationSheetOpen && !searchOpen && !compareActive;

  // 안내 중에는 위치를 계속 받는다. 평소에는 배터리 때문에 켜지 않는다
  const watchLocation = location.watch;
  useEffect(() => {
    if (!guideActive) return;
    return watchLocation();
  }, [guideActive, watchLocation]);

  const guideProgress = useMemo(
    () => (detailRoute === null ? null : getRouteProgress(detailRoute, location.position)),
    [detailRoute, location.position],
  );
  const guideLegCount = useMemo(
    () => (detailRoute === null ? 0 : toLegs(detailRoute).length),
    [detailRoute],
  );
  // 남은 시간은 남은 거리 비율로 총 소요 시간을 줄여 잡는다(구간별 속도 차이는 무시)
  const guideRemainingSec =
    guideProgress === null || selectedRouteIndex === null
      ? 0
      : Math.round((routeSummaries[selectedRouteIndex]?.totalSec ?? 0) * (1 - guideProgress.ratio));
  const liftClass = stationSheetOpen
    ? LIFT_FOR_STATION_CLASS
    : destinationSheetOpen
      ? LIFT_FOR_DESTINATION_CLASS
      : '';

  return (
    <div className="relative h-full overflow-hidden">
      <MapView
        stations={stations}
        selectedStationId={selectedStationId}
        onSelectStation={setSelectedStationId}
        destination={destination}
        routes={compareActive ? routeResult.routes : null}
        routeBadges={routeBadges}
        selectedRouteIndex={selectedRouteIndex}
        detailRoute={detailRoute}
        currentLocation={location.position}
        locationFocusToken={locationFocusToken}
        followLocation={guideActive}
        onMapReady={handleMapReady}
      />

      {guideActive && guideProgress !== null ? (
        <RouteGuideCard
          progress={guideProgress}
          isLastLeg={guideProgress.legIndex === guideLegCount - 1}
          legCount={guideLegCount}
          locationUnknown={location.position === null}
        />
      ) : detailActive ? (
        <RouteDetailControls onBack={exitRouteDetail} destinationTitle={destination?.title ?? ''} />
      ) : compareActive ? (
        <RouteCompareControls
          onBack={exitCompare}
          onRefresh={searchRoutes}
          refreshing={routeSearch.isPending}
        />
      ) : (
        /* 상단 — 검색바, 공지 배너, 갱신 배지 */
        <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-2 p-4">
          <div className="pointer-events-auto w-full">
            <SearchBar onClick={openSearch} value={destination?.title} />
          </div>
          <div className="pointer-events-auto w-full">
            <NoticeBanner onClick={() => navigate(NOTICES_PATH)} />
          </div>
          {updatedAt && <UpdatedBadge updatedAt={updatedAt} />}
        </div>
      )}

      {/* 하단 — 현재위치 버튼과 대여하기 버튼 (홈 인디케이터 여백은 탭바가 처리). 경로 비교 중에는 시트가 그 자리를 쓴다 */}
      {compareActive ? null : (
        <div
          className={`absolute inset-x-0 bottom-0 z-10 flex flex-col items-end gap-3 p-4 transition-transform duration-300 ease-out ${liftClass}`}
        >
          <CurrentLocationButton onClick={focusCurrentLocation} loading={location.loading} />
          <Button full onClick={() => showToast(COMING_SOON)}>
            대여하기
          </Button>
        </div>
      )}

      <StationPeekSheet station={selectedStation} onClose={() => setSelectedStationId(null)} />

      <DestinationSheet
        destination={destinationSheetOpen ? destination : null}
        searching={routeSearch.isPending}
        onSearchRoutes={searchRoutes}
        onClose={clearDestination}
      />

      {routeResult === null ? null : (
        <RouteCompareSheet
          open={compareSheetOpen}
          snap={compareSnap}
          onSnapChange={setCompareSnap}
          summaries={routeSummaries}
          badges={routeBadges}
          fetchedAt={routeResult.fetchedAt}
          sort={routeSort}
          onSortChange={setRouteSort}
          selectedIndex={selectedRouteIndex}
          onSelect={setSelectedRouteIndex}
          onStart={openRouteDetail}
        />
      )}

      {routeResult === null ? null : (
        <RouteDetailSheet
          open={detailSheetOpen}
          route={detailRoute}
          summary={
            selectedRouteIndex === null ? null : (routeSummaries[selectedRouteIndex] ?? null)
          }
          badge={selectedRouteIndex === null ? null : (routeBadges[selectedRouteIndex] ?? null)}
          fetchedAt={routeResult.fetchedAt}
          onStart={startGuide}
          onBack={exitRouteDetail}
        />
      )}

      {guideActive && guideProgress !== null ? (
        <RouteGuideSheet
          open
          progress={guideProgress}
          remainingSec={guideRemainingSec}
          onEnd={endGuide}
        />
      ) : null}

      {/* 검색 오버레이는 탭바(z-20)를 덮고, 뒤에 오는 토스트(z-30)보다는 아래에 둔다 */}
      {searchOpen ? (
        <PlaceSearchOverlay
          onClose={closeSearch}
          onSelect={selectDestination}
          currentLocation={location.position}
          onRefreshLocation={refreshLocation}
          locationLoading={location.loading}
          showToast={showToast}
        />
      ) : null}

      {message && <Toast message={message} />}

      {!popupClosed && popupNotices && popupNotices.length > 0 && (
        <NoticePopup
          notices={popupNotices}
          onClose={closePopup}
          onHideForWeek={closeForWeek}
          onOpenNotice={openNotice}
        />
      )}
    </div>
  );
}
