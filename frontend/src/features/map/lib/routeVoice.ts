import type { TravelMode } from '@/shared/api/types';
import type { NextCue } from '@/features/map/lib/routeCues';

/**
 * 12 음성 안내 — **무엇을 언제 말할지**만 정한다. 실제로 소리를 내는 것은 `hooks/useSpeech.ts`.
 * 판단을 순수 함수로 빼 둬야 테스트할 수 있다(음성은 브라우저가 없으면 못 돌린다).
 */

/** 한 회전에 대해 두 번 말한다 — 미리 한 번(far), 코앞에서 한 번(near) */
export type VoiceStage = 'far' | 'near';

/**
 * 이동 수단별 안내 거리(m).
 * 자전거는 도보보다 3~4배 빨라 같은 거리에서 알려 주면 이미 지나쳐 있다.
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
 * 읽어 줄 문장. 문구 자체는 서버가 만든 `instruction`을 그대로 쓰고 거리만 앞에 붙인다.
 * 코앞(near)에서는 거리를 빼고 동작만 말한다 — "10m 앞 우회전"은 이미 늦다.
 */
export function cueSpeech(next: NextCue, stage: VoiceStage): string {
  const { instruction } = next.cue.maneuver;
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
