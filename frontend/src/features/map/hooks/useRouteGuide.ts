import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { Pos, RouteCandidate } from '@/shared/api/types';
import { getReRoutePaths } from '@/features/map/api/routes';
import type { useCurrentLocation } from '@/features/map/hooks/useCurrentLocation';
import { useSpeech } from '@/features/map/hooks/useSpeech';
import { buildRouteCues, getNextCue } from '@/features/map/lib/routeCues';
import { getRouteProgress, hasArrived } from '@/features/map/lib/routeProgress';
import { shouldReRoute, toTravelStatus } from '@/features/map/lib/routeReroute';
import { toLegs } from '@/features/map/lib/routeSegments';
import { cueSpeech, spokenKey, voiceStage } from '@/features/map/lib/routeVoice';

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
  /** 목적지 좌표 — 재탐색할 때 도착지로 다시 보낸다 */
  destinationPos: Pos | null;
  location: ReturnType<typeof useCurrentLocation>;
  /** 안내에서 나갈 때 목적지·경로를 처음부터 다시 찾도록 초기화 (journey.clearDestination) */
  clearJourney: () => void;
  /** 재탐색으로 받은 경로로 갈아끼운다 (journey.replaceRoutes) */
  replaceRoutes: (routes: RouteCandidate[]) => void;
  showToast: (message: string) => void;
}

/**
 * 12 경로 안내 — 위치 추적, 진행률, 회전 안내와 음성, 재탐색, 자동 도착 감지(30m)와 요약 화면.
 *
 * 계산은 전부 `lib/`의 순수 함수가 한다(`routeCues`·`routeVoice`·`routeReroute`).
 * 여기서는 "언제 부를지"와 "이미 했는지"만 들고 있다.
 */
export function useRouteGuide({
  guideActive,
  detailRoute,
  destinationTitle,
  destinationPos,
  totalSec,
  location,
  clearJourney,
  replaceRoutes,
  showToast,
}: RouteGuideDeps) {
  const navigate = useNavigate();
  const [voiceOn, setVoiceOn] = useState(true);
  // 이미 읽어 준 안내("3번째 회전의 far 단계") — 같은 문장을 반복하지 않으려고 기록한다
  const spokenRef = useRef(new Set<string>());
  // 마지막으로 재탐색한 시각 — 위치가 튈 때마다 서버를 두드리지 않게 간격을 둔다
  const lastRerouteAtRef = useRef<number | null>(null);

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

  // 회전 안내 지점은 경로가 바뀔 때만 다시 만든다 — 위치가 들어올 때마다 다시 계산할 이유가 없다
  const guideCues = useMemo(
    () => (detailRoute === null ? [] : buildRouteCues(detailRoute)),
    [detailRoute],
  );
  const nextCue = useMemo(
    () => (guideProgress === null ? null : getNextCue(guideCues, guideProgress.traveledM)),
    [guideCues, guideProgress],
  );

  const speech = useSpeech(voiceOn && guideActive);

  // 안내를 벗어나면 "이미 읽어 준 것" 기록을 비운다 — 다시 시작하면 처음부터 안내해야 한다
  useEffect(() => {
    if (guideActive) return;
    spokenRef.current.clear();
    lastRerouteAtRef.current = null;
  }, [guideActive]);

  /**
   * 회전 안내 읽어 주기 — 한 회전에 대해 미리 한 번(far), 코앞에서 한 번(near).
   * 판단은 `routeVoice.ts`의 순수 함수가 하고 여기서는 "이미 말했는지"만 본다.
   */
  useEffect(() => {
    if (!guideActive || !voiceOn || nextCue === null) return;
    const stage = voiceStage(nextCue.cue.mode, nextCue.remainingM);
    if (stage === null) return;
    const key = spokenKey(nextCue, stage);
    if (spokenRef.current.has(key)) return;
    spokenRef.current.add(key);
    speech.speak(cueSpeech(nextCue, stage));
  }, [guideActive, voiceOn, nextCue, speech]);

  /**
   * 재탐색 — 경로에서 많이 벗어나면 지금 상황(어느 구간·어느 대여소·어떤 경로 종류)을 그대로
   * 유지한 채 다시 계산해 달라고 한다.
   */
  const reroute = useMutation({
    mutationFn: getReRoutePaths,
    onSuccess: (routes) => {
      if (routes.length === 0) return;
      replaceRoutes(routes);
      // 새 경로에는 예전 회전 안내가 남으면 안 된다
      spokenRef.current.clear();
      showToast('경로를 다시 찾았어요.');
    },
    onError: () => {
      // 재탐색 실패는 안내를 멈출 일이 아니다 — 기존 경로로 계속 안내한다
      showToast('경로를 다시 찾지 못했어요. 원래 경로로 안내합니다.');
    },
  });

  const requestReroute = reroute.mutate;
  const reroutePending = reroute.isPending;
  useEffect(() => {
    if (!guideActive || detailRoute === null || guideProgress === null) return;
    if (location.position === null || destinationPos === null) return;
    const now = Date.now();
    if (
      !shouldReRoute({
        offRouteM: guideProgress.offRouteM,
        lastAt: lastRerouteAtRef.current,
        now,
        pending: reroutePending,
      })
    ) {
      return;
    }
    lastRerouteAtRef.current = now;
    requestReroute({
      start: location.position,
      end: destinationPos,
      startStationId: detailRoute.startStation?.stationId ?? null,
      endStationId: detailRoute.endStation?.stationId ?? null,
      travelStatus: toTravelStatus(guideProgress.leg, guideProgress.legIndex),
      routeType: detailRoute.type,
    });
  }, [
    guideActive,
    detailRoute,
    guideProgress,
    location.position,
    destinationPos,
    reroutePending,
    requestReroute,
  ]);

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
    nextCue,
    rerouting: reroute.isPending,
    voiceOn,
    voiceSupported: speech.supported,
    toggleVoice: () => setVoiceOn((on) => !on),
    /** "안내 시작"을 누르는 그 클릭 안에서 불러야 첫 소리가 막히지 않는다 */
    primeVoice: speech.prime,
  };
}
