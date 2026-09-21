import { describe, expect, it } from 'vitest';
import { makeLeg, makeRoute } from '@/features/map/lib/__fixtures__/route';
import { toUsagePath } from '@/features/map/lib/usagePath';

describe('안내 경로 → 이용 기록 좌표', () => {
  it('도보→자전거→도보를 WALK1·BIKE·WALK2로 나눈다', () => {
    const path = toUsagePath(makeRoute());
    const statuses = [...new Set(path.map((p) => p.travelStatus))];
    expect(statuses).toEqual(['WALK1', 'BIKE', 'WALK2']);
  });

  it('seq는 0부터 빠짐없이 이어진다', () => {
    const path = toUsagePath(makeRoute());
    expect(path.length).toBeGreaterThan(0);
    expect(path.map((p) => p.seq)).toEqual(path.map((_, i) => i));
  });

  it('서버가 주는 [경도, 위도]를 뒤집어 담는다', () => {
    const route = makeRoute();
    const [firstLng, firstLat] = route.legs[0].steps[0].points[0].location;
    const first = toUsagePath(route)[0];
    expect(first.longitude).toBe(firstLng);
    expect(first.latitude).toBe(firstLat);
    // 위도는 ±90을 넘을 수 없다 — 뒤집혔다면 여기서 걸린다
    expect(Math.abs(first.latitude)).toBeLessThanOrEqual(90);
  });

  it('자전거 구간이 없으면 도보를 전부 WALK1로 본다 (반납 뒤 도보가 아니므로)', () => {
    const walkOnly = makeRoute({ legs: [makeLeg('WALK', 0, 5, 300, 240)] });
    expect(toUsagePath(walkOnly).every((p) => p.travelStatus === 'WALK1')).toBe(true);
  });

  it('거리 0인 구간은 좌표를 만들지 않는다', () => {
    const withEmptyLeg = makeRoute({
      legs: [makeLeg('WALK', 0, 2, 0, 0), makeLeg('BICYCLE', 2, 8, 500, 200)],
    });
    expect(toUsagePath(withEmptyLeg).every((p) => p.travelStatus === 'BIKE')).toBe(true);
  });
});
