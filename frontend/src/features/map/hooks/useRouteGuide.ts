import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { Pos, RouteCandidate, RouteLeg } from '@/shared/api/types';
import { getReRoutePaths, type ReRoutePathRequest } from '@/features/map/api/routes';
import type { useCurrentLocation } from '@/features/map/hooks/useCurrentLocation';
import { saveUsagePath, type SaveUsagePathInput } from '@/features/history/api/rides';
import { toSeoulLocalDateTime } from '@/shared/lib/format';
import { useKeepAwake } from '@/features/map/hooks/useKeepAwake';
import { useSpeech } from '@/features/map/hooks/useSpeech';
import { readVoiceOn, writeVoiceOn } from '@/features/map/lib/guideVoicePref';
import { buildRouteCues, getNextCue } from '@/features/map/lib/routeCues';
import { getRouteProgress } from '@/features/map/lib/routeProgress';
import { shouldReRoute, toTravelStatus } from '@/features/map/lib/routeReroute';
import { legPoints, toLegs } from '@/features/map/lib/routeSegments';
import { toUsagePath } from '@/features/map/lib/usagePath';
import { takePendingUsagePath, writePendingUsagePath } from '@/features/map/lib/pendingUsagePath';
import { ANNOUNCE, cueSpeech, spokenKey, voiceStage } from '@/features/map/lib/routeVoice';

/**
 * 도착 문장을 이미 말했다는 표시. 회전 안내의 `spokenKey`("3:near")와 겹치지 않는 이름이면 된다.
 * "도착 완료" 버튼과 마지막 `arrive` 회전 안내(도보 near 15m·자전거 near 40m)가 같은 문장을
 * 말하는데, 어느 쪽이 먼저 올지는 사용자가 언제 누르느냐에 달렸다.
 */
const ARRIVED_KEY = 'arrived';

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
  /** 미리 계산된 추천 코스는 경유지를 보존해야 하므로 자동 재탐색을 끈다. */
  rerouteEnabled: boolean;
  /** 실제 위치에서 사용자가 고른 출발지로 먼저 이동 중인지 */
  intermediateArrival: boolean;
  /** 중간 목적지인 선택 출발지에 도착했을 때 원래 경로로 전환한다. */
  onIntermediateArrival: () => boolean;
  returnedUsage: ReturnedUsage | null;
  onReturnedUsageHandled: () => void;
  /** 방금 대여에 성공한 대여소(#145). 안내 단계를 넘기거나 경로를 다시 찾는 데 쓰고 소비한다 */
  rentedStation: RentedStation | null;
  onRentedStationHandled: () => void;
  /** 지금 빌려 둔 자전거 번호 — 반납 전에 "도착 완료"를 누르면 경로를 이 자전거 반납에 붙인다 */
  rentedCycleId: string | null;
  showToast: (message: string) => void;
}

export interface ReturnedUsage {
  cycleUsageId: number;
  cycleId: string;
  returnedAt: string;
  stationId: string;
  /** 반납한 대여소 좌표 — 안내와 다른 대여소면 여기서부터 목적지까지 다시 찾는다. 모르면 null */
  stationPos: Pos | null;
}

export interface RentedStation {
  stationId: string;
  pos: Pos;
  /** 같은 대여소에서 두 번 빌려도 다른 사건으로 보이게 */
  at: number;
}

/** 경로의 자전거 구간이 시작하는 자리 — 빌린 대여소를 모를 때(안내 전에 빌림) 대신 쓴다 */
function bikeLegStart(route: RouteCandidate, bike: number | null): Pos | null {
  if (bike === null) return null;
  const first = legPoints(toLegs(route)[bike])[0];
  return first === undefined ? null : { xPos: first.location[0], yPos: first.location[1] };
}

/**
 * 빌린 대여소 → 실제 반납 대여소의 자전거 구간. 재탐색 API에 "자전거 타는 중"으로 반납 대여소까지를
 * 물어 자전거 구간만 꺼낸다(뒤따르는 도보는 길이 0이라 버린다). 실패하면 null
 */
