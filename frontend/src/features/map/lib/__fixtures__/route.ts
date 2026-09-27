import type {
  RouteCandidate,
  RouteLeg,
  RouteManeuver,
  RoutePoint,
  RouteStep,
  StationStrategy,
  RouteType,
  TravelMode,
} from '@/shared/api/types';

/**
 * 경로 테스트용 고정 데이터 (테스트 전용 — 앱 코드에서 import하지 않는다).
 *
 * 위도 36.35에서 경도 0.001도 ≈ 89.6m라, 좌표 11개를 경도로만 늘어놓으면 전체 길이 ≈ 896m인
 * 일직선 경로가 된다. 구간 경계는 **좌표 인덱스**로 정한다 — 실응답처럼 서버가 나눠 주는 것을 흉내낸다.
 */

export const POINT_COUNT = 11;

/** 0.001도 간격 한 칸의 대략적인 길이(m) — 테스트에서 기대값을 셀 때 쓴다 */
export const STEP_M = 89.6;

export function pointAt(index: number, altitude = 50): RoutePoint {
  return { location: [127 + index * 0.001, 36.35], altitude };
}

/** `from`~`to` 좌표를 담은 구간 하나. step은 하나로 둔다(step 분할은 서버 몫이라 여기서 안 다룬다) */
export function makeLeg(
  mode: TravelMode,
  from: number,
  to: number,
  distance: number,
  time: number,
  altitudes?: number[],
): RouteLeg {
  const points = Array.from({ length: to - from + 1 }, (_, i) =>
    pointAt(from + i, altitudes?.[from + i]),
  );
  return {
    mode,
    distance,
    time,
    steps: [
      {
        distance,
        time,
        roadName: '',
        travelMode: mode === 'WALK' ? 'walking' : 'cycling',
        points,
        behave: {
          type: 'depart',
          modifier: null,
          exit: null,
          location: points[0].location,
          instruction: '출발하세요',
        },
      },
    ],
  };
}

export interface RouteOptions {
  type?: RouteType;
  stationStrategy?: StationStrategy;
  /** 좌표별 고도 — 인덱스가 좌표 번호 */
  altitudes?: number[];
  expectedBikeCnt?: number;
  totalAscent?: number;
  /** 구간 거리(m) — [도보, 자전거, 도보]. 0을 넣으면 그 구간은 "이동 없음"이 된다 */
  distances?: [number, number, number];
  /** 구간 소요 시간(초) — [도보, 자전거, 도보] */
  times?: [number, number, number];
  /** 구간 전체를 직접 넘기고 싶을 때 */
  legs?: RouteLeg[];
}

/** 도보 → 자전거 → 도보 세 구간짜리 기본 경로. 좌표 경계는 2·8번 */
export function makeRoute(options: RouteOptions = {}): RouteCandidate {
  const { altitudes, distances = [179, 538, 179], times = [150, 200, 150] } = options;
  const legs = options.legs ?? [
    makeLeg('WALK', 0, 2, distances[0], times[0], altitudes),
    makeLeg('BICYCLE', 2, 8, distances[1], times[1], altitudes),
    makeLeg('WALK', 8, POINT_COUNT - 1, distances[2], times[2], altitudes),
  ];
  return {
    type: options.type ?? 'BIKE',
    stationStrategy: options.stationStrategy ?? 'NEAREST',
    startStation: { stationId: 'ST0001', name: '대여 대여소', location: pointAt(2).location },
    endStation: { stationId: 'ST0002', name: '반납 대여소', location: pointAt(8).location },
    totalDistance: legs.reduce((sum, leg) => sum + leg.distance, 0),
    totalTime: legs.reduce((sum, leg) => sum + leg.time, 0),
    totalAscent: options.totalAscent,
    legs,
    expectedBikeCnt: options.expectedBikeCnt,
  };
}

export function makeManeuver(
  type: string,
  modifier: string | null,
  instruction: string,
  exit: number | null = null,
): RouteManeuver {
  return { type, modifier, exit, location: pointAt(0).location, instruction };
}

/**
 * step이 여러 개인 구간 — 회전 안내 테스트용.
 * 실제 OSRM처럼 step 경계 좌표를 앞뒤 step이 함께 갖는다(`to`가 다음 step의 `from`).
 */
export function makeSteppedLeg(
  mode: TravelMode,
  steps: { from: number; to: number; maneuver: RouteManeuver }[],
  distance = 500,
  time = 300,
): RouteLeg {
  const built: RouteStep[] = steps.map(({ from, to, maneuver }) => ({
    distance: (to - from) * STEP_M,
    time: (to - from) * 30,
    roadName: '',
    travelMode: mode === 'WALK' ? 'walking' : 'cycling',
    points: Array.from({ length: to - from + 1 }, (_, i) => pointAt(from + i)),
    behave: maneuver,
  }));
  return { mode, distance, time, steps: built };
}
