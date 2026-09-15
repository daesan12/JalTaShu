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
import { CycleRentSheet } from '@/features/map/components/CycleRentSheet';
import { DestinationSheet } from '@/features/map/components/DestinationSheet';
import { MapPickLayer } from '@/features/map/components/MapPickLayer';
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
import { StationSheet, type StationSnap } from '@/features/map/components/StationSheet';
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
 * 08 "지도에서 선택"은 검색 위에 한 단계 더(`?search=1&pick=1`).
 * 취소·뒤로가기는 검색으로 돌아가고, 확정하면 검색까지 한 번에 닫는다.
 */
const PICK_PARAM = 'pick';

/**
 * 08에서 출발지를 고르는 중이면 `?search=1&field=start`(목적지 검색 위에 한 단계 더).
 * "지도에서 선택"까지 들어가면 `?search=1&field=start&pick=1`. 값이 없거나 다르면 목적지 모드다.
 */
const FIELD_PARAM = 'field';
const START_FIELD_VALUE = 'start';

/** 지도에서 고른 지점의 이름 — 역지오코딩을 하지 않으므로 주소 대신 이 문구를 쓴다 */
const PICKED_PLACE_TITLE = '지도에서 선택한 위치';
/** 바꾸기(↕) 버튼으로 목적지 자리에 들어갈 때 쓰는, 이전 출발 위치의 이름 */
const SWAPPED_START_TITLE = '출발했던 위치';

/**
 * 시트가 열리면 하단 버튼을 시트 높이만큼 올린다.
 * 시트는 화면 맨 아래(탭바 64px 포함)에 붙으므로 실제 겹침은 시트 높이 − 64, 여기에 여백 12px.
 * - 대여소 시트(peek 110px): 110 − 64 + 12 = 58
 * - 목적지 시트(mini 200px): 200 − 64 + 12 = 148
 */
