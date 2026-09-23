import { describe, expect, it } from 'vitest';
import { toHeading } from '@/features/map/hooks/useDeviceHeading';

describe('센서 값 → 방위', () => {
  /*
   * 안드로이드 alpha는 북쪽에서 **반시계**로 증가한다. 그대로 쓰면 화살표가 좌우 반대로 돈다.
   * 실기기 실측: alpha 317 → 북동쪽(약 43도).
   */
  it('alpha를 뒤집어 시계방향 방위로 바꾼다', () => {
    expect(toHeading({ alpha: 0, absolute: true })).toBe(0); // 북
    expect(toHeading({ alpha: 270, absolute: true })).toBe(90); // 동
    expect(toHeading({ alpha: 180, absolute: true })).toBe(180); // 남
    expect(toHeading({ alpha: 90, absolute: true })).toBe(270); // 서
    expect(toHeading({ alpha: 317, absolute: true })).toBe(43); // 실측값
  });

  it('화면이 돌아가 있으면 그만큼 더한다', () => {
    expect(toHeading({ alpha: 0, absolute: true }, 90)).toBe(90);
    expect(toHeading({ alpha: 300, absolute: true }, 90)).toBe(150);
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
