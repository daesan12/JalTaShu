import { describe, expect, it } from 'vitest';
import { toHeading } from '@/features/map/hooks/useDeviceHeading';

/** 눕힌 폰(beta=0, gamma=0)의 나침반 값 */
function flat(alpha: number) {
  return { alpha, beta: 0, gamma: 0, absolute: true };
}

describe('센서 값 → 방위', () => {
  /*
   * 안드로이드 alpha는 북쪽에서 **반시계**로 증가한다. 그대로 쓰면 화살표가 좌우 반대로 돈다.
   * 실기기 실측(책상에 눕힌 상태): alpha 317 → 북동쪽(약 43도).
   */
  it('눕힌 폰은 alpha를 뒤집은 값이 방위다', () => {
    expect(toHeading(flat(0))).toBeCloseTo(0); // 북
    expect(toHeading(flat(270))).toBeCloseTo(90); // 동
    expect(toHeading(flat(180))).toBeCloseTo(180); // 남
    expect(toHeading(flat(90))).toBeCloseTo(270); // 서
    expect(toHeading(flat(317))).toBeCloseTo(43); // 실측값
  });

  /*
   * 안내 중엔 폰을 세워 든다. 이때 alpha만 쓰면 방향이 틀린다 — 실기기에서 사용자가 겪은 증상.
   * 세운 폰은 뒷면(카메라)이 가리키는 쪽이 내가 보는 방향이다.
   */
  it('세운 폰은 뒷면이 가리키는 방위를 쓴다', () => {
    expect(toHeading({ alpha: 0, beta: 90, gamma: 0, absolute: true })).toBeCloseTo(0); // 북
    expect(toHeading({ alpha: 270, beta: 90, gamma: 0, absolute: true })).toBeCloseTo(90); // 동
    expect(toHeading({ alpha: 180, beta: 90, gamma: 0, absolute: true })).toBeCloseTo(180); // 남
  });

  // 폰을 세우면 alpha와 gamma가 같은 축을 돌려 서로 섞인다(짐벌 락). 합만 의미가 있다.
  it('세운 폰에서 alpha·gamma가 섞여 와도 방위는 같다', () => {
    // 북쪽을 보는 세운 폰이 alpha 30, gamma −30으로 올 수 있다. alpha만 쓰면 330도로 틀린다.
    expect(toHeading({ alpha: 30, beta: 90, gamma: -30, absolute: true })).toBeCloseTo(0);
    expect(toHeading({ alpha: 300, beta: 90, gamma: 45, absolute: true })).toBeCloseTo(15);
  });

  // 같은 방향을 보며 폰만 눕히거나 세워도 화살표가 튀면 안 된다
  it('앞뒤로만 기울이면 자세와 무관하게 같은 방위다', () => {
    for (const beta of [0, 20, 45, 60, 89]) {
      expect(toHeading({ alpha: 300, beta, gamma: 0, absolute: true })).toBeCloseTo(60);
    }
  });

  // 폰을 90도 넘게 젖히면 윗변은 뒤를 가리킨다 — 이때도 뒷면 기준이라 방향이 뒤집히지 않는다
  it('90도 넘게 젖힌 폰도 보는 방향을 가리킨다', () => {
    expect(toHeading({ alpha: 0, beta: 120, gamma: 0, absolute: true })).toBeCloseTo(0);
  });

  it('beta·gamma가 없으면 눕힌 것으로 본다', () => {
    expect(toHeading({ alpha: 270, absolute: true })).toBeCloseTo(90);
  });

  it('화면이 돌아가 있으면 그만큼 더한다', () => {
    expect(toHeading(flat(0), 90)).toBeCloseTo(90);
    expect(toHeading(flat(300), 90)).toBeCloseTo(150);
  });

  // iOS는 이미 시계방향 방위라 변환하면 안 된다
  it('iOS 값은 그대로 쓴다', () => {
    expect(toHeading({ alpha: 10, absolute: false, webkitCompassHeading: 123 })).toBe(123);
  });

  it('나침반 값이 아니면 쓰지 않는다', () => {
    expect(toHeading({ alpha: 100, absolute: false })).toBeNull(); // 상대 각도
    expect(toHeading({ alpha: null, absolute: true })).toBeNull();
  });
});
