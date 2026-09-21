import { describe, expect, it } from 'vitest';
import type { NextCue } from '@/features/map/lib/routeCues';
import {
  ANNOUNCE,
  boundarySpeech,
  cueSpeech,
  spokenKey,
  voiceStage,
} from '@/features/map/lib/routeVoice';
import { makeManeuver, makeRoute } from '@/features/map/lib/__fixtures__/route';

const route = makeRoute();

function next(remainingM: number, mode: 'WALK' | 'BICYCLE' = 'BICYCLE', index = 0): NextCue {
  return {
    cue: { atM: 0, legIndex: 0, mode, maneuver: makeManeuver('turn', 'right', '우회전하세요') },
    remainingM,
    index,
  };
}

/** 구간 경계 안내 하나 — `legIndex`로 어느 구간의 끝인지 정한다 */
function boundary(
  type: string,
  mode: 'WALK' | 'BICYCLE',
  legIndex: number,
  remainingM = 0,
): NextCue {
  return {
    cue: {
      atM: 0,
      legIndex,
      mode,
      maneuver: makeManeuver(type, null, '구간 목적지에 도착했습니다'),
    },
    remainingM,
    index: 0,
  };
}

describe('voiceStage', () => {
  it('자전거는 도보보다 멀리서 알려 준다 — 같은 거리면 이미 지나쳐 있다', () => {
    expect(voiceStage('BICYCLE', 300)).toBeNull();
    expect(voiceStage('BICYCLE', 200)).toBe('far');
    expect(voiceStage('BICYCLE', 40)).toBe('near');
    expect(voiceStage('WALK', 200)).toBeNull();
    expect(voiceStage('WALK', 60)).toBe('far');
    expect(voiceStage('WALK', 15)).toBe('near');
  });

  it('코앞이면 near', () => {
    expect(voiceStage('BICYCLE', 0)).toBe('near');
    expect(voiceStage('WALK', 3)).toBe('near');
  });
});

describe('cueSpeech', () => {
  it('미리 알릴 때는 거리를 앞에 붙인다', () => {
    expect(cueSpeech(route, next(187), 'far')).toBe('190m 앞 우회전하세요');
  });

  it('거리는 10m 단위로 끊는다 — "187m 앞"은 사람이 쓰는 말이 아니다', () => {
    expect(cueSpeech(route, next(184), 'far')).toBe('180m 앞 우회전하세요');
    expect(cueSpeech(route, next(3), 'far')).toBe('10m 앞 우회전하세요');
  });

  it('1km를 넘으면 km로 말한다', () => {
    expect(cueSpeech(route, next(1240), 'far')).toBe('1.2km 앞 우회전하세요');
  });

  it('코앞에서는 거리를 빼고 동작만 말한다', () => {
    expect(cueSpeech(route, next(12), 'near')).toBe('우회전하세요');
  });

  it('회전 문구는 서버가 준 문장을 그대로 쓴다', () => {
    const cue = next(20);
    cue.cue.maneuver = makeManeuver(
      'roundabout',
      'right',
      '회전교차로에서 2번째 출구로 나가세요',
      2,
    );
    expect(cueSpeech(route, cue, 'near')).toBe('회전교차로에서 2번째 출구로 나가세요');
  });
});

describe('boundarySpeech', () => {
  it('첫 출발은 안내가 시작됐다는 것과 무엇을 할지 함께 말한다 — "출발하세요"로는 둘 다 모른다', () => {
    const depart = boundary('depart', 'WALK', 0);
    expect(cueSpeech(route, depart, 'near')).toBe('경로 안내를 시작합니다. 걸어서 이동하세요');
  });

  it('걷기 구간의 끝은 대여 대여소 — 이름과 대여를 말한다', () => {
    const arrive = boundary('arrive', 'WALK', 0);
    expect(cueSpeech(route, arrive, 'near')).toBe('대여 대여소입니다. 자전거를 대여하세요');
  });

  it('자전거 구간의 끝은 반납 대여소 — 이름과 반납을 말한다', () => {
    const arrive = boundary('arrive', 'BICYCLE', 1);
    expect(cueSpeech(route, arrive, 'near')).toBe('반납 대여소입니다. 자전거를 반납하세요');
  });

  it('마지막 구간의 끝만 "목적지"다 — 서버 문장은 구간마다 똑같아 셋을 구분할 수 없다', () => {
    const arrive = boundary('arrive', 'WALK', 2);
    expect(cueSpeech(route, arrive, 'near')).toBe(ANNOUNCE.arrived);
  });

  it('미리 알릴 때는 아직 안 도착한 말투 — "60m 앞 목적지에 도착했습니다"는 말이 안 된다', () => {
    expect(cueSpeech(route, boundary('arrive', 'WALK', 2, 58), 'far')).toBe('60m 앞 목적지입니다');
    expect(cueSpeech(route, boundary('arrive', 'WALK', 0, 58), 'far')).toBe(
      '60m 앞 대여 대여소입니다',
    );
  });

  it('대여소를 모르는 후보는 서버 문장으로 돌아간다', () => {
    const walkOnly = { ...route, startStation: null, endStation: null };
    expect(boundarySpeech(walkOnly, boundary('arrive', 'WALK', 0).cue, 'near')).toBeNull();
  });

  it('회전 안내는 손대지 않는다', () => {
    expect(boundarySpeech(route, next(50).cue, 'near')).toBeNull();
  });
});

describe('spokenKey', () => {
  it('같은 회전이라도 단계가 다르면 따로 센다', () => {
    expect(spokenKey(next(200, 'BICYCLE', 3), 'far')).not.toBe(
      spokenKey(next(30, 'BICYCLE', 3), 'near'),
    );
  });

  it('같은 회전·같은 단계면 같은 값이다 — 이걸로 반복 발화를 막는다', () => {
    expect(spokenKey(next(200, 'BICYCLE', 3), 'far')).toBe(
      spokenKey(next(180, 'BICYCLE', 3), 'far'),
    );
  });
});
