import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/shared/api/client';
import type { Station } from '@/shared/api/types';
import { InfoCard } from '@/shared/ui/InfoCard';
import { ListRow } from '@/shared/ui/ListRow';
import { StationMarker } from '@/shared/ui/StationMarker';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { toStationStatus } from '@/shared/ui/stationStatus';

/**
 * [PLACEHOLDER] 07 메인 지도 — map 담당이 교체할 것.
 * 지금은 공통 기반(msw 목업 → api client → react-query → shared/ui) 동작 확인용 화면.
 */
export function MapHomePage() {
  const { data: stations, isPending, error } = useQuery({
    queryKey: ['stations'],
    queryFn: () => apiGet<Station[]>('/stations'),
  });

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-bold text-gray-900">07 메인 지도 (placeholder)</h1>
      <p className="text-sm text-gray-500">
        아래 목록은 msw 가짜 API(<code>GET /api/stations</code>) 응답입니다. 네이버 지도 연동 시 이
        화면을 교체하세요.
      </p>

      {isPending && <p className="text-sm text-gray-400">불러오는 중…</p>}
      {error && <p className="text-sm text-status-low">에러: {error.message}</p>}

      {stations && (
        <InfoCard title="주변 대여소 (목업 데이터)">
          {stations.map((s) => {
            const status = toStationStatus(s.currentBikes);
            return (
              <ListRow
                key={s.stationId}
                title={s.name}
                subtitle={`잔여 ${s.currentBikes}대`}
                left={<StationMarker status={status} count={s.currentBikes} />}
                right={<StatusBadge status={status} />}
              />
            );
          })}
        </InfoCard>
      )}
    </div>
  );
}
