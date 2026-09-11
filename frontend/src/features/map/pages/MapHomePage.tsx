import { useQuery } from '@tanstack/react-query';
import { Button } from '@/shared/ui/Button';
import { BIKE_STATIONS_QUERY_KEY, getBikeStations } from '@/features/map/api/stations';
import { CurrentLocationButton } from '@/features/map/components/CurrentLocationButton';
import { MapPlaceholder } from '@/features/map/components/MapPlaceholder';
import { SearchBar } from '@/features/map/components/SearchBar';
import { Toast } from '@/features/map/components/Toast';
import { UpdatedBadge } from '@/features/map/components/UpdatedBadge';
import { useToast } from '@/features/map/hooks/useToast';

/** 검색·현재위치·대여하기는 각각 별도 이슈라 지금은 안내만 띄운다 */
const COMING_SOON = '준비 중입니다.';

/** 07 메인 지도 — 지도 위 오버레이 UI. 지도 표시와 대여소 마커는 별도 이슈. */
export function MapHomePage() {
  const { message, showToast } = useToast();

  // 갱신 배지에 쓸 시각. 대여소 목록 자체는 마커 이슈에서 사용한다.
  const { data: stations } = useQuery({
    queryKey: BIKE_STATIONS_QUERY_KEY,
    queryFn: getBikeStations,
  });
  const updatedAt = stations?.[0]?.updatedAt;

  return (
    <div className="relative h-full overflow-hidden">
      <MapPlaceholder />

      {/* 상단 — 검색바와 갱신 배지 */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-2 p-4">
        <div className="pointer-events-auto w-full">
          <SearchBar onClick={() => showToast(COMING_SOON)} />
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
    </div>
  );
}
