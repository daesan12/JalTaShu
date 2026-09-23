import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { Pos } from '@/shared/api/types';
import { latLngToPos } from '@/shared/lib/coords';
import { BIKE_STATIONS_QUERY_KEY, getBikeStations } from '@/features/map/api/stations';
import { ArrivalSummaryScreen } from '@/features/map/components/ArrivalSummaryScreen';
import { CurrentLocationButton } from '@/features/map/components/CurrentLocationButton';
import { CycleReturnSheet } from '@/features/map/components/CycleReturnSheet';
import { DestinationSheet } from '@/features/map/components/DestinationSheet';
import { MapPickLayer } from '@/features/map/components/MapPickLayer';
import { MapView } from '@/features/map/components/MapView';
import { NoticeBanner } from '@/features/map/components/NoticeBanner';
import { NoticePopup } from '@/features/map/components/NoticePopup';
import { NotificationButton } from '@/features/notification/components/NotificationButton';
import { PlaceSearchOverlay } from '@/features/map/components/PlaceSearchOverlay';
import { RouteCompareControls } from '@/features/map/components/RouteCompareControls';
import { RouteCompareSheet } from '@/features/map/components/RouteCompareSheet';
import { RouteDetailControls } from '@/features/map/components/RouteDetailControls';
import { RouteDetailSheet } from '@/features/map/components/RouteDetailSheet';
import { RouteGuideCard } from '@/features/map/components/RouteGuideCard';
import { RouteGuideSheet } from '@/features/map/components/RouteGuideSheet';
import { RouteStartChoiceSheet } from '@/features/map/components/RouteStartChoiceSheet';
import { SearchBar } from '@/features/map/components/SearchBar';
import { StationRefreshButton } from '@/features/map/components/StationRefreshButton';
import { StationSheet } from '@/features/map/components/StationSheet';
import { StationVisibilityToggle } from '@/features/map/components/StationVisibilityToggle';
import { Toast } from '@/features/map/components/Toast';
import { UpdatedBadge } from '@/features/map/components/UpdatedBadge';
import { WeatherButton } from '@/features/map/components/WeatherButton';
import { LOCATION_ERROR_TEXT, useCurrentLocation } from '@/features/map/hooks/useCurrentLocation';
import { useJourneyPlanner } from '@/features/map/hooks/useJourneyPlanner';
import { useMapPick } from '@/features/map/hooks/useMapPick';
import { useNoticePopup } from '@/features/map/hooks/useNoticePopup';
import { useRentalSheets } from '@/features/map/hooks/useRentalSheets';
import { useRouteGuide } from '@/features/map/hooks/useRouteGuide';
import { useToast } from '@/shared/lib/useToast';
import { START_POS_FALLBACK } from '@/features/map/lib/mapDefaults';
import { NOTICES_PATH } from '@/features/map/lib/noticeLink';
import { clearRentalSession } from '@/features/rental/lib/rentalSession';
import { useCycleRental, useScannedCode } from '@/features/map/hooks/useCycleRental';
import { useDeviceHeading } from '@/features/map/hooks/useDeviceHeading';
import { readRecommendedRouteIntent } from '@/features/map/lib/recommendedRouteIntent';
import {
  distanceToRouteStart,
  needsRouteStartChoice,
} from '@/features/map/lib/routeStartGuard';
import {
  getRecommendedCourseRoute,
  waypointToPlace,
} from '@/features/mypage/api/recommendedCourseRoutes';
import {
  CODE_PARAM,
  DETAIL_PARAM,
  FIELD_PARAM,
  GUIDE_PARAM,
  PICK_PARAM,
  ROUTES_PARAM,
  SEARCH_PARAM,
  START_FIELD_VALUE,
} from '@/features/map/lib/urlParams';

/**
 * 시트가 열리면 하단 버튼을 시트 높이만큼 올린다.
 * 시트는 화면 맨 아래(탭바 64px 포함)에 붙으므로 실제 겹침은 시트 높이 − 64, 여기에 여백 12px.
 * - 대여소 시트(peek 110px): 110 − 64 + 12 = 58
 * - 목적지 시트(mini 200px): 200 − 64 + 12 = 148
 */
const LIFT_FOR_STATION_CLASS = '-translate-y-[58px]';
// mini(200px) 시트 공용 — 목적지 확인 시트·대여 시트가 같은 높이라 값을 같이 쓴다
const LIFT_FOR_MINI_SHEET_CLASS = '-translate-y-[148px]';

