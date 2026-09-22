import type { RouteCandidate, TravelMode } from '@/shared/api/types';
import type { NextCue, RouteCue } from '@/features/map/lib/routeCues';
import { toLegs } from '@/features/map/lib/routeSegments';

/**
 * 12 음성 안내 — **무엇을 언제 말할지**만 정한다. 실제로 소리를 내는 것은 `hooks/useSpeech.ts`.
 * 판단을 순수 함수로 빼 둬야 테스트할 수 있다(음성은 브라우저가 없으면 못 돌린다).
 */

/** 한 회전에 대해 두 번 말한다 — 미리 한 번(far), 코앞에서 한 번(near) */
export type VoiceStage = 'far' | 'near';

/**
 * 이동 수단별 안내 거리(m).
 * 자전거는 도보보다 3~4배 빨라 같은 거리에서 알려 주면 이미 지나쳐 있다.
 *
 * ⚠ 이 숫자는 **실주행 전에 바꾸지 않는다**(2026-09-21 결정). 자전거 200m는 시속 15km 기준
 * 48초 전이라 이른 편이고 도심 교차로 간격(100~150m)을 생각하면 150m가 나을 수 있지만,
 * 책상에서는 판단할 수 없다. staging 실주행 한 번이면 답이 나온다.
 */
const THRESHOLDS: Record<TravelMode, Record<VoiceStage, number>> = {
  WALK: { far: 60, near: 15 },
  BICYCLE: { far: 200, near: 40 },
};

/** 지금 말해야 할 단계. 아직 멀거나 이미 다 말했으면 null */
export function voiceStage(mode: TravelMode, remainingM: number): VoiceStage | null {
  const threshold = THRESHOLDS[mode];
  if (remainingM <= threshold.near) return 'near';
  if (remainingM <= threshold.far) return 'far';
  return null;
}

/** 거리를 말로 옮길 때는 10m 단위로 끊는다 — "187m 앞"은 사람이 쓰는 말이 아니다 */
function spokenDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.max(10, Math.round(meters / 10) * 10)}m`;
}

/**
 * 구간 경계 문구 — 여기서만 프론트가 문장을 만든다.
 *
 * 회전 문구는 서버 `instruction`을 그대로 쓴다는 규칙 그대로다. 구간 경계는 예외인데, 서버가
 * 주는 문장이 **어느 구간이든 똑같기 때문**이다(목업은 "구간 목적지에 도착했습니다"). 3구간
 * 경로에서 그 문장이 세 번 나오면 지금 대여소에 온 건지 진짜 다 온 건지 알 수 없다. 화면을 보지
 * 않는 것이 전제인 기능에서 이건 못 쓴다. 구간 안내 문구를 프론트가 만드는 것은 화면 쪽
 * `legInstruction()`이 이미 하고 있던 일이기도 하다.
 *
 * 대여소 이름을 모르면(`startStation`이 null인 WALK 단독 후보 등) null을 돌려 서버 문장을 쓴다.
 *
 * 단계를 받는 이유는 `cueSpeech`가 far에 거리를 앞에 붙이기 때문이다. "60m 앞 목적지에
 * 도착했습니다"는 말이 안 되므로 far에서는 아직 안 도착한 말투("목적지입니다")로 돌려준다.
 */
export function boundarySpeech(
  route: RouteCandidate,
  cue: RouteCue,
  stage: VoiceStage,
): string | null {
  const legs = toLegs(route);
  const isLastLeg = cue.legIndex >= legs.length - 1;

  if (cue.maneuver.type === 'depart') {
    // 안내를 켠 직후 바로 나오는 첫 소리다(`atM`이 0이라 곧바로 near가 된다). "출발하세요"만으로는
    // 음성이 살아 있는지도, 지금 걸어야 하는지 타야 하는지도 알 수 없다
    if (cue.legIndex !== 0) return null;
    const first = legs[0];
    if (first === undefined) return null;
    const what = first.mode === 'WALK' ? '걸어서 이동하세요' : '자전거로 이동하세요';
    return `경로 안내를 시작합니다. ${what}`;
  }

  if (cue.maneuver.type !== 'arrive') return null;
  if (isLastLeg) return stage === 'far' ? '목적지입니다' : ANNOUNCE.arrived;

  // 마지막이 아닌 구간의 끝 = 대여소. 걷다가 끝났으면 빌릴 차례, 타다가 끝났으면 반납할 차례다
  const name = cue.mode === 'WALK' ? route.startStation?.name : route.endStation?.name;
  if (name === undefined || name === null) return null;
  if (stage === 'far') return `${name}입니다`;
  const what = cue.mode === 'WALK' ? '자전거를 대여하세요' : '자전거를 반납하세요';
  return `${name}입니다. ${what}`;
}

/**
 * 읽어 줄 문장. 회전 문구는 서버가 만든 `instruction`을 그대로 쓰고 거리만 앞에 붙인다.
 * 코앞(near)에서는 거리를 빼고 동작만 말한다 — "10m 앞 우회전"은 이미 늦다.
 */
export function cueSpeech(route: RouteCandidate, next: NextCue, stage: VoiceStage): string {
  const instruction = boundarySpeech(route, next.cue, stage) ?? next.cue.maneuver.instruction;
  if (stage === 'near') return instruction;
  return `${spokenDistance(next.remainingM)} 앞 ${instruction}`;
}

/**
 * 같은 안내를 두 번 말하지 않기 위한 표시.
 * GPS는 1~2초마다 들어오는데 "100m 이내" 같은 조건은 그동안 계속 참이라, 이 표시가 없으면
 * 한 회전을 수십 번 말한다.
 */
export function spokenKey(next: NextCue, stage: VoiceStage): string {
  return `${next.index}:${stage}`;
}

/**
 * 회전이 아닌 안내 문구.
 *
 * 재탐색과 도착은 지금까지 토스트로만 알렸는데, 화면을 보지 않는 것이 전제인 기능에서
 * "길을 잘못 들었다"와 "다 왔다"를 모르는 것은 회전 안내를 놓치는 것보다 큰 구멍이다.
 *
 * `arrived`는 마지막 구간 `arrive`의 near 문구와 **일부러 같은 문자열**이다. 도착 감지(30m)와
 * 회전 안내(도보 near 15m·자전거 near 40m)는 어느 쪽이 먼저 올지 경로에 따라 다른데, 먼저 말한
 * 쪽이 이 문장을 말했다는 기록을 남겨 두 번 말하지 않게 한다(`useRouteGuide`).
 */
export const ANNOUNCE = {
  arrived: '목적지에 도착했습니다',
  reroute: '경로를 다시 찾았습니다',
  rerouteFailed: '경로를 다시 찾지 못했습니다. 원래 경로로 안내합니다',
} as const;