async function getActualBikeLegs(
  route: RouteCandidate,
  from: Pos,
  returnedPos: Pos,
  returnedStationId: string,
): Promise<RouteLeg[] | null> {
  try {
    const [found] = await getReRoutePaths({
      start: from,
      end: returnedPos,
      startStationId: null,
      endStationId: returnedStationId,
      travelStatus: 'BIKE',
      routeType: route.type === 'WALK' ? 'BIKE' : route.type,
      stationStrategy: route.stationStrategy,
    });
    const legs = found === undefined ? [] : toLegs(found).filter((leg) => leg.mode === 'BICYCLE');
    return legs.length === 0 ? null : legs;
  } catch {
    return null;
  }
}

/** 이 구간 번호 이후에서 처음 나오는 해당 수단 구간. 없으면 null */
function legIndexOf(route: RouteCandidate, mode: 'WALK' | 'BICYCLE', from = 0): number | null {
  const index = toLegs(route).findIndex((leg, i) => i >= from && leg.mode === mode);
  return index === -1 ? null : index;
}

/**
 * 12 경로 안내 — 위치 추적, 진행률, 회전 안내와 음성, 재탐색, "도착 완료" 버튼과 요약 화면.
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
  rerouteEnabled,
  intermediateArrival,
  onIntermediateArrival,
  returnedUsage,
  onReturnedUsageHandled,
  rentedStation,
  onRentedStationHandled,
  rentedCycleId,
  showToast,
}: RouteGuideDeps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // 기본은 켜짐. 명시적으로 껐던 사람만 그 선택이 따라온다 (`guideVoicePref.ts`)
  const [voiceOn, setVoiceOn] = useState(readVoiceOn);
  // 이미 읽어 준 안내("3번째 회전의 far 단계") — 같은 문장을 반복하지 않으려고 기록한다
  const spokenRef = useRef(new Set<string>());
  // 마지막으로 재탐색한 시각 — 위치가 튈 때마다 서버를 두드리지 않게 간격을 둔다
  const lastRerouteAtRef = useRef<number | null>(null);

  // 12 안내 중 "도착 완료"를 누르면 채워지는 전체 화면 요약 — null이면 안 보인다
  const [arrivalSummary, setArrivalSummary] = useState<ArrivalSummary | null>(null);
  // 12 안내 시작 시각(도착 요약의 소요 시간 계산용)과 도착 처리 중복 방지 플래그 — 렌더에 쓰지 않아 ref로 둔다
  const guideStartAtRef = useRef<number | null>(null);
  const arrivalHandledRef = useRef(false);
  const returnedUsageIdRef = useRef<number | null>(null);
  const handledReturnedUsageIdRef = useRef<number | null>(null);

  /**
   * 도착하면 안내하던 경로를 이용 기록에 붙인다.
   * 서버가 가장 최근 반납 건에 붙이므로, 이 앱으로 대여·반납하지 않았으면 실패한다 —
   * 사용자가 할 수 있는 일은 없지만 기록이 안 남았다는 건 알려야 해서 토스트로 띄운다.
   */
  const savePath = useMutation({
    mutationFn: saveUsagePath,
    onSuccess: () => {
      // "나의 경로" 탭과 프로필 통계가 방금 이동을 바로 반영하도록
      void queryClient.invalidateQueries({ queryKey: ['usageList'] });
      void queryClient.invalidateQueries({ queryKey: ['usageStats'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      // 경로 없이 먼저 열어 본 상세가 캐시에 남아 있으면 방금 붙인 경로가 안 보인다
      void queryClient.invalidateQueries({ queryKey: ['usageDetail'] });
    },
    onError: () => showToast('이동 기록을 저장하지 못했어요.'),
  });

  /**
   * 안내하던 경로를 저장 요청 형태로 만든다. 실제 GPS 궤적이 아니라 안내 중이던 경로의 거리다.
   * 서버는 미터 정수를 받는다(자전거 거리 ≤ 전체 거리 검증이 있어 반올림 순서를 맞춘다).
   * 시각은 LocalDateTime(서울)으로 보낸다 — toISOString()의 UTC 'Z'는 9시간 어긋나 저장된다.
   */
  function buildPath(
    route: RouteCandidate,
    startedAt: number,
    finishedAt: number,
  ): Omit<SaveUsagePathInput, 'cycleUsageId'> {
    const guideLegs = toLegs(route);
    const totalDistanceM = guideLegs.reduce((sum, leg) => sum + leg.distance, 0);
    const bikeDistanceM = guideLegs.reduce(
      (sum, leg) => sum + (leg.mode === 'BICYCLE' ? leg.distance : 0),
      0,
    );
    return {
      pathInfo: { road: toUsagePath(route) },
      createdAt: toSeoulLocalDateTime(startedAt),
      finishedAt: toSeoulLocalDateTime(Math.max(startedAt, finishedAt)),
      totalDistance: Math.round(totalDistanceM),
      bikeDistance: Math.min(Math.round(bikeDistanceM), Math.round(totalDistanceM)),
    };
  }

  // 안내 중에는 화면이 꺼지지 않게 한다 — 꺼지면 WebView가 멈춰 안내도 음성도 같이 멎는다
  useKeepAwake(guideActive);

  // 안내 중에는 위치를 계속 받는다. 평소에는 배터리 때문에 켜지 않는다
  const watchLocation = location.watch;
  useEffect(() => {
    if (!guideActive) return;
    return watchLocation();
  }, [guideActive, watchLocation]);

  /*
   * 적어도 이 구간까지는 왔다고 보는 하한(#145). 대여하면 자전거 구간, 반납하면 마지막 도보 구간으로
   * 올린다 — GPS가 대여소 근처로 잡히지 않아도 안내가 "대여소까지 걸어가세요"에 머물지 않게 한다.
   * 경로가 바뀌면(재탐색) 새 경로 기준으로 다시 시작한다.
   */
  const [legFloor, setLegFloor] = useState({ route: detailRoute, index: 0 });
  // 대여·반납할 때마다 올린다 — 그 전에 보낸 재탐색 응답을 가려내는 데 쓴다
  const statusRef = useRef(0);

  /*
   * 실제로 지나온 구간(#145). 재탐색하면 안내 경로가 "그 자리부터"로 바뀌어 앞 구간이 사라진다 —
   * 대여·반납 순간에 그때까지 지나온 구간을 여기 옮겨 두고, 저장·도착 요약은 이것과 지금 경로의
   * 남은 구간을 이어 쓴다. `committedRef`는 지금 경로에서 이미 옮긴 구간 수다(경로가 바뀌면 0부터).
   * GPS 자동 재탐색 전에 걸어온 구간은 옮기지 않는다 — 대여·반납처럼 끊을 기준점이 없다.
   */
  const traveledLegsRef = useRef<RouteLeg[]>([]);
  const committedRef = useRef<{ route: RouteCandidate | null; count: number }>({
    route: null,
    count: 0,
  });
  // 자전거를 빌린 대여소 — 다른 대여소에 반납했을 때 실제 자전거 구간을 다시 받는 출발점
  const bikeStartRef = useRef<Pos | null>(null);

  const committedCount = (route: RouteCandidate) =>
    committedRef.current.route === route ? committedRef.current.count : 0;

  /** 지금 경로의 구간을 `upTo` 앞까지 지나온 것으로 옮긴다 */
  function commitLegs(route: RouteCandidate, upTo: number) {
    const from = committedCount(route);
    traveledLegsRef.current.push(...toLegs(route).slice(from, upTo));
    committedRef.current = { route, count: Math.max(from, upTo) };
  }

  /** 저장·요약용 경로 — 지나온 구간 + 지금 경로의 아직 안 옮긴 구간 */
  function journeyRoute(route: RouteCandidate): RouteCandidate {
    return {
      ...route,
      legs: [...traveledLegsRef.current, ...toLegs(route).slice(committedCount(route))],
    };
  }

  function resetJourney() {
    traveledLegsRef.current = [];
    committedRef.current = { route: null, count: 0 };
    bikeStartRef.current = null;
  }
  const minLegIndex = legFloor.route === detailRoute ? legFloor.index : 0;
  const raiseLegFloor = (route: RouteCandidate, index: number | null) => {
    if (index !== null) setLegFloor({ route, index });
  };

  const guideProgress = useMemo(
    () =>
      detailRoute === null ? null : getRouteProgress(detailRoute, location.position, minLegIndex),
    [detailRoute, location.position, minLegIndex],
  );
  const guideLegCount = useMemo(
    () => (detailRoute === null ? 0 : toLegs(detailRoute).length),
    [detailRoute],
  );

  // 재탐색 또는 중간 출발지 도착으로 안내 경로가 바뀌면 새 경로의 도착 판정을 다시 시작한다.
  useEffect(() => {
    arrivalHandledRef.current = false;
  }, [detailRoute]);

  // 반납은 실제 자전거 이용의 종료 시점이다. 안내된 정류소와 다르면 현재 안내를 확정해
  // 즉시 저장하고, 같으면 "도착 완료"를 누를 때 같은 usageId로 저장한다.
  useEffect(() => {
    if (returnedUsage === null) return;
    if (handledReturnedUsageIdRef.current === returnedUsage.cycleUsageId) return;
    handledReturnedUsageIdRef.current = returnedUsage.cycleUsageId;
    onReturnedUsageHandled();
    if (!guideActive || detailRoute === null) {
      // 안내는 이미 "도착 완료"로 끝났고 반납이 뒤따라온 경우 — 맡겨 둔 경로를 이 기록에 붙인다
      const pending = takePendingUsagePath(returnedUsage.cycleId);
      if (pending !== null) {
        savePath.mutate({ ...pending.path, cycleUsageId: returnedUsage.cycleUsageId });
      }
      return;
    }

    returnedUsageIdRef.current = returnedUsage.cycleUsageId;
    statusRef.current++;
    // GPS를 기다리지 않고 목적지까지 걷는 구간으로 넘긴다. 아래 재탐색이 실패해도 이 단계는 남는다
    const route = detailRoute;
    const bike = legIndexOf(route, 'BICYCLE');
    const walkAfter = bike === null ? null : legIndexOf(route, 'WALK', bike + 1);
    const bikeEnd = walkAfter ?? toLegs(route).length;
    raiseLegFloor(route, walkAfter);
    if (route.endStation?.stationId === returnedUsage.stationId) {
      // 안내대로 반납했다 — 자전거 구간까지 지나온 것으로 옮긴다. 저장은 "도착 완료"에서 한다
      commitLegs(route, bikeEnd);
      return;
    }

    // 안내와 다른 대여소에 반납했다 — 자전거 이용은 끝났으니 경로를 지금 기록에 붙이고,
    // 그 대여소에서 목적지까지 걷는 경로를 다시 찾아 안내를 이어 간다(#145).
    // 붙이는 경로는 실제 이동이다: 지나온 도보 + **빌린 대여소 → 실제 반납 대여소** 자전거 구간
    const cycleUsageId = returnedUsage.cycleUsageId;
    const startedAt = guideStartAtRef.current ?? Date.now();
    const parsedReturnedAt = Date.parse(returnedUsage.returnedAt);
    const finishedAt = Number.isNaN(parsedReturnedAt) ? Date.now() : parsedReturnedAt;
    const returnedPos = returnedUsage.stationPos;
    const bikeFrom = bikeStartRef.current ?? bikeLegStart(route, bike);
    returnedUsageIdRef.current = null;
    void (async () => {
      const actualBike =
        returnedPos === null || bikeFrom === null
          ? null
          : await getActualBikeLegs(route, bikeFrom, returnedPos, returnedUsage.stationId);
      if (actualBike === null) {
        // 실제 자전거 구간을 못 받았으면 안내하던 자전거 구간으로 대신한다
        commitLegs(route, bikeEnd);
      } else {
        commitLegs(route, bike ?? committedCount(route));
        traveledLegsRef.current.push(...actualBike);
        committedRef.current = { route, count: bikeEnd };
      }
      savePath.mutate({
        ...buildPath({ ...route, legs: traveledLegsRef.current }, startedAt, finishedAt),
        cycleUsageId,
      });
    })();
    const start = returnedPos ?? location.position;
    if (start === null || destinationPos === null) return;
    requestReroute({
      start,
      end: destinationPos,
      startStationId: null,
      endStationId: null,
      travelStatus: 'WALK2',
      routeType: detailRoute.type,
      stationStrategy: detailRoute.stationStrategy,
    });
    // mutation 객체와 콜백은 렌더마다 새 참조가 될 수 있으므로 반납 이벤트만 한 번 소비한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedUsage]);

  // 대여 성공(#145) — 안내대로 빌렸으면 자전거 구간으로 넘기고, 다른 대여소에서 빌렸으면
  // 그 대여소에서 출발하는 경로를 다시 찾는다(반납 대여소는 그대로)
  useEffect(() => {
    if (rentedStation === null) return;
    onRentedStationHandled();
    if (!guideActive || detailRoute === null) return;
    statusRef.current++;
    // 대여소까지 걸어온 구간을 지나온 것으로 옮긴다 — 다른 대여소에서 빌려 재탐색해도 남는다
    const bike = legIndexOf(detailRoute, 'BICYCLE');
    if (bike !== null) commitLegs(detailRoute, bike);
    bikeStartRef.current = rentedStation.pos;
    // 아래 재탐색이 실패해도 자전거 구간으로는 넘어가 있게 먼저 올린다
    raiseLegFloor(detailRoute, bike);
    if (detailRoute.startStation?.stationId === rentedStation.stationId) return;
    if (destinationPos === null || detailRoute.endStation === null) return;
    requestReroute({
      start: rentedStation.pos,
      end: destinationPos,
      startStationId: null,
      endStationId: detailRoute.endStation.stationId,
      travelStatus: 'BIKE',
      routeType: detailRoute.type,
      stationStrategy: detailRoute.stationStrategy,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentedStation]);

  // 안내가 켜진 시각을 기록한다(도착 요약의 소요 시간). 꺼지면 도착 처리 상태를 비운다
  useEffect(() => {
    if (!guideActive) {
      guideStartAtRef.current = null;
      arrivalHandledRef.current = false;
      returnedUsageIdRef.current = null;
      resetJourney();
      return;
    }
    guideStartAtRef.current ??= Date.now();
  }, [guideActive]);

  /**
   * "도착 완료" 버튼 — 위치로 도착을 자동 판정하지 않고 사용자가 직접 확정한다.
   * 누르면 안내를 끝내고 전체 화면 요약을 띄운다. "안내 종료"(중단)와 달리 요약·기록이 남는다.
   * 선택한 출발지로 먼저 가는 중이었다면 기록 없이 원래 경로 안내로 넘어간다.
   */
  function completeArrival() {
    if (!guideActive || arrivalHandledRef.current || detailRoute === null) return;
    arrivalHandledRef.current = true;
    if (intermediateArrival && onIntermediateArrival()) {
      // 접근 경로는 실제 이용 완료가 아니므로 기록·도착 요약을 만들지 않는다.
      spokenRef.current.clear();
      lastRerouteAtRef.current = null;
      guideStartAtRef.current = Date.now();
      resetJourney();
      return;
    }
    const startedAt = guideStartAtRef.current ?? Date.now();
    const finishedAt = Date.now();
    // 재탐색 전에 지나온 구간까지 이어 붙인 실제 이동으로 저장·요약한다(#145)
    const journey = journeyRoute(detailRoute);
    const path = buildPath(journey, startedAt, finishedAt);
    setArrivalSummary({
      destinationTitle,
      elapsedSec: (finishedAt - startedAt) / 1000,
      totalDistanceM: path.totalDistance,
      bikeDistanceM: path.bikeDistance,
      route: journey,
    });
    const cycleUsageId = returnedUsageIdRef.current;
    if (cycleUsageId !== null) {
      savePath.mutate({ ...path, cycleUsageId });
      returnedUsageIdRef.current = null;
    } else if (rentedCycleId !== null) {
      // 아직 반납 전이다 — 이 자전거를 반납하면 그 이용 기록에 붙인다
      writePendingUsagePath({ cycleId: rentedCycleId, savedAt: finishedAt, path });
    }
  }

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
    if (!guideActive || !voiceOn || nextCue === null || detailRoute === null) return;
    const stage = voiceStage(nextCue.cue.mode, nextCue.remainingM);
    if (stage === null) return;
    const key = spokenKey(nextCue, stage);
    if (spokenRef.current.has(key)) return;
    spokenRef.current.add(key);
    const text = cueSpeech(detailRoute, nextCue, stage);
    // 도착 문장은 "도착 완료" 버튼도 말한다. 먼저 말한 쪽이 기록을 가져가 두 번 말하지 않게 한다
    if (text === ANNOUNCE.arrived) spokenRef.current.add(ARRIVED_KEY);
    speech.speak(text);
  }, [guideActive, voiceOn, nextCue, detailRoute, speech]);

  /**
   * 도착 발화 — 화면에는 전체 요약이 뜨지만 화면을 보지 않는 것이 전제인 기능이라 말로도 알린다.
   * 마지막 구간의 `arrive` 회전 안내와 문장이 같아 같은 기록(`ARRIVED_KEY`)을 나눠 쓴다.
   */
  useEffect(() => {
    if (arrivalSummary === null) return;
    if (spokenRef.current.has(ARRIVED_KEY)) return;
    spokenRef.current.add(ARRIVED_KEY);
    speech.speak(ANNOUNCE.arrived);
  }, [arrivalSummary, speech]);

  /**
   * 재탐색 — 경로에서 많이 벗어나면 지금 상황(어느 구간·어느 대여소·어떤 경로 종류)을 그대로
   * 유지한 채 다시 계산해 달라고 한다.
   */
  const reroute = useMutation({
    // `status`는 서버에 보내지 않는다 — 응답이 왔을 때 아직 유효한 요청인지 가르는 번호다
    mutationFn: ({ status: _status, ...request }: ReRoutePathRequest & { status: number }) =>
      getReRoutePaths(request),
    onSuccess: (routes, { status }) => {
      // 요청을 보낸 뒤에 대여·반납이 있었으면 그 응답은 옛 상황 기준이다(예: 자전거 타는 중으로
      // 보낸 자동 재탐색이 반납 뒤에 도착) — 받으면 방금 넘긴 안내 단계를 되돌리므로 버린다
      if (status !== statusRef.current) return;
      if (routes.length === 0) return;
      replaceRoutes(routes);
      // 새 경로에는 예전 회전 안내가 남으면 안 된다
      spokenRef.current.clear();
      showToast('경로를 다시 찾았어요.');
      speech.speak(ANNOUNCE.reroute);
    },
    onError: () => {
      // 재탐색 실패는 안내를 멈출 일이 아니다 — 기존 경로로 계속 안내한다
      showToast('경로를 다시 찾지 못했어요. 원래 경로로 안내합니다.');
      speech.speak(ANNOUNCE.rerouteFailed);
    },
  });

  const mutateReroute = reroute.mutate;
  const requestReroute = (request: ReRoutePathRequest) =>
    mutateReroute({ ...request, status: statusRef.current });
  const reroutePending = reroute.isPending;
  useEffect(() => {
    if (!rerouteEnabled || !guideActive || detailRoute === null || guideProgress === null) return;
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
    mutateReroute({
      status: statusRef.current,
      start: location.position,
      end: destinationPos,
      startStationId: detailRoute.startStation?.stationId ?? null,
      endStationId: detailRoute.endStation?.stationId ?? null,
      travelStatus: toTravelStatus(guideProgress.leg, guideProgress.legIndex),
      routeType: detailRoute.type,
      stationStrategy: detailRoute.stationStrategy,
    });
  }, [
    rerouteEnabled,
    guideActive,
    detailRoute,
    guideProgress,
    location.position,
    destinationPos,
    reroutePending,
    mutateReroute,
  ]);

  // 남은 시간은 남은 거리 비율로 총 소요 시간을 줄여 잡는다(구간별 속도 차이는 무시)
  const guideRemainingSec =
    guideProgress === null || totalSec === null
      ? 0
      : Math.round(totalSec * (1 - guideProgress.ratio));

  /**
   * "안내 종료"를 직접 눌러 끝낼 때 — 실제로 도착한 게 아니라 중간에 그만둔 것이므로 요약 없이
   * 지도로 나간다. 목적지·경로도 처음부터 다시 찾도록 같이 초기화한다(`clearJourney`).
   * "도착 완료"(`completeArrival`)는 이 함수를 쓰지 않고 전체 화면 요약(`arrivalSummary`)을 띄운다
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
    completeArrival,
    closeArrivalSummary,
    nextCue,
    rerouting: reroute.isPending,
    voiceOn,
    voiceSupported: speech.supported,
    toggleVoice: () =>
      setVoiceOn((on) => {
        writeVoiceOn(!on);
        return !on;
      }),
    /** "안내 시작"을 누르는 그 클릭 안에서 불러야 첫 소리가 막히지 않는다 */
    primeVoice: speech.prime,
  };
}
