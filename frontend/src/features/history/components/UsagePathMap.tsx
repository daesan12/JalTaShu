import { useMemo, type ReactNode } from 'react';
import { EndpointPins } from '@/features/map/components/EndpointPins';
import { StaticRouteMap } from '@/features/map/components/StaticRouteMap';
import type { UsagePathPoint } from '@/features/history/api/rides';
import { toMapSegments } from '@/features/history/lib/usageDisplay';

interface UsagePathMapProps {
  road: UsagePathPoint[];
  /** 지도를 못 띄웠을 때 대신 보여줄 것 */
  fallback: ReactNode;
  /** 지도 위에 떠 있는 헤더 높이(px) — 그 아래로 경로를 맞춘다 */
  headerHeight: number;
}

/**
 * 저장된 GPS 경로를 실제 지도 위에 그린다(23 기록 상세) — 12 도착 요약과 같은 지도·같은 선.
 * 좌표를 정규화한 추상 그림은 실제 길과 안 닮아 보여 지도로 바꿨다.
 */
export function UsagePathMap({ road, fallback, headerHeight }: UsagePathMapProps) {
  const segments = useMemo(() => toMapSegments(road), [road]);
  const ends = useMemo(() => {
    const points = segments.flatMap((s) => s.points);
    return {
      start: points[0] ?? null,
      end: points.length > 1 ? points[points.length - 1] : null,
    };
  }, [segments]);

  return (
    <StaticRouteMap
      segments={segments}
      fallback={fallback}
      // 핀 높이(52)만큼 더 비워야 헤더 바로 아래 핀이 잘리지 않는다
      fitPaddingTop={headerHeight + 52}
      // 헤더가 위 90px쯤을 가리므로 12 도착 요약보다 높게 잡아야 경로 놓을 자리가 남는다
      sizeClassName="h-[340px]"
      renderOverlay={(map) => <EndpointPins map={map} start={ends.start} end={ends.end} />}
    />
  );
}
