import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { RouteCandidate } from '@/shared/api/types';
import type { useCurrentLocation } from '@/features/map/hooks/useCurrentLocation';
import { getRouteProgress, hasArrived } from '@/features/map/lib/routeProgress';
import { toLegs } from '@/features/map/lib/routeSegments';

interface ArrivalSummary {
  destinationTitle: string;
  elapsedSec: number;
  totalDistanceM: number;
  bikeDistanceM: number;
  route: RouteCandidate;
}

interface RouteGuideDeps {
  guideActive: boolean;
  /** 안내 중인 경로 (11에서 고른 후보). 안내가 아닐 때는 null */
  detailRoute: RouteCandidate | null;
  destinationTitle: string;
  /** 선택한 경로의 총 소요 시간(초) — 선택이 없으면 null */
  totalSec: number | null;
  location: ReturnType<typeof useCurrentLocation>;
  /** 안내에서 나갈 때 목적지·경로를 처음부터 다시 찾도록 초기화 (journey.clearDestination) */
  clearJourney: () => void;
}

/** 12 경로 안내 — 위치 추적, 진행률, 자동 도착 감지(30m)와 도착 요약 화면 */
export function useRouteGuide({
  guideActive,
  detailRoute,
  destinationTitle,
  totalSec,
  location,
  clearJourney,
}: RouteGuideDeps) {
  const navigate = useNavigate();

  // 12 안내 중 실제 도착(30m 이내)하면 채워지는 전체 화면 요약 — null이면 안 보인다
  const [arrivalSummary, setArrivalSummary] = useState<ArrivalSummary | null>(null);
  // 12 안내 시작 시각(도착 요약의 소요 시간 계산용)과 도착 처리 중복 방지 플래그 — 렌더에 쓰지 않아 ref로 둔다
  const guideStartAtRef = useRef<number | null>(null);
  const arrivalHandledRef = useRef(false);

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

  // 목적지 근처(30m 이내)에 오면 안내를 자동으로 끝내고 전체 화면 요약을 띄운다.
  // "안내 종료" 버튼으로 직접 끝낼 때는 요약을 보여주지 않는다 — 도착이 아니라 중단이라서다
  useEffect(() => {
    if (!guideActive) {
      guideStartAtRef.current = null;
      arrivalHandledRef.current = false;
      return;
    }
    guideStartAtRef.current ??= Date.now();
    if (
      arrivalHandledRef.current ||
      detailRoute === null ||
      !hasArrived(detailRoute, location.position)
    )
      return;
    arrivalHandledRef.current = true;
    // 실제 GPS 궤적이 아니라 안내 중이던 경로의 거리다(원시 좌표를 쌓지 않는다)
    const guideLegs = toLegs(detailRoute);
    const totalDistanceM = guideLegs.reduce((sum, leg) => sum + leg.distance, 0);
    const bikeDistanceM = guideLegs.reduce(
      (sum, leg) => sum + (leg.mode === 'BICYCLE' ? leg.distance : 0),
      0,
    );
    setArrivalSummary({
      destinationTitle,
      elapsedSec: (Date.now() - guideStartAtRef.current) / 1000,
      totalDistanceM,
      bikeDistanceM,
      route: detailRoute,
    });
  }, [guideActive, detailRoute, location.position, destinationTitle]);

  // 남은 시간은 남은 거리 비율로 총 소요 시간을 줄여 잡는다(구간별 속도 차이는 무시)
  const guideRemainingSec =
    guideProgress === null || totalSec === null
      ? 0
      : Math.round(totalSec * (1 - guideProgress.ratio));

  /**
   * "안내 종료"를 직접 눌러 끝낼 때 — 실제로 도착한 게 아니라 중간에 그만둔 것이므로 요약 없이
   * 지도로 나간다. 목적지·경로도 처음부터 다시 찾도록 같이 초기화한다(`clearJourney`).
   * 자동 도착 감지(위 useEffect)는 이 함수를 쓰지 않고 전체 화면 요약(`arrivalSummary`)을 띄운다
   * — 그건 실제 도착이라 다르게 취급한다. 요약 화면의 "닫기"가 이 함수와 똑같이 지도로 나간다
   * (`closeArrivalSummary`).
   * 브라우저·하드웨어 뒤로가기는 그대로 한 단계만 닫는다(11로) — 여기서 건드리지 않는다.
   */
  function endGuide() {
    clearJourney();
    navigate('/');
  }

  // 도착 요약 화면의 "닫기" — 수동 종료와 같은 동작(지도로 나가고 목적지·경로 초기화)
  function closeArrivalSummary() {
    setArrivalSummary(null);
    clearJourney();
    navigate('/');
  }

  return {
    guideProgress,
    guideLegCount,
    guideRemainingSec,
    arrivalSummary,
    endGuide,
    closeArrivalSummary,
  };
}