const LIFT_FOR_STATION_CLASS = '-translate-y-[58px]';
// mini(200px) 시트 공용 — 목적지 확인 시트·대여 시트가 같은 높이라 값을 같이 쓴다
const LIFT_FOR_MINI_SHEET_CLASS = '-translate-y-[148px]';

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
  const searchInUrl = searchParams.get(SEARCH_PARAM) === '1';
  const compareInUrl = searchParams.get(ROUTES_PARAM) === '1';
  // 지도 선택 모드에서는 검색 화면을 덮는다(둘 다 전체 화면이라 하나만 보여야 한다)
  const searchOpen = searchInUrl && searchParams.get(PICK_PARAM) !== '1';
  const detailInUrl = searchParams.get(DETAIL_PARAM) === '1';
  const guideInUrl = searchParams.get(GUIDE_PARAM) === '1';
  const pickInUrl = searchParams.get(PICK_PARAM) === '1';
  const startFieldInUrl = searchParams.get(FIELD_PARAM) === START_FIELD_VALUE;
  const [compareSnap, setCompareSnap] = useState<RouteCompareSnap>('half');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [stationSnap, setStationSnap] = useState<StationSnap>('peek');
  const [destination, setDestination] = useState<PlaceSearchResult | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeSort, setRouteSort] = useState<RouteSort>('bikes');
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  // 현재위치 버튼을 누른 횟수 — 같은 자리에서 다시 눌러도 지도가 그 위치로 돌아오게 하는 신호
  const [locationFocusToken, setLocationFocusToken] = useState(0);
  const [rentSheetOpen, setRentSheetOpen] = useState(false);
  // 출발지를 직접 골랐을 때만 값이 있다. null이면 항상 현재 위치가 출발지다
  const [customStart, setCustomStart] = useState<PlaceSearchResult | null>(null);
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

  // 대여소를 고르면 항상 요약부터 보여준다 — 확장 상태가 다음 대여소로 따라오면 안 된다.
  // 시트는 한 번에 하나라 대여 시트가 열려 있었으면 같이 닫는다
  function selectStation(stationId: string | null) {
    setStationSnap('peek');
    setSelectedStationId(stationId);
    if (stationId !== null) setRentSheetOpen(false);
  }

  // 대여소 시트가 열려 있으면 먼저 닫는다(시트는 한 번에 하나)
  function openRentSheet() {
    setSelectedStationId(null);
    setRentSheetOpen(true);
  }

  /**
   * 목적지를 고르는 화면을 연다. 07 검색바에서도, **10 비교 화면의 도착 칸에서도** 이 함수 하나를 쓴다.
   * 함수형 업데이트로 기존 쿼리(특히 `routes=1`)를 그대로 두고 `search`만 얹는다 —
   * 객체를 통째로 넘기면 다른 값이 지워진다(react-router의 `setSearchParams`는 전체 교체가 기본값).
   */
  function openSearch() {
    // 목적지를 고르면 지도가 그 위로 옮겨진다 — 사용자가 "지금 보고 있던 곳"은 지금 기록해 둬야 한다
    rememberViewedCenter();
    // 검색 화면이 시트를 덮지 못하므로(시트 z-index가 더 높음) 먼저 닫는다
    setSelectedStationId(null);
    setSearchParams((params) => {
      params.set(SEARCH_PARAM, '1');
      return params;
    });
  }

  // 열 때 히스토리를 하나 쌓았으니 닫기는 뒤로가기와 같다
  function closeSearch() {
    navigate(-1);
  }

  /** 08 "지도에서 선택" — 검색 위에 한 단계 쌓는다. 뒤로가기가 곧 취소다. 기존 field·routes는 그대로 둔다 */
  function openMapPick() {
    setSearchParams((params) => {
      params.set(SEARCH_PARAM, '1');
      params.set(PICK_PARAM, '1');
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

  /** 취소 — 검색 화면으로 돌아간다 */
  function cancelMapPick() {
    navigate(-1);
  }

  /**
   * 확정 — 지금 지도 중심을 목적지(또는 field='start'면 출발지)로 삼는다.
   * 열면서 쌓은 두 단계(검색·선택)를 함께 닫는다 — 이 화면이 09에서 열렸으면 07로,
   * 10 비교 화면에서 열렸으면(`routes=1`이 계속 남아 있었으므로) 그 화면으로 돌아간다.
   * 이미 비교 중이었다면 새 값으로 바로 다시 조회한다.
   */
  function confirmMapPick() {
    const center = mapRef.current?.getCenter();
    if (!(center instanceof naver.maps.LatLng)) {
      showToast('지도를 아직 불러오지 못했습니다.');
      return;
    }
    const { xPos, yPos } = latLngToPos({ lat: center.lat(), lng: center.lng() });
    // 역지오코딩을 하지 않으므로 주소는 비운다 — 시트는 이름만 보여준다
    const picked: PlaceSearchResult = {
      title: PICKED_PLACE_TITLE,
      address: '',
      roadAddress: '',
      xPos,
      yPos,
    };
    if (startFieldInUrl) {
      setCustomStart(picked);
      if (compareInUrl && destination !== null) refetchRoutes(picked, destination);
      else setRouteResult(null);
    } else {
      setDestination(picked);
      if (compareInUrl) void resolveStartPos().then((start) => refetchRoutes(start, picked));
      else setRouteResult(null);
    }
    navigate(-2);
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

  // 목적지를 지우면 처음부터 다시 찾는 것과 같으므로 골라둔 출발지도 함께 되돌린다
  function clearDestination() {
    setDestination(null);
    setRouteResult(null);
    setCustomStart(null);
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

  /**
   * "현재 위치 사용" — 골라둔 출발지를 지우고 자동(현재 위치)으로 되돌린다.
   * `customStart`를 참고하지 않고 곧장 현재 위치를 구한다 — 방금 지운 값이 아직
   * state에 반영되기 전이라 `resolveStartPos()`를 쓰면 지운 값을 다시 읽게 된다.
   */
  function useCurrentLocationAsStart() {
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

  // "경로 찾기"·"다시 조회" — 출발지를 직접 골랐으면 그 좌표, 아니면 현재 위치(실패 시 지도 중심 + 안내)
  async function searchRoutes() {
    if (destination === null) return;
    const start = await resolveStartPos();
    refetchRoutes(start, { xPos: destination.xPos, yPos: destination.yPos });
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
  // 선택 모드에서는 지도만 보여준다 — 시트·검색바·버튼이 모두 비켜야 지도를 움직일 수 있다
  const pickActive = pickInUrl && searchInUrl;
  const stationSheetOpen = selectedStation !== null && !pickActive;
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
  // 대여 시트도 목적지 시트와 같은 mini(200px) 높이라 같은 값만큼 띄운다
  const liftClass = stationSheetOpen
    ? LIFT_FOR_STATION_CLASS
    : destinationSheetOpen || rentSheetOpen
      ? LIFT_FOR_MINI_SHEET_CLASS
      : '';
  // 출발지 표시 문구 — 08 검색 화면과 10 비교 화면 상단 바가 같이 쓴다
  const startLabel = customStart?.title ?? (location.loading ? '현재 위치 확인 중…' : '현재 위치');

  return (
    <div className="relative h-full overflow-hidden">
      <MapView
        stations={stations}
        selectedStationId={selectedStationId}
        onSelectStation={selectStation}
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

      {pickActive ? (
        <MapPickLayer onCancel={cancelMapPick} onConfirm={confirmMapPick} />
      ) : guideActive && guideProgress !== null ? (
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
          startLabel={startLabel}
          destinationLabel={destination?.title ?? ''}
          onEditStart={openStartSearch}
          onEditDestination={openSearch}
          onSwap={swapStartAndDestination}
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
          <Button full onClick={openRentSheet}>
            대여하기
          </Button>
        </div>
      )}

      <StationSheet
        station={selectedStation}
        snap={stationSnap}
        onSnapChange={setStationSnap}
        onClose={() => selectStation(null)}
      />

      <CycleRentSheet
        open={rentSheetOpen}
        onClose={() => setRentSheetOpen(false)}
        onRented={() => showToast('대여가 완료됐습니다. 안전하게 이용해 주세요.')}
      />

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

      {pickActive ? (
        <MapPickLayer onCancel={cancelMapPick} onConfirm={confirmMapPick} />
      ) : guideActive && guideProgress !== null ? (
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
          // field가 바뀌면 입력 중이던 검색어·결과를 새로 시작해야 하므로 컴포넌트를 새로 만든다
          key={startFieldInUrl ? 'start' : 'destination'}
          field={startFieldInUrl ? 'start' : 'destination'}
          onClose={closeSearch}
          onSelect={startFieldInUrl ? selectStart : selectDestination}
          currentLocation={location.position}
          onRefreshLocation={refreshLocation}
          locationLoading={location.loading}
          onPickOnMap={openMapPick}
          startLabel={startLabel}
          onEditStart={openStartSearch}
          onSwap={swapStartAndDestination}
          onUseCurrentLocationAsStart={useCurrentLocationAsStart}
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