/**
 * 대여소 목록을 다시 받아오는 주기(ms).
 * 수집기가 45초마다 Redis 스냅샷을 통째로 갈아끼우므로(`TASHU_INTERVAL_SECONDS`) 그 주기에 맞춘다.
 * 이걸 두지 않으면 화면을 켜 둔 동안 갱신 배지의 숫자만 계속 커지고, 대여소를 탭해서 부르는
 * 상세(그때그때 최신 스냅샷을 읽는다)와 기준 시각이 어긋난다.
 */
const STATIONS_REFETCH_INTERVAL_MS = 45 * 1000;

/**
 * 07 메인 지도 — 네이버 지도 + 대여소 마커 + 오버레이 UI.
 * 상태는 기능별 훅(useJourneyPlanner·useRouteGuide·useRentalSheets·useNoticePopup)이 들고,
 * 이 컴포넌트는 URL 단계 플래그를 파생해 훅과 화면을 잇는 조립만 한다.
 */
export function MapHomePage() {
  const { message, showToast } = useToast();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInUrl = searchParams.get(SEARCH_PARAM) === '1';
  const compareInUrl = searchParams.get(ROUTES_PARAM) === '1';
  // 지도 선택 모드에서는 검색 화면을 덮는다(둘 다 전체 화면이라 하나만 보여야 한다)
  const searchOpen = searchInUrl && searchParams.get(PICK_PARAM) !== '1';
  const detailInUrl = searchParams.get(DETAIL_PARAM) === '1';
  const guideInUrl = searchParams.get(GUIDE_PARAM) === '1';
  const pickInUrl = searchParams.get(PICK_PARAM) === '1';
  const startFieldInUrl = searchParams.get(FIELD_PARAM) === START_FIELD_VALUE;

  // 현재위치 버튼을 누른 횟수 — 같은 자리에서 다시 눌러도 지도가 그 위치로 돌아오게 하는 신호
  const [locationFocusToken, setLocationFocusToken] = useState(0);
  const [stationMarkersVisible, setStationMarkersVisible] = useState(true);
  const [routeStartChoice, setRouteStartChoice] = useState<{
    current: Pos;
    distanceM: number;
  } | null>(null);
  const [routeStartPending, setRouteStartPending] = useState<
    'to-start' | 'from-current' | null
  >(null);
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

  // 마커와 갱신 배지가 같은 목록을 쓴다
  const {
    data: stations,
    dataUpdatedAt,
    refetch: refetchStations,
  } = useQuery({
    queryKey: BIKE_STATIONS_QUERY_KEY,
    queryFn: getBikeStations,
    refetchInterval: STATIONS_REFETCH_INTERVAL_MS,
  });

  /*
   * 새로고침 버튼의 회전은 **사용자가 누른 갱신**만 따라간다.
   * 쿼리의 isFetching을 쓰면 45초마다 도는 자동 갱신에도 아이콘이 혼자 돌고 버튼이 잠깐 잠긴다.
   */
  const [refreshingStations, setRefreshingStations] = useState(false);

  /**
   * 대여소 잔여 대수를 지금 다시 받아온다. 성공하면 관측 시각이 새로 찍혀 갱신 배지도 0초로 돌아간다.
   * 실패해도 지도에 이미 그려진 대여소는 그대로 둔다 — 화면을 비우는 것보다 오래된 값이라도 보이는 편이 낫다.
   */
  async function refreshStations() {
    setRefreshingStations(true);
    try {
      // throwOnError를 켜야 실패가 예외로 온다 — 기본값은 이미 받아둔 데이터가 있으면 성공처럼 보인다
      await refetchStations({ throwOnError: true });
    } catch {
      showToast('대여소 정보를 새로 불러오지 못했습니다.');
    } finally {
      setRefreshingStations(false);
    }
  }

  const popup = useNoticePopup();
  const rental = useRentalSheets(stations);


  /**
   * QR 대여·반납. 스캔 화면은 민원·상태확인이 쓰던 것을 그대로 쓰고(`?next=/`),
   * 돌아올 때 붙는 `?code=`를 한 번 처리한 뒤 지운다.
   */
  const cycleRental = useCycleRental({ stations, position: location.position, showToast });
  /** 빌린 자전거가 있으면 하단 버튼과 대여소 시트가 "반납하기"로 바뀐다 */
  const hasRentedCycle = cycleRental.session !== null;
  useScannedCode(searchParams.get(CODE_PARAM), cycleRental.handleCode, () => {
    setSearchParams(
      (params) => {
        params.delete(CODE_PARAM);
        return params;
      },
      { replace: true },
    );
  });

  /**
   * 하단 버튼 — QR로 자전거를 확인한다. 카메라를 못 쓰면 그 화면의 번호 직접 입력으로 넘어간다.
   * 대여인지 반납인지는 스캔 결과를 받은 `useCycleRental`이 가르므로 여기서는 나누지 않는다.
   */
  function openScanner() {
    navigate(`/report/scan?next=${encodeURIComponent('/')}`);
  }

  function toggleStationMarkers() {
    if (stationMarkersVisible) rental.selectStation(null);
    setStationMarkersVisible((visible) => !visible);
  }
  const journey = useJourneyPlanner({ location, showToast, viewedCenterAsStart });
  const { destination, routeResult, routeSummaries, selectedRouteIndex } = journey;
  const consumedRecommendedRouteRef = useRef(false);

  useEffect(() => {
    if (consumedRecommendedRouteRef.current) return;
    const intent = readRecommendedRouteIntent(routeLocation.state);
    if (intent === null) return;
    consumedRecommendedRouteRef.current = true;
    // 일회성 state를 먼저 지워 새로고침·뒤로가기로 같은 코스가 반복해서 열리지 않게 한다.
    navigate(`${routeLocation.pathname}${routeLocation.search}`, { replace: true, state: null });
    void getRecommendedCourseRoute(intent.courseId)
      .then((course) => {
        const start = course.waypoints[0];
        const end = course.waypoints.at(-1);
        if (start === undefined || end === undefined)
          throw new Error('추천 코스 경유지가 없습니다.');
        journey.openRecommendedRoute(waypointToPlace(start), waypointToPlace(end), course.route);
      })
      .catch(() => showToast('추천 코스를 불러오지 못했습니다. 다시 시도해 주세요.'));
  }, [
    journey,
    navigate,
    routeLocation.pathname,
    routeLocation.search,
    routeLocation.state,
    showToast,
  ]);

  // 시트는 한 번에 하나만: 대여소를 탭하면 대여소 시트가 우선하고, 검색 중에는 전부 숨긴다.
  // 경로 후보가 있고 URL이 비교 중이면 목적지 확인 시트 대신 비교 시트·경로선·범례가 뜬다
  // 선택 모드에서는 지도만 보여준다 — 시트·검색바·버튼이 모두 비켜야 지도를 움직일 수 있다
  const pickActive = pickInUrl && searchInUrl;
  const stationSheetOpen = rental.selectedStation !== null && !pickActive;
  const compareActive = routeResult !== null && compareInUrl && !searchOpen && !pickActive;
  // 11 상세는 비교 위에 한 단계 더 쌓인 상태다
  const detailActive = compareActive && detailInUrl;
  /**
   * 지금 고른 경로 — 화면 단계와 무관하다. 10 비교에서 바로 안내를 시작할 수 있어야 해서
   * 상세를 거치지 않아도 값이 있어야 한다.
   */
  const selectedRoute =
    selectedRouteIndex === null ? null : (routeResult?.routes[selectedRouteIndex] ?? null);
  /** 지도에 한 경로만 그리는 건 상세 단계부터다 — 비교에서는 후보를 전부 그린다 */
  const detailRoute = detailActive ? selectedRoute : null;
  // 12 안내는 상세 위에 한 단계 더 쌓인 상태다
  const guideActive = detailActive && guideInUrl && detailRoute !== null;
  /*
   * 바라보는 방향은 **안내 중에만** 켠다. 방위 센서는 계속 켜 두면 배터리를 먹고,
   * 지도를 구경할 때는 화살표가 쓸모없다 — 길을 따라갈 때만 필요하다.
   */
  const heading = useDeviceHeading(guideActive);
  const compareSheetOpen = compareActive && !stationSheetOpen && !detailActive;
  const detailSheetOpen = detailActive && !stationSheetOpen && !guideActive;
  const destinationSheetOpen =
    destination !== null && !stationSheetOpen && !searchOpen && !compareActive && !pickActive;

  // 선택 모드의 지도 조작 — 탭한 지점으로 지도를 옮기고, 멈추면 그 지점의 주소를 읽는다
  const pickAddress = useMapPick({ mapRef, active: pickActive });

  const guide = useRouteGuide({
    guideActive,
    detailRoute,
    destinationTitle: destination?.title ?? '목적지',
    destinationPos:
      destination === null ? null : { xPos: destination.xPos, yPos: destination.yPos },
    totalSec:
      selectedRouteIndex === null ? null : (routeSummaries[selectedRouteIndex]?.totalSec ?? 0),
    location,
    clearJourney: journey.clearDestination,
    replaceRoutes: journey.replaceRoutes,
    rerouteEnabled: !journey.staticRouteActive,
    intermediateArrival: journey.guidingToCustomStart,
    onIntermediateArrival: journey.continueAfterReachingStart,
    showToast,
  });

  /**
   * 목적지를 고르는 화면을 연다. 07 검색바에서도, **10 비교 화면의 도착 칸에서도** 이 함수 하나를 쓴다.
   * 함수형 업데이트로 기존 쿼리(특히 `routes=1`)를 그대로 두고 `search`만 얹는다 —
   * 객체를 통째로 넘기면 다른 값이 지워진다(react-router의 `setSearchParams`는 전체 교체가 기본값).
   */
  function openSearch() {
    // 목적지를 고르면 지도가 그 위로 옮겨진다 — 사용자가 "지금 보고 있던 곳"은 지금 기록해 둬야 한다
    rememberViewedCenter();
    // 검색 화면이 시트를 덮지 못하므로(시트 z-index가 더 높음) 먼저 닫는다
    rental.closeStationSheet();
    setSearchParams((params) => {
      params.set(SEARCH_PARAM, '1');
      return params;
    });
  }

  /**
   * 출발지를 고르는 화면을 연다. 08 검색 화면의 출발지 줄에서도, **10 비교 화면의 출발 칸에서도** 쓴다.
   * `routes=1`이 있었다면(10에서 들어온 경우) 그대로 유지돼 뒤로가기 한 번에 10으로 돌아간다.
   */
  function openStartSearch() {
    setSearchParams((params) => {
      params.set(SEARCH_PARAM, '1');
      params.set(FIELD_PARAM, START_FIELD_VALUE);
      return params;
    });
  }

  /** 08 "지도에서 선택" — 검색 위에 한 단계 쌓는다. 뒤로가기가 곧 취소다. 기존 field·routes는 그대로 둔다 */
  function openMapPick() {
    setSearchParams((params) => {
      params.set(SEARCH_PARAM, '1');
      params.set(PICK_PARAM, '1');
      return params;
    });
  }

  /** 취소 — 검색 화면으로 돌아간다 */
  function cancelMapPick() {
    navigate(-1);
  }

  /**
   * 확정 — 지금 지도 중심을 목적지(또는 field='start'면 출발지)로 삼는다.
   * 열면서 쌓은 두 단계(검색·선택)를 함께 닫는다 — 이 화면이 09에서 열렸으면 07로,
   * 10 비교 화면에서 열렸으면(`routes=1`이 계속 남아 있었으므로) 그 화면으로 돌아간다.
   */
  function confirmMapPick() {
    const center = mapRef.current?.getCenter();
    if (!(center instanceof naver.maps.LatLng)) {
      showToast('지도를 아직 불러오지 못했습니다.');
      return;
    }
    // 주소는 지도가 멈춰 있는 동안 읽어 둔 것이다 — 움직이는 중이면 null이라 좌표만 넘어간다
    journey.applyPickedPos(
      latLngToPos({ lat: center.lat(), lng: center.lng() }),
      startFieldInUrl,
      pickAddress.place,
    );
    // 정상 흐름은 검색(1)+선택(1) 두 push를 함께 닫는 -2가 맞지만, 새로고침·딥링크로
    // 이 상태에 바로 들어오면 히스토리가 부족해 앱 밖으로 나가 버린다 — 그때는 파라미터만 걷어낸다
    const historyIdx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIdx >= 2) {
      navigate(-2);
    } else {
      setSearchParams(
        (params) => {
          params.delete(PICK_PARAM);
          params.delete(SEARCH_PARAM);
          params.delete(FIELD_PARAM);
          return params;
        },
        { replace: true },
      );
    }
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

  // ← 버튼: 비교(10)·상세(11)를 한 단계 닫는다. 열 때 히스토리를 하나 쌓았으니 뒤로가기와 같다
  function exitCompare() {
    navigate(-1);
  }

  function exitRouteDetail() {
    navigate(-1);
  }

  /** 상세 화면에서 실제 안내 화면으로 들어가는 공통 처리. */
  function activateGuide() {
    // 브라우저는 사용자가 누르지 않은 상태의 첫 소리를 막는다 — 이 클릭 안에서 권한을 받아 둔다
    guide.primeVoice();
    // 경로 전체를 보던 축척 그대로면 길이 안 보인다 — 안내를 시작할 때 현재 위치로 확대한다
    setLocationFocusToken((token) => token + 1);
    setSearchParams({ [ROUTES_PARAM]: '1', [DETAIL_PARAM]: '1', [GUIDE_PARAM]: '1' });
  }

  // 10·11의 "안내 시작" → 선택 출발지와 실제 GPS가 다르면 먼저 시작 방식을 묻는다.
  async function startGuide() {
    if (selectedRoute === null) return;
    if (journey.customStart === null) {
      activateGuide();
      return;
    }
    const result = await location.request();
    if (!result.ok) {
      showToast(`${LOCATION_ERROR_TEXT[result.error]} 출발 위치를 확인한 뒤 다시 시도해 주세요.`);
      return;
    }
    const selectedStart = {
      xPos: journey.customStart.xPos,
      yPos: journey.customStart.yPos,
    };
    if (!needsRouteStartChoice(result.position, selectedStart)) {
      activateGuide();
      return;
    }
    setRouteStartChoice({
      current: result.position,
      distanceM: distanceToRouteStart(result.position, selectedStart),
    });
  }

  /** 실제 위치에서 사용자가 고른 출발지까지 먼저 안내하고 원래 경로를 이어 간다. */
  async function guideToSelectedStart() {
    if (routeStartChoice === null || selectedRoute === null) return;
    // 비동기 경로 조회 전에 사용자 클릭 문맥에서 음성을 먼저 준비한다.
    guide.primeVoice();
    setRouteStartPending('to-start');
    const loaded = await journey.startGuideToCustomStart(routeStartChoice.current, selectedRoute);
    setRouteStartPending(null);
    if (!loaded) return;
    setRouteStartChoice(null);
    activateGuide();
  }

  /** 사용자가 고른 출발지는 취소하고 실제 위치에서 목적지까지 다시 계산해 안내한다. */
  async function guideFromCurrentLocation() {
    if (routeStartChoice === null) return;
    guide.primeVoice();
    setRouteStartPending('from-current');
    const loaded = await journey.startGuideFromCurrentLocation(routeStartChoice.current);
    setRouteStartPending(null);
    if (!loaded) return;
    setRouteStartChoice(null);
    activateGuide();
  }

  // 대여·반납 시트도 목적지 시트와 같은 mini(200px) 높이라 같은 값만큼 띄운다
  const liftClass = stationSheetOpen
    ? LIFT_FOR_STATION_CLASS
    : destinationSheetOpen || rental.returnSheetOpen
      ? LIFT_FOR_MINI_SHEET_CLASS
      : '';
  // "대여하기"는 아무것도 열려 있지 않은 맨 처음 지도에서만 필요하다 — 대여소를 보거나 목적지를
  // 확정하려는 중이면 이미 다른 화면으로 넘어간 것이라 굳이 보여줄 이유가 없다
  const showRentButton =
    !stationSheetOpen && !destinationSheetOpen && !searchOpen && !rental.returnSheetOpen;

  return (
    <div className="relative h-full overflow-hidden">
      <MapView
        stations={stationMarkersVisible ? stations : []}
        selectedStationId={rental.selectedStationId}
        onSelectStation={rental.selectStation}
        destination={destination}
        routes={compareActive ? routeResult.routes : null}
        selectedRouteIndex={selectedRouteIndex}
        detailRoute={detailRoute}
        currentLocation={location.position}
        heading={heading}
        locationFocusToken={locationFocusToken}
        followLocation={guideActive}
        pickActive={pickActive}
        onMapReady={handleMapReady}
      />

      {pickActive ? (
        <MapPickLayer
          isStart={startFieldInUrl}
          address={pickAddress}
          onCancel={cancelMapPick}
          onConfirm={confirmMapPick}
        />
      ) : guideActive && guide.guideProgress !== null ? (
        <RouteGuideCard
          progress={guide.guideProgress}
          nextCue={guide.nextCue}
          isLastLeg={guide.guideProgress.legIndex === guide.guideLegCount - 1}
          legCount={guide.guideLegCount}
          locationUnknown={location.position === null}
          rerouting={guide.rerouting}
          voiceOn={guide.voiceOn}
          voiceSupported={guide.voiceSupported}
          onToggleVoice={guide.toggleVoice}
        />
      ) : detailActive ? (
        <RouteDetailControls onBack={exitRouteDetail} destinationTitle={destination?.title ?? ''} />
      ) : compareActive ? (
        <RouteCompareControls
          onBack={exitCompare}
          onRefresh={journey.searchRoutes}
          refreshing={journey.searchPending}
          startLabel={journey.startLabel}
          destinationLabel={destination?.title ?? ''}
          onEditStart={openStartSearch}
          onEditDestination={openSearch}
          onSwap={journey.swapStartAndDestination}
        />
      ) : (
        /* 상단 — 검색바, 공지 배너, 갱신 배지 */
        <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 px-4 pb-4">
          <div className="pointer-events-auto mt-6 w-full">
            <SearchBar onClick={openSearch} value={destination?.title} />
          </div>
          <div className="flex w-full items-start justify-between gap-2">
            <NotificationButton onClick={() => navigate('/notifications')} />
            <div className="flex flex-col items-end gap-1.5">
              <div className="pointer-events-auto">
                <NoticeBanner onClick={() => navigate(NOTICES_PATH)} />
              </div>
              {stations ? (
                <div className="pointer-events-auto inline-flex items-center overflow-hidden rounded-full border border-line/90 bg-surface/95 shadow-[0_6px_18px_rgba(24,33,21,0.12)] backdrop-blur-md">
                  <UpdatedBadge grouped updatedAt={dataUpdatedAt} />
                  <StationRefreshButton
                    compact
                    onClick={refreshStations}
                    refreshing={refreshingStations}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* 하단 — 현재위치 버튼과 대여하기 버튼 (홈 인디케이터 여백은 탭바가 처리). 경로 비교 중에는 시트가 그 자리를 쓴다 */}
      {compareActive || pickActive ? null : (
        <div
          className={`absolute inset-x-0 bottom-0 z-10 flex flex-col items-end gap-3 p-4 transition-transform duration-300 ease-out ${liftClass}`}
        >
          <div
            role="toolbar"
            aria-label="지도 도구"
            className="flex items-center self-end rounded-[19px] border border-white/90 bg-surface/95 p-1 shadow-[0_10px_28px_rgba(24,33,21,0.16)] backdrop-blur-xl"
          >
            <WeatherButton inDock />
            <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-line/80" />
            <StationVisibilityToggle
              enabled={stationMarkersVisible}
              onToggle={toggleStationMarkers}
            />
            <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-line/80" />
            <CurrentLocationButton
              inDock
              onClick={focusCurrentLocation}
              loading={location.loading}
            />
          </div>
          {showRentButton ? (
            <button
              type="button"
              onClick={openScanner}
              className="flex min-h-[64px] w-full items-center gap-3 rounded-[22px] border border-white/90 bg-surface/95 px-3.5 text-left shadow-[0_12px_32px_rgba(24,33,21,0.18)] backdrop-blur-md transition-[scale,box-shadow] duration-100 active:scale-[0.985] active:shadow-lg"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-sm">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
                  <path
                    d="M4.5 4.5h5v5h-5zm10 0h5v5h-5zm-10 10h5v5h-5z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                  />
                  <path d="M14.5 14.5h2v2h-2zm3 0h2v5h-2zm-3 3h2v2h-2z" fill="currentColor" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-ink">
                  {hasRentedCycle ? '타슈 반납하기' : '타슈 대여하기'}
                </span>
                <span className="mt-0.5 block text-xs font-medium text-muted">
                  {hasRentedCycle
                    ? `${cycleRental.session?.cycleId ?? ''} 자전거를 반납해요`
                    : '자전거 번호를 입력해요'}
                </span>
              </span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                  <path
                    d="m9 5 7 7-7 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
          ) : null}
        </div>
      )}

      <StationSheet
        station={rental.selectedStation}
        snap={rental.stationSnap}
        onSnapChange={rental.setStationSnap}
        onClose={() => rental.selectStation(null)}
        rented={hasRentedCycle}
        onRent={openScanner}
        onReturn={rental.openReturnSheet}
      />

      <CycleReturnSheet
        open={rental.returnSheetOpen}
        stations={stations}
        ensureLocation={location.ensure}
        onClose={rental.closeReturnSheet}
        onReturned={() => {
          // 번호를 직접 입력해 반납해도 "빌린 자전거" 기억은 지워야 다음 QR이 대여로 잡힌다
          clearRentalSession();
          // 저장소만 지우면 화면은 모른다 — 버튼이 "대여하기"로 돌아가도록 함께 알린다
          cycleRental.syncSession();
          showToast('반납이 완료됐습니다.');
        }}
      />

      <DestinationSheet
        destination={destinationSheetOpen ? destination : null}
        searching={journey.searchPending}
        onSearchRoutes={journey.searchRoutes}
        onClose={journey.clearDestination}
      />

      {routeResult === null ? null : (
        <RouteCompareSheet
          open={compareSheetOpen}
          snap={journey.compareSnap}
          onSnapChange={journey.setCompareSnap}
          summaries={routeSummaries}
          fetchedAt={routeResult.fetchedAt}
          sort={journey.routeSort}
          onSortChange={journey.changeRouteSort}
          selectedIndex={selectedRouteIndex}
          onSelect={journey.setSelectedRouteIndex}
          onOpenDetail={journey.openRouteDetail}
          onStart={startGuide}
          showToast={showToast}
        />
      )}

      {routeResult === null ? null : (
        <RouteDetailSheet
          open={detailSheetOpen}
          route={detailRoute}
          summary={
            selectedRouteIndex === null ? null : (routeSummaries[selectedRouteIndex] ?? null)
          }
          fetchedAt={routeResult.fetchedAt}
          onStart={startGuide}
          onBack={exitRouteDetail}
        />
      )}

      <RouteStartChoiceSheet
        open={routeStartChoice !== null}
        startName={journey.customStart?.title ?? '선택한 출발지'}
        distanceM={routeStartChoice?.distanceM ?? 0}
        recommendedCourse={journey.staticRouteActive}
        pending={routeStartPending}
        onGuideToStart={guideToSelectedStart}
        onStartFromCurrent={guideFromCurrentLocation}
        onClose={() => {
          if (routeStartPending === null) setRouteStartChoice(null);
        }}
      />

      {/* 안내 시트 — pickActive와는 파생상 동시에 참일 수 없어 분기가 필요 없다
          (MapPickLayer는 위 상단 오버레이 자리에서 한 번만 마운트한다) */}
      {guideActive && guide.guideProgress !== null ? (
        <RouteGuideSheet
          open
          progress={guide.guideProgress}
          remainingSec={guide.guideRemainingSec}
          onEnd={guide.endGuide}
        />
      ) : null}

      {/* 검색 오버레이는 탭바(z-20)를 덮고, 토스트(z-50)보다는 아래에 둔다 */}
      {searchOpen ? (
        <PlaceSearchOverlay
          // field가 바뀌면 입력 중이던 검색어·결과를 새로 시작해야 하므로 컴포넌트를 새로 만든다
          key={startFieldInUrl ? 'start' : 'destination'}
          field={startFieldInUrl ? 'start' : 'destination'}
          onClose={journey.closeSearch}
          onSelect={startFieldInUrl ? journey.selectStart : journey.selectDestination}
          currentLocation={location.position}
          onRefreshLocation={refreshLocation}
          locationLoading={location.loading}
          onPickOnMap={openMapPick}
          showToast={showToast}
          startLabel={journey.startLabel}
          onEditStart={openStartSearch}
          onSwap={journey.swapStartAndDestination}
          onUseCurrentLocationAsStart={journey.resetStartToCurrentLocation}
        />
      ) : null}

      {message && <Toast message={message} />}

      {!popup.closed && popup.notices && popup.notices.length > 0 && (
        <NoticePopup
          notices={popup.notices}
          onClose={popup.close}
          onHideForWeek={popup.closeForWeek}
          onOpenNotice={popup.openNotice}
        />
      )}

      {guide.arrivalSummary ? (
        <ArrivalSummaryScreen
          destinationTitle={guide.arrivalSummary.destinationTitle}
          elapsedSec={guide.arrivalSummary.elapsedSec}
          totalDistanceM={guide.arrivalSummary.totalDistanceM}
          bikeDistanceM={guide.arrivalSummary.bikeDistanceM}
          route={guide.arrivalSummary.route}
          onClose={guide.closeArrivalSummary}
        />
      ) : null}
    </div>
  );
}
