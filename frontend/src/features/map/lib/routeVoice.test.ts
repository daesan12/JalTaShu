import { describe, expect, it } from 'vitest';
import type { NextCue } from '@/features/map/lib/routeCues';
import { cueSpeech, spokenKey, voiceStage } from '@/features/map/lib/routeVoice';
import { makeManeuver } from '@/features/map/lib/__fixtures__/route';

function next(remainingM: number, mode: 'WALK' | 'BICYCLE' = 'BICYCLE', index = 0): NextCue {
  return {
    cue: { atM: 0, legIndex: 0, mode, maneuver: makeManeuver('turn', 'right', '우회전하세요') },
    remainingM,
    index,
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
    expect(cueSpeech(next(187), 'far')).toBe('190m 앞 우회전하세요');
  });

  it('거리는 10m 단위로 끊는다 — "187m 앞"은 사람이 쓰는 말이 아니다', () => {
    expect(cueSpeech(next(184), 'far')).toBe('180m 앞 우회전하세요');
    expect(cueSpeech(next(3), 'far')).toBe('10m 앞 우회전하세요');
  });

  it('1km를 넘으면 km로 말한다', () => {
    expect(cueSpeech(next(1240), 'far')).toBe('1.2km 앞 우회전하세요');
  });

  it('코앞에서는 거리를 빼고 동작만 말한다', () => {
    expect(cueSpeech(next(12), 'near')).toBe('우회전하세요');
  });

  it('문구는 서버가 준 문장을 그대로 쓴다', () => {
    const cue = next(20);
    cue.cue.maneuver = makeManeuver(
      'roundabout',
      'right',
      '회전교차로에서 2번째 출구로 나가세요',
      2,
    );
    expect(cueSpeech(cue, 'near')).toBe('회전교차로에서 2번째 출구로 나가세요');
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
