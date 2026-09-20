import type { BikeStation } from '@/shared/api/types';

/**
 * 07 지도 대여소 마커 묶기.
 *
 * 축소하면 대전 전역의 대여소가 한 화면에 들어와 마커가 서로를 덮는다. 가까운 것끼리 묶어
 * 자전거 합계 하나로 보여주고, 확대하면 저절로 풀리게 한다.
 *
 * 격자는 **화면 픽셀이 아니라 위경도**에 박는다. 픽셀 기준으로 나누면 지도를 옆으로 끌 때마다
 * 칸 경계가 같이 움직여 묶음이 재구성되고 마커가 깜빡인다. 위경도에 박아 두면 팬 중에는
 * 결과가 전혀 바뀌지 않으므로 줌이 바뀔 때만 다시 계산하면 된다.
 *
 * 지도 SDK를 쓰지 않는 순수 함수다 — 테스트에서 네이버 지도를 띄울 필요가 없다.
 */

/** 묶는 칸이 화면에서 차지하는 크기(px). 마커 지름(32~40px)보다 커야 겹침이 풀린다 */
const CELL_PX = 80;

/**
 * 이 줌부터는 묶지 않는다.
 *
 * 칸 크기가 줌에 따라 줄어드니 임계값 없이도 대부분 풀리지만, 같은 자리에 겹쳐 있는 대여소는
 * 아무리 확대해도 한 칸에 남는다. 그러면 "묶음을 탭하면 확대" 동작이 끝나지 않는다.
 * 어느 대여소든 반드시 개별로 고를 수 있게 상한을 둔다.
 */
export const CLUSTER_MAX_ZOOM = 16;

/**
 * 격자 세로 칸을 재는 기준 위도(대전).
 *
 * 메르카토르 지도에서 위도 1°의 픽셀 길이는 위도가 높을수록 길어진다. 칸을 화면에서 정사각형에
 * 가깝게 만들려면 세로 칸을 `cos(위도)`만큼 좁혀야 한다. 대여소가 전부 대전 안이라 위도 폭이
 * 0.1° 남짓이고 그 안에서 `cos` 차이는 0.2%도 안 되므로 상수 하나로 충분하다.
 */
const REFERENCE_LAT = 36.35;

/** 네이버 지도 타일 한 장의 크기(px). 줌 0에서 이 폭이 경도 360°를 덮는다 */
const TILE_PX = 256;

/** 묶인 대여소 무리 하나 */
export interface StationCluster {
  /** React 키·마커 식별자. 줌과 칸 위치에서 만들어 같은 묶음이면 같은 값이 나온다 */
  key: string;
  /** 묶인 대여소들의 무게중심 — 마커를 찍을 자리 */
  lat: number;
  lng: number;
  stations: BikeStation[];
  /**
   * 실시간 대수를 아는 대여소들의 합계. 전부 모르면 null.
   * 모르는 대여소를 0으로 세지 않는다 — 자전거가 없다는 거짓말이 된다.
   */
  totalBikes: number | null;
}

export interface StationClusterResult {
  /** 대여소 2곳 이상이 묶인 무리 */
  clusters: StationCluster[];
  /** 묶이지 않고 혼자 그려지는 대여소 */
  singles: BikeStation[];
}

/** 이 줌에서 칸 하나의 경도·위도 폭(°) */
function cellSize(zoom: number) {
  const lng = (CELL_PX * 360) / (TILE_PX * 2 ** zoom);
  return { lng, lat: lng * Math.cos((REFERENCE_LAT * Math.PI) / 180) };
}

/**
 * 대여소를 줌에 맞춰 묶는다.
 *
 * @param selectedStationId 시트가 열려 있는 대여소. 묶음에 넣지 않고 항상 개별 마커로 남긴다 —
 *   고른 대여소가 묶음 안으로 사라지면 시트가 어디를 가리키는지 알 수 없다.
 */
export function clusterStations(
  stations: BikeStation[],
  zoom: number,
  selectedStationId: string | null = null,
): StationClusterResult {
  if (zoom > CLUSTER_MAX_ZOOM) {
    return { clusters: [], singles: stations };
  }

  const cell = cellSize(zoom);
  // 입력 순서를 유지해 같은 목록이면 항상 같은 결과가 나오게 한다
  const cells = new Map<string, BikeStation[]>();
  const singles: BikeStation[] = [];

  for (const station of stations) {
    if (station.stationId === selectedStationId) {
      singles.push(station);
      continue;
    }
    const key = `${Math.floor(station.lat / cell.lat)}:${Math.floor(station.lng / cell.lng)}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(station);
    else cells.set(key, [station]);
  }

  const clusters: StationCluster[] = [];
  for (const [key, bucket] of cells) {
    // 혼자 남은 칸은 묶을 것이 없다
    if (bucket.length < 2) {
      singles.push(bucket[0]);
      continue;
    }
    clusters.push({
      key: `${zoom}:${key}`,
      lat: bucket.reduce((sum, s) => sum + s.lat, 0) / bucket.length,
      lng: bucket.reduce((sum, s) => sum + s.lng, 0) / bucket.length,
      stations: bucket,
      totalBikes: sumBikes(bucket),
    });
  }

  return { clusters, singles };
}

/** 실시간 값이 있는 대여소만 더한다. 하나도 없으면 null */
function sumBikes(stations: BikeStation[]): number | null {
  let total: number | null = null;
  for (const station of stations) {
    if (station.currentBikes === null) continue;
    total = (total ?? 0) + station.currentBikes;
  }
  return total;
}
