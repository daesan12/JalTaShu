import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import type { PlaceSearchResult } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';
import { BIKE_STATIONS_QUERY_KEY, getBikeStations } from '@/features/map/api/stations';
import { NOTICE_POPUPS_QUERY_KEY, getNoticePopups } from '@/features/map/api/noticePopups';
import { CurrentLocationButton } from '@/features/map/components/CurrentLocationButton';
import { MapView } from '@/features/map/components/MapView';
import { NoticeBanner } from '@/features/map/components/NoticeBanner';
import { NoticePopup } from '@/features/map/components/NoticePopup';
import { PlaceSearchOverlay } from '@/features/map/components/PlaceSearchOverlay';
import { SearchBar } from '@/features/map/components/SearchBar';
import { StationPeekSheet } from '@/features/map/components/StationPeekSheet';
import { Toast } from '@/features/map/components/Toast';
import { UpdatedBadge } from '@/features/map/components/UpdatedBadge';
import { useToast } from '@/features/map/hooks/useToast';
import { NOTICES_PATH } from '@/features/map/lib/noticeLink';
import {
  hideNoticePopupForWeek,
  isNoticePopupHidden,
  markNoticePopupClosed,
} from '@/features/map/lib/noticePopupHide';

/** 현재위치·대여하기는 각각 별도 이슈라 지금은 안내만 띄운다 */
const COMING_SOON = '준비 중입니다.';

/**
 * 08 검색 오버레이 열림 상태를 URL 쿼리에 둔다(`/?search=1`).
 * 라우트는 `/` 그대로라 지도가 살아 있고, 안드로이드·브라우저 뒤로가기가 그대로 "검색 닫기"가 된다.
 */
const SEARCH_PARAM = 'search';

/**
 * 대여소 시트(peek 110px)가 열리면 하단 버튼을 그만큼 올린다.
 * 시트는 화면 맨 아래(탭바 64px 포함)에 붙으므로 실제 겹침은 110 − 64 = 46px, 여기에 여백 12px.
 */
const CONTROLS_LIFT_CLASS = '-translate-y-[58px]';

/** 07 메인 지도 — 네이버 지도 + 대여소 마커 + 오버레이 UI */
export function MapHomePage() {
  const { message, showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchOpen = searchParams.get(SEARCH_PARAM) === '1';
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [destination, setDestination] = useState<PlaceSearchResult | null>(null);

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

  function closeForWeek() {
    hideNoticePopupForWeek();
    closePopup();
  }

  function openSearch() {
    // 검색 화면이 시트를 덮지 못하므로(시트 z-index가 더 높음) 먼저 닫는다
    setSelectedStationId(null);
    setSearchParams({ [SEARCH_PARAM]: '1' });
  }

  // 열 때 히스토리를 하나 쌓았으니 닫기는 뒤로가기와 같다
  function closeSearch() {
    navigate(-1);
  }

  function selectDestination(place: PlaceSearchResult) {
    setDestination(place);
    closeSearch();
  }

  // 공지 상세 화면이 아직 없어 연결된 공지 번호와 상관없이 목록으로 보낸다
  function openNotice() {
    closePopup();
    navigate(NOTICES_PATH);
  }

  return (
    <div className="relative h-full overflow-hidden">
      <MapView
        stations={stations}
        selectedStationId={selectedStationId}
        onSelectStation={setSelectedStationId}
        destination={destination}
      />

      {/* 상단 — 검색바, 공지 배너, 갱신 배지 */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-2 p-4">
        <div className="pointer-events-auto w-full">
          <SearchBar onClick={openSearch} value={destination?.title} />
        </div>
        <div className="pointer-events-auto w-full">
          <NoticeBanner onClick={() => navigate(NOTICES_PATH)} />
        </div>
        {updatedAt && <UpdatedBadge updatedAt={updatedAt} />}
      </div>

      {/* 하단 — 현재위치 버튼과 대여하기 버튼 (홈 인디케이터 여백은 탭바가 처리) */}
      <div
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col items-end gap-3 p-4 transition-transform duration-300 ease-out ${
          selectedStation === null ? '' : CONTROLS_LIFT_CLASS
        }`}
      >
        <CurrentLocationButton onClick={() => showToast(COMING_SOON)} />
        <Button full onClick={() => showToast(COMING_SOON)}>
          대여하기
        </Button>
      </div>

      <StationPeekSheet station={selectedStation} onClose={() => setSelectedStationId(null)} />

      {/* 검색 오버레이는 탭바(z-20)를 덮고, 뒤에 오는 토스트(z-30)보다는 아래에 둔다 */}
      {searchOpen ? (
        <PlaceSearchOverlay
          onClose={closeSearch}
          onSelect={selectDestination}
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
