import { describe, expect, it } from 'vitest';
import type { BikeStation } from '@/shared/api/types';
import type { UsagePathPoint } from '@/features/history/api/rides';
import {
  UNKNOWN_POINT_LABEL,
  pointLabel,
  splitByTravelStatus,
  stationNameAt,
  toMapSegments,
  toGradeClass,
  toSegments,
  toSketchPath,
  totalAscentM,
} from '@/features/history/lib/usageDisplay';

function point(over: Partial<UsagePathPoint>): UsagePathPoint {
  return { latitude: 36.36, longitude: 127.35, altitude: 50, travelStatus: 'BIKE', seq: 0, ...over };
}

describe('stationNameAt', () => {
  const stations = [
    { stationId: 'ST0001', name: '유성구청역 대여소', lat: 36.362, lng: 127.3565, currentBikes: 1 },
  ] as BikeStation[];

  it('100m 이내 대여소 이름을 찾고, 멀면 null', () => {
    expect(stationNameAt({ latitude: 36.362, longitude: 127.3565 }, stations)).toBe(
      '유성구청역 대여소',
    );
    // 약 1km 밖
    expect(stationNameAt({ latitude: 36.371, longitude: 127.3565 }, stations)).toBeNull();
  });
});

describe('splitByTravelStatus', () => {
  it('seq 순서로 정렬한 뒤 WALK1→BIKE→WALK2 구간으로 나눈다', () => {
    const road = [
      point({ seq: 2, travelStatus: 'BIKE' }),
      point({ seq: 0, travelStatus: 'WALK1' }),
      point({ seq: 3, travelStatus: 'WALK2' }),
      point({ seq: 1, travelStatus: 'WALK1' }),
    ];
    const groups = splitByTravelStatus(road);
    expect(groups.map((g) => g.status)).toEqual(['WALK1', 'BIKE', 'WALK2']);
    expect(groups[0].points).toHaveLength(2);
  });
});

describe('toGradeClass', () => {
  it('경사(%)를 4단계로 나눈다 — 내리막·평지는 flat', () => {
    expect(toGradeClass(-3)).toBe('flat');
    expect(toGradeClass(0.5)).toBe('flat');
    expect(toGradeClass(2)).toBe('gentle');
    expect(toGradeClass(5)).toBe('climb');
    expect(toGradeClass(9)).toBe('steep');
  });
});

describe('totalAscentM', () => {
  it('올라가는 구간만 더한다', () => {
    const road = [50, 70, 60, 90].map((altitude, seq) => point({ altitude, seq }));
    expect(totalAscentM(road)).toBe(50); // +20, +30
  });
});

describe('toSketchPath', () => {
  it('좌표를 0~100 그림 공간으로 정규화하고 도보는 walk 종류를 받는다', () => {
    const road = [
      point({ seq: 0, travelStatus: 'WALK1', latitude: 36.36, longitude: 127.35 }),
      point({ seq: 1, travelStatus: 'BIKE', latitude: 36.365, longitude: 127.36 }),
      point({ seq: 2, travelStatus: 'WALK2', latitude: 36.37, longitude: 127.37 }),
    ];
    const path = toSketchPath(road);
    expect(path.map((s) => s.kind === 'walk')).toEqual([true, false, true]);
    for (const segment of path) {
      for (const [x, y] of segment.points) {
        expect(x).toBeGreaterThanOrEqual(8);
        expect(x).toBeLessThanOrEqual(92);
        expect(y).toBeGreaterThanOrEqual(8);
        expect(y).toBeLessThanOrEqual(56);
      }
    }
    // 위도가 클수록(북쪽) 화면 위쪽(y 작음)
    const firstY = path[0].points[0][1];
    const lastSeg = path[path.length - 1];
    const lastY = lastSeg.points[lastSeg.points.length - 1][1];
    expect(lastY).toBeLessThan(firstY);
  });
});

describe('toSegments', () => {
  it('자전거 시간은 탑승 시각 차이, 도보 시간은 남은 시간을 거리 비율로 나눈다', () => {
    // 도보 200m → 자전거 → 도보 400m 꼴의 경로 (경도 0.001도 ≈ 90m)
    const road = [
      point({ seq: 0, travelStatus: 'WALK1', longitude: 127.35 }),
      point({ seq: 1, travelStatus: 'WALK1', longitude: 127.352 }),
      point({ seq: 2, travelStatus: 'BIKE', longitude: 127.36 }),
      point({ seq: 3, travelStatus: 'WALK2', longitude: 127.364 }),
    ];
    const segments = toSegments(road, {
      startingDate: '2026-09-17T09:00:00+09:00',
      totalDurationSec: 20 * 60,
      cycleRidingStartTime: '2026-09-17T09:03:00+09:00',
      cycleRidingEndTime: '2026-09-17T09:17:00+09:00',
    });
    expect(segments.map((s) => s.type)).toEqual(['walk', 'bike', 'walk']);
    expect(segments[1].durationMin).toBe(14);
    // 도보 총 6분을 거리 비율로 배분 — 합이 총 도보 시간과 비슷해야 한다
    const walkSum = (segments[0].durationMin ?? 0) + (segments[2].durationMin ?? 0);
    expect(walkSum).toBeGreaterThanOrEqual(5);
    expect(walkSum).toBeLessThanOrEqual(7);
  });

  it('탑승 시각이 없으면 시간은 null이고 거리만 준다', () => {
    const road = [
      point({ seq: 0, travelStatus: 'WALK1' }),
      point({ seq: 1, travelStatus: 'BIKE', longitude: 127.36 }),
    ];
    const segments = toSegments(road, {
      startingDate: '2026-09-17T09:00:00+09:00',
      totalDurationSec: 600,
      cycleRidingStartTime: null,
      cycleRidingEndTime: null,
    });
    expect(segments.every((s) => s.durationMin === null)).toBe(true);
  });
});

describe('좌표가 없는 기록', () => {
  // 경로 안내 없이 QR로만 대여·반납한 기록은 출발·도착 좌표가 null로 온다(실서버).
  // 이 값을 읽다 이동 기록 탭 전체가 죽었다 — 문구로 대신한다.
  it('pointLabel은 null 좌표에 안내 문구를 돌려준다', () => {
    expect(pointLabel(null, undefined)).toBe(UNKNOWN_POINT_LABEL);
    expect(pointLabel(null, [])).toBe(UNKNOWN_POINT_LABEL);
  });

  it('stationNameAt은 null 좌표에 null을 돌려준다', () => {
    expect(stationNameAt(null, [])).toBeNull();
  });
});

describe('지도 구간 변환', () => {
  it('seq 순으로 정렬하고 이동 수단이 바뀌는 곳에서 나눈다', () => {
    const road: UsagePathPoint[] = [
      point({ seq: 2, travelStatus: 'BIKE', latitude: 36.362 }),
      point({ seq: 0, travelStatus: 'WALK1', latitude: 36.36 }),
      point({ seq: 1, travelStatus: 'WALK1', latitude: 36.361 }),
      point({ seq: 3, travelStatus: 'WALK2', latitude: 36.363 }),
    ];
    expect(toMapSegments(road)).toEqual([
      { mode: 'WALK', points: [{ lat: 36.36, lng: 127.35 }, { lat: 36.361, lng: 127.35 }] },
      { mode: 'BIKE', points: [{ lat: 36.362, lng: 127.35 }] },
      { mode: 'WALK', points: [{ lat: 36.363, lng: 127.35 }] },
    ]);
  });
});
