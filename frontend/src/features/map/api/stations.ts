import { apiGet } from '@/shared/api/client';
import { posToLatLng } from '@/shared/lib/coords';
import type { BikeStation, BikeStationDetail, StationForecastPoint } from '@/shared/api/types';

export const BIKE_STATIONS_QUERY_KEY = ['map', 'bike-station'] as const;

/** 대여소 상세(예상 대수) 캐시 키 — 시트를 확장한 대여소 하나만 부른다 */
export function bikeStationDetailKey(stationId: string) {
  return ['map', 'bike-station', stationId] as const;
}

/*
 * 아래 두 타입은 **백엔드 응답 원형**이다. 화면이 쓰는 이름(`currentBikes`·`lat`/`lng`)으로
 * 바꾸는 곳은 이 파일 하나뿐이다 — 좌표 뒤집힘이 이 프로젝트 1순위 버그라 변환을 흩뿌리지 않는다.
 */
interface BikeStationListItemRes {
  stationId: string;
  name: string;
  /** 경도 */
  xPos: number;
  /** 위도 */
  yPos: number;
  address: string | null;
  /** 실시간 스냅샷에 없는 대여소는 null */
  currentCnt: number | null;
  /** 그 대수의 기준 시각 (ISO 8601). 스냅샷에 없으면 null */
  time: string | null;
}

interface BikeStationDetailRes {
  stationId: string;
  currentCnt: number | null;
  time: string | null;
  futureData: StationForecastPoint[] | null;
}

/** 07 메인 지도 대여소 목록 — 백엔드 GET /map/bike-station (파라미터 없이 전체를 준다) */
export async function getBikeStations(): Promise<BikeStation[]> {
  const items = await apiGet<BikeStationListItemRes[]>('/map/bike-station');
  return items.map((item) => ({
    stationId: item.stationId,
    name: item.name,
    ...posToLatLng({ xPos: Number(item.xPos), yPos: Number(item.yPos) }),
    address: item.address,
    currentBikes: item.currentCnt,
    updatedAt: item.time,
  }));
}

/**
 * 대여소 상세 — 백엔드 GET /map/bike-station/{stationId}.
 * 실시간 정보가 없는 대여소는 백엔드가 404로 막으므로 호출부에서 실패를 안내 문구로 처리한다.
 */
export async function getBikeStationDetail(stationId: string): Promise<BikeStationDetail> {
  const detail = await apiGet<BikeStationDetailRes>(`/map/bike-station/${stationId}`);
  return {
    stationId: detail.stationId,
    currentBikes: detail.currentCnt,
    updatedAt: detail.time,
    futureData: detail.futureData ?? [],
  };
}
