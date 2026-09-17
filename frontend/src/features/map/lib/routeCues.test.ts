import { describe, expect, it } from 'vitest';
import { buildRouteCues, getNextCue, isNotableManeuver } from '@/features/map/lib/routeCues';
import {
  makeManeuver,
  makeRoute,
  makeSteppedLeg,
  STEP_M,
} from '@/features/map/lib/__fixtures__/route';

const DEPART = makeManeuver('depart', null, '출발하세요');
const RIGHT = makeManeuver('turn', 'right', '우회전하세요');
const LEFT = makeManeuver('turn', 'left', '좌회전하세요');
const STRAIGHT = makeManeuver('turn', 'straight', '직진하세요');
const NEW_NAME = makeManeuver('new name', 'straight', '직진하세요');
const ARRIVE = makeManeuver('arrive', null, '구간 목적지에 도착했습니다');

/** 좌표 0~10을 4개의 step으로 나눈 자전거 한 구간짜리 경로 */
function routeWithTurns() {
  return makeRoute({
    legs: [
      makeSteppedLeg('BICYCLE', [
        { from: 0, to: 2, maneuver: DEPART },
        { from: 2, to: 5, maneuver: NEW_NAME }, // 길 이름만 바뀐 것 — 안내하지 않는다
        { from: 5, to: 8, maneuver: RIGHT },
        { from: 8, to: 10, maneuver: ARRIVE },
      ]),
    ],
  });
}

describe('isNotableManeuver', () => {
  it('출발·도착·회전교차로는 방향이 없어도 알린다', () => {
    expect(isNotableManeuver(DEPART)).toBe(true);
    expect(isNotableManeuver(ARRIVE)).toBe(true);
    expect(isNotableManeuver(makeManeuver('roundabout', null, '회전교차로로 진입하세요'))).toBe(
      true,
    );
  });

  it('방향이 있는 회전은 알린다', () => {
    expect(isNotableManeuver(RIGHT)).toBe(true);
    expect(isNotableManeuver(LEFT)).toBe(true);
  });

  it('길 이름만 바뀌거나 그냥 직진인 것은 걸러낸다 — 안 그러면 "직진하세요"만 수십 번 나온다', () => {
    expect(isNotableManeuver(NEW_NAME)).toBe(false);
    expect(isNotableManeuver(STRAIGHT)).toBe(false);
    expect(isNotableManeuver(makeManeuver('continue', null, '직진하세요'))).toBe(false);
  });
});

describe('buildRouteCues', () => {
  it('안내할 지점만 남기고 거리 순으로 준다', () => {
    const cues = buildRouteCues(routeWithTurns());
    expect(cues.map((cue) => cue.maneuver.instruction)).toEqual([
      '출발하세요',
      '우회전하세요',
      '구간 목적지에 도착했습니다',
    ]);
  });

  it('안내 지점의 거리는 그 step이 시작되는 좌표까지의 거리다', () => {
    const cues = buildRouteCues(routeWithTurns());
    expect(cues[0].atM).toBe(0);
    // 우회전은 5번 좌표에서 시작한다
    expect(cues[1].atM).toBeCloseTo(5 * STEP_M, 0);
    expect(cues[2].atM).toBeCloseTo(8 * STEP_M, 0);
  });

  it('구간 정보를 함께 담는다 — 이동 수단에 따라 안내 거리가 달라진다', () => {
    const cues = buildRouteCues(routeWithTurns());
    expect(cues.every((cue) => cue.mode === 'BICYCLE')).toBe(true);
    expect(cues.every((cue) => cue.legIndex === 0)).toBe(true);
  });

  it('좌표가 모자라면 빈 배열', () => {
    const empty = makeRoute({ legs: [] });
    expect(buildRouteCues(empty)).toEqual([]);
  });
});

describe('getNextCue', () => {
  const cues = buildRouteCues(routeWithTurns());

  it('아직 지나지 않은 첫 안내를 돌려준다', () => {
    const next = getNextCue(cues, 100);
    expect(next?.cue.maneuver.instruction).toBe('우회전하세요');
    expect(next?.remainingM).toBe(Math.round(cues[1].atM - 100));
  });

  it('막 지난 안내는 조금 더 붙들고 있는다 — GPS가 튀어 되돌아가도 다시 말하지 않게', () => {
    // 우회전 지점을 5m 지난 상태
    expect(getNextCue(cues, cues[1].atM + 5)?.cue.maneuver.instruction).toBe('우회전하세요');
    // 충분히 지나면 다음 안내로 넘어간다
    expect(getNextCue(cues, cues[1].atM + 30)?.cue.maneuver.instruction).toBe(
      '구간 목적지에 도착했습니다',
    );
  });

  it('남은 거리는 음수가 되지 않는다', () => {
    expect(getNextCue(cues, cues[1].atM + 5)?.remainingM).toBe(0);
  });

  it('다 지났으면 null', () => {
    expect(getNextCue(cues, 99_999)).toBeNull();
    expect(getNextCue([], 0)).toBeNull();
  });
});
