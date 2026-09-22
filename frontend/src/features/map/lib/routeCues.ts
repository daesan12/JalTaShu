import type { RouteCandidate, RouteManeuver, TravelMode } from '@/shared/api/types';
import { cumulativeDistances, outlineRoute } from '@/features/map/lib/routeSegments';

/**
 * 12 회전 안내 — 경로에서 "무슨 동작을 어디서 하는지"를 뽑는다.
 *
 * 문구는 만들지 않는다. 서버가 `steps[].behave.instruction`에 한국어 문장을 이미 담아 준다
 * ("우회전하세요", "회전교차로에서 2번째 출구로 나가세요"). 프론트가 하는 일은 **어느 지점에서**
 * 그 문장을 띄울지, 지금 위치에서 **몇 m 남았는지**를 계산하는 것뿐이다.
 */

export interface RouteCue {
  /** 경로 시작부터 이 동작 지점까지의 거리(m) */
  atM: number;
  /** 이동 구간 번호 — 진행률의 `legIndex`와 같은 기준 */
  legIndex: number;
  mode: TravelMode;
  maneuver: RouteManeuver;
}

/**
 * 안내하지 않는 동작 — OSRM은 길 이름이 바뀌기만 해도 step을 끊는다.
 * 그대로 두면 "직진하세요"가 수십 번 나오고, 음성으로 들으면 못 쓴다.
 */
const SILENT_TYPES = new Set(['new name', 'notification', 'continue']);
const STRAIGHT_MODIFIERS = new Set(['straight', 'uturn-less']);

/** 출발·도착·회전교차로·갈림길은 방향이 없어도 알려줄 값이 있다 */
const ALWAYS_TYPES = new Set(['depart', 'arrive', 'roundabout', 'rotary', 'fork']);

export function isNotableManeuver(maneuver: RouteManeuver): boolean {
  if (ALWAYS_TYPES.has(maneuver.type)) return true;
  if (SILENT_TYPES.has(maneuver.type)) return false;
  // 방향이 없으면 결국 "직진하세요"라 안내할 값이 없다
  if (maneuver.modifier === null || STRAIGHT_MODIFIERS.has(maneuver.modifier)) return false;
  return true;
}

/**
 * 경로의 안내 지점 목록 — 거리 순. 경로가 바뀔 때만 다시 만들면 된다.
 *
 * 첫 구간이 아닌 `depart`는 버린다. OSRM은 구간마다 `depart`와 `arrive`를 주는데 구간 경계에서
 * 둘이 **같은 좌표**에 놓인다. 그대로 두면 대여소에서 "○○ 대여소입니다" 직후에 "출발하세요"가
 * 겹쳐 터지고, 음성은 뒤엣것이 앞엣것을 끊어 정작 대여소 이름을 못 듣는다.
 * 구간이 바뀐다는 사실은 그 자리의 `arrive` 문구가 이미 말해 준다(`routeVoice.ts`).
 */
export function buildRouteCues(route: RouteCandidate): RouteCue[] {
  const { points, stepStarts } = outlineRoute(route);
  if (points.length < 2) return [];
  const cumulative = cumulativeDistances(points);
  return stepStarts
    .filter((step) => isNotableManeuver(step.maneuver))
    .filter((step) => step.maneuver.type !== 'depart' || step.legIndex === 0)
    .map((step) => ({
      atM: cumulative[step.index] ?? 0,
      legIndex: step.legIndex,
      mode: step.mode,
      maneuver: step.maneuver,
    }));
}

/**
 * 지나친 안내로 보는 여유(m) — GPS가 튀어 조금 뒤로 잡혀도 이미 한 회전으로 돌아가지 않게.
 * 이 거리만큼 지난 안내는 다음 것을 보여준다.
 */
const PASSED_MARGIN_M = 10;

export interface NextCue {
  cue: RouteCue;
  /** 지금 위치에서 그 동작 지점까지 남은 거리(m) */
  remainingM: number;
  /** 이 경로의 몇 번째 안내인지 — 같은 안내를 두 번 말하지 않으려고 쓴다 */
  index: number;
}

/** 지금 향하고 있는 다음 안내. 다 지났으면 null */
export function getNextCue(cues: RouteCue[], traveledM: number): NextCue | null {
  for (let i = 0; i < cues.length; i++) {
    const remainingM = cues[i].atM - traveledM;
    if (remainingM > -PASSED_MARGIN_M) {
      return { cue: cues[i], remainingM: Math.max(0, Math.round(remainingM)), index: i };
    }
  }
  return null;
}
