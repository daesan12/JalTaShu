import { describe, expect, it } from 'vitest';
import type { BikeStation } from '@/shared/api/types';
import { CLUSTER_MAX_ZOOM, clusterStations } from '@/features/map/lib/stationClusters';

/** 대전 시청 부근을 기준으로 조금씩 옮긴 대여소 */
function station(
  stationId: string,
  lat: number,
  lng: number,
  currentBikes: number | null = 3,
): BikeStation {
  return {
    stationId,
    name: `대여소 ${stationId}`,
    lat,
    lng,
    address: null,
    currentBikes,
    updatedAt: null,
  };
}

/** 줌 14에서 칸 하나는 경도 약 0.0069° — 이보다 훨씬 좁게/넓게 벌려 경계를 피한다 */
const BASE_LAT = 36.35;
const BASE_LNG = 127.3845;

describe('clusterStations', () => {
  it('같은 칸에 든 대여소를 묶고 자전거 대수를 더한다', () => {
    const { clusters, singles } = clusterStations(
      [
        station('a', BASE_LAT, BASE_LNG, 2),
        station('b', BASE_LAT + 0.0001, BASE_LNG + 0.0001, 5),
      ],
      14,
    );

    expect(singles).toEqual([]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].stations.map((s) => s.stationId)).toEqual(['a', 'b']);
    expect(clusters[0].totalBikes).toBe(7);
  });

  it('묶인 마커는 대여소들의 무게중심에 놓인다', () => {
    const { clusters } = clusterStations(
      [station('a', BASE_LAT, BASE_LNG), station('b', BASE_LAT + 0.0002, BASE_LNG + 0.0004)],
      14,
    );

    expect(clusters[0].lat).toBeCloseTo(BASE_LAT + 0.0001, 10);
    expect(clusters[0].lng).toBeCloseTo(BASE_LNG + 0.0002, 10);
  });

  it('멀리 떨어진 대여소는 묶지 않고 개별로 남긴다', () => {
    const { clusters, singles } = clusterStations(
      [station('a', BASE_LAT, BASE_LNG), station('b', BASE_LAT + 0.05, BASE_LNG + 0.05)],
      14,
    );

    expect(clusters).toEqual([]);
    expect(singles.map((s) => s.stationId)).toEqual(['a', 'b']);
  });

  it('확대하면 칸이 좁아져 같은 대여소들이 풀린다', () => {
    const near = [station('a', BASE_LAT, BASE_LNG), station('b', BASE_LAT + 0.003, BASE_LNG)];

    expect(clusterStations(near, 12).clusters).toHaveLength(1);
    expect(clusterStations(near, 16).clusters).toEqual([]);
  });

  it(`줌 ${CLUSTER_MAX_ZOOM + 1}부터는 겹쳐 있어도 묶지 않는다`, () => {
    const samePlace = [station('a', BASE_LAT, BASE_LNG), station('b', BASE_LAT, BASE_LNG)];

    expect(clusterStations(samePlace, CLUSTER_MAX_ZOOM).clusters).toHaveLength(1);

    const zoomedIn = clusterStations(samePlace, CLUSTER_MAX_ZOOM + 1);
    expect(zoomedIn.clusters).toEqual([]);
    expect(zoomedIn.singles.map((s) => s.stationId)).toEqual(['a', 'b']);
  });

  it('실시간 대수를 모르는 대여소는 합계에서 빼되 묶음에는 넣는다', () => {
    const { clusters } = clusterStations(
      [
        station('a', BASE_LAT, BASE_LNG, 4),
        station('b', BASE_LAT + 0.0001, BASE_LNG, null),
        station('c', BASE_LAT + 0.0002, BASE_LNG, 1),
      ],
      14,
    );

    expect(clusters[0].stations).toHaveLength(3);
    expect(clusters[0].totalBikes).toBe(5);
  });

  it('묶인 대여소가 전부 실시간 정보가 없으면 합계는 null이다 — 0대로 단정하지 않는다', () => {
    const { clusters } = clusterStations(
      [
        station('a', BASE_LAT, BASE_LNG, null),
        station('b', BASE_LAT + 0.0001, BASE_LNG, null),
      ],
      14,
    );

    expect(clusters[0].totalBikes).toBeNull();
  });

  it('고른 대여소는 묶음에서 빼고 합계에도 넣지 않는다', () => {
    const stations = [
      station('a', BASE_LAT, BASE_LNG, 2),
      station('b', BASE_LAT + 0.0001, BASE_LNG, 5),
      station('c', BASE_LAT + 0.0002, BASE_LNG, 6),
    ];

    const { clusters, singles } = clusterStations(stations, 14, 'b');

    expect(singles.map((s) => s.stationId)).toEqual(['b']);
    expect(clusters[0].stations.map((s) => s.stationId)).toEqual(['a', 'c']);
    expect(clusters[0].totalBikes).toBe(8);
  });

  it('고른 대여소를 빼서 한 곳만 남으면 그 대여소도 개별 마커가 된다', () => {
    const { clusters, singles } = clusterStations(
      [station('a', BASE_LAT, BASE_LNG), station('b', BASE_LAT + 0.0001, BASE_LNG)],
      14,
      'b',
    );

    expect(clusters).toEqual([]);
    expect(singles.map((s) => s.stationId)).toEqual(['b', 'a']);
  });

  it('같은 묶음은 줌이 같으면 같은 키를 준다 — 마커를 다시 만들지 않게', () => {
    const stations = [
      station('a', BASE_LAT, BASE_LNG),
      station('b', BASE_LAT + 0.0001, BASE_LNG),
    ];

    const first = clusterStations(stations, 14).clusters[0].key;
    const second = clusterStations(stations, 14).clusters[0].key;
    const other = clusterStations(stations, 13).clusters[0].key;

    expect(first).toBe(second);
    expect(other).not.toBe(first);
  });
});
