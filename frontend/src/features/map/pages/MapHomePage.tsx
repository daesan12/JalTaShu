import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Button } from '@/shared/ui/Button';
import { BIKE_STATIONS_QUERY_KEY, getBikeStations } from '@/features/map/api/stations';
import { NOTICE_POPUPS_QUERY_KEY, getNoticePopups } from '@/features/map/api/noticePopups';
import { CurrentLocationButton } from '@/features/map/components/CurrentLocationButton';
import { MapPlaceholder } from '@/features/map/components/MapPlaceholder';
import { NoticeBanner } from '@/features/map/components/NoticeBanner';
import { NoticePopup } from '@/features/map/components/NoticePopup';
import { SearchBar } from '@/features/map/components/SearchBar';
import { Toast } from '@/features/map/components/Toast';
import { UpdatedBadge } from '@/features/map/components/UpdatedBadge';
import { useToast } from '@/features/map/hooks/useToast';
import { NOTICES_PATH } from '@/features/map/lib/noticeLink';
import {
  hideNoticePopupForWeek,
  isNoticePopupHidden,
  markNoticePopupClosed,
} from '@/features/map/lib/noticePopupHide';

/** 검색·현재위치·대여하기는 각각 별도 이슈라 지금은 안내만 띄운다 */
const COMING_SOON = '준비 중입니다.';

/** 07 메인 지도 — 지도 위 오버레이 UI. 지도 표시와 대여소 마커는 별도 이슈. */
export function MapHomePage() {
  const { message, showToast } = useToast();
  const navigate = useNavigate();

  // 한 번 닫으면 앱을 다시 켜기 전까지 뜨지 않는다. "7일간 보지 않기"는 저장소로 더 오래 막는다.
  // 닫힘 기억은 모듈(noticePopupHide)에 있고, 이 state는 화면을 다시 그리는 용도다
  const [popupClosed, setPopupClosed] = useState(isNoticePopupHidden);

  function closePopup() {
    markNoticePopupClosed();
    setPopupClosed(true);
  }

  // 갱신 배지에 쓸 시각. 대여소 목록 자체는 마커 이슈에서 사용한다.
  const { data: stations } = useQuery({
    queryKey: BIKE_STATIONS_QUERY_KEY,
    queryFn: getBikeStations,
  });
  const updatedAt = stations?.[0]?.updatedAt;

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

  // 공지 상세 화면이 아직 없어 연결된 공지 번호와 상관없이 목록으로 보낸다
  function openNotice() {
    closePopup();
    navigate(NOTICES_PATH);
  }

  return (
    <div className="relative h-full overflow-hidden">
      <MapPlaceholder />

      {/* 상단 — 검색바, 공지 배너, 갱신 배지 */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-2 p-4">
        <div className="pointer-events-auto w-full">
          <SearchBar onClick={() => showToast(COMING_SOON)} />
        </div>
        <div className="pointer-events-auto w-full">
          <NoticeBanner onClick={() => navigate(NOTICES_PATH)} />
        </div>
        {updatedAt && <UpdatedBadge updatedAt={updatedAt} />}
      </div>

      {/* 하단 — 현재위치 버튼과 대여하기 버튼 (홈 인디케이터 여백은 탭바가 처리) */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-end gap-3 p-4">
        <CurrentLocationButton onClick={() => showToast(COMING_SOON)} />
        <Button full onClick={() => showToast(COMING_SOON)}>
          대여하기
        </Button>
      </div>

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
