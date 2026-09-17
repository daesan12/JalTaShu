import { useCallback, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import type { Pos } from '@/shared/api/types';
import { latLngToPos } from '@/shared/lib/coords';
import { Button } from '@/shared/ui/Button';
import { BIKE_STATIONS_QUERY_KEY, getBikeStations } from '@/features/map/api/stations';
import { ArrivalSummaryScreen } from '@/features/map/components/ArrivalSummaryScreen';
import { CurrentLocationButton } from '@/features/map/components/CurrentLocationButton';
import { CycleRentSheet } from '@/features/map/components/CycleRentSheet';
import { CycleReturnSheet } from '@/features/map/components/CycleReturnSheet';
import { DestinationSheet } from '@/features/map/components/DestinationSheet';
import { MapPickLayer } from '@/features/map/components/MapPickLayer';
import { MapView } from '@/features/map/components/MapView';
import { NoticeBanner } from '@/features/map/components/NoticeBanner';
import { NoticePopup } from '@/features/map/components/NoticePopup';
import { PlaceSearchOverlay } from '@/features/map/components/PlaceSearchOverlay';
import { RouteCompareControls } from '@/features/map/components/RouteCompareControls';
import { RouteCompareSheet } from '@/features/map/components/RouteCompareSheet';
import { RouteDetailControls } from '@/features/map/components/RouteDetailControls';
import { RouteDetailSheet } from '@/features/map/components/RouteDetailSheet';
import { RouteGuideCard } from '@/features/map/components/RouteGuideCard';
import { RouteGuideSheet } from '@/features/map/components/RouteGuideSheet';
import { SearchBar } from '@/features/map/components/SearchBar';
import { StationSheet } from '@/features/map/components/StationSheet';
import { Toast } from '@/features/map/components/Toast';
import { UpdatedBadge } from '@/features/map/components/UpdatedBadge';
import { LOCATION_ERROR_TEXT, useCurrentLocation } from '@/features/map/hooks/useCurrentLocation';
import { useJourneyPlanner } from '@/features/map/hooks/useJourneyPlanner';
import { useNoticePopup } from '@/features/map/hooks/useNoticePopup';
import { useRentalSheets } from '@/features/map/hooks/useRentalSheets';
import { useRouteGuide } from '@/features/map/hooks/useRouteGuide';
import { useToast } from '@/shared/lib/useToast';
import { START_POS_FALLBACK } from '@/features/map/lib/mapDefaults';
import { NOTICES_PATH } from '@/features/map/lib/noticeLink';
import {
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
 * 07 메인 지도 — 네이버 지도 + 대여소 마커 + 오버레이 UI.
 * 상태는 기능별 훅(useJourneyPlanner·useRouteGuide·useRentalSheets·useNoticePopup)이 들고,
 * 이 컴포넌트는 URL 단계 플래그를 파생해 훅과 화면을 잇는 조립만 한다.
 */
export function MapHomePage() {
  const { message, showToast } = useToast();
  const navigate = useNavigate();
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
  const { data: stations } = useQuery({
    queryKey: BIKE_STATIONS_QUERY_KEY,
    queryFn: getBikeStations,
  });
  const updatedAt = stations?.[0]?.updatedAt;

  const popup = useNoticePopup();
  const rental = useRentalSheets(stations);
  const journey = useJourneyPlanner({ location, showToast, viewedCenterAsStart });
  const { destination, routeResult, routeSummaries, selectedRouteIndex } = journey;

  // 시트는 한 번에 하나만: 대여소를 탭하면 대여소 시트가 우선하고, 검색 중에는 전부 숨긴다.
  // 경로 후보가 있고 URL이 비교 중이면 목적지 확인 시트 대신 비교 시트·경로선·범례가 뜬다
  // 선택 모드에서는 지도만 보여준다 — 시트·검색바·버튼이 모두 비켜야 지도를 움직일 수 있다
  const pickActive = pickInUrl && searchInUrl;
  const stationSheetOpen = rental.selectedStation !== null && !pickActive;
  const compareActive = routeResult !== null && compareInUrl && !searchOpen && !pickActive;
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
    destination !== null && !stationSheetOpen && !searchOpen && !compareActive && !pickActive;

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
    journey.applyPickedPos(latLngToPos({ lat: center.lat(), lng: center.lng() }), startFieldInUrl);
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

  // 11의 "안내 시작" → 12 안내 진행
  function startGuide() {
    // 브라우저는 사용자가 누르지 않은 상태의 첫 소리를 막는다 — 이 클릭 안에서 권한을 받아 둔다
    guide.primeVoice();
    // 경로 전체를 보던 축척 그대로면 길이 안 보인다 — 안내를 시작할 때 현재 위치로 확대한다
    setLocationFocusToken((token) => token + 1);
    setSearchParams({ [ROUTES_PARAM]: '1', [DETAIL_PARAM]: '1', [GUIDE_PARAM]: '1' });
  }

  // 대여·반납 시트도 목적지 시트와 같은 mini(200px) 높이라 같은 값만큼 띄운다
  const liftClass = stationSheetOpen
    ? LIFT_FOR_STATION_CLASS
    : destinationSheetOpen || rental.rentSheetOpen || rental.returnSheetOpen
      ? LIFT_FOR_MINI_SHEET_CLASS
      : '';
  // "대여하기"는 아무것도 열려 있지 않은 맨 처음 지도에서만 필요하다 — 대여소를 보거나 목적지를
  // 확정하려는 중이면 이미 다른 화면으로 넘어간 것이라 굳이 보여줄 이유가 없다
  const showRentButton =
    !stationSheetOpen &&
    !destinationSheetOpen &&
    !searchOpen &&
    !rental.rentSheetOpen &&
    !rental.returnSheetOpen;

  return (
    <div className="relative h-full overflow-hidden">
      <MapView
        stations={stations}
        selectedStationId={rental.selectedStationId}
        onSelectStation={rental.selectStation}
        destination={destination}
        routes={compareActive ? routeResult.routes : null}
        selectedRouteIndex={selectedRouteIndex}
        detailRoute={detailRoute}
        currentLocation={location.position}
        locationFocusToken={locationFocusToken}
        followLocation={guideActive}
        onMapReady={handleMapReady}
      />

      {pickActive ? (
        <MapPickLayer onCancel={cancelMapPick} onConfirm={confirmMapPick} />
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
      {compareActive || pickActive ? null : (
        <div
          className={`absolute inset-x-0 bottom-0 z-10 flex flex-col items-end gap-3 p-4 transition-transform duration-300 ease-out ${liftClass}`}
        >
          <CurrentLocationButton onClick={focusCurrentLocation} loading={location.loading} />
          {showRentButton ? (
            <Button full onClick={rental.openRentSheet}>
              대여하기
            </Button>
          ) : null}
        </div>
      )}

      <StationSheet
        station={rental.selectedStation}
        snap={rental.stationSnap}
        onSnapChange={rental.setStationSnap}
        onClose={() => rental.selectStation(null)}
        onReturn={rental.openReturnSheet}
      />

      <CycleRentSheet
        open={rental.rentSheetOpen}
        onClose={rental.closeRentSheet}
        onRented={() => showToast('대여가 완료됐습니다. 안전하게 이용해 주세요.')}
      />

      <CycleReturnSheet
        open={rental.returnSheetOpen}
        stationId={rental.returnStationId}
        onClose={rental.closeReturnSheet}
        onReturned={() => showToast('반납이 완료됐습니다.')}
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
          onStart={journey.openRouteDetail}
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
