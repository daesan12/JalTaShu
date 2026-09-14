import type { Pos } from '@/shared/api/types';

/**
 * 07 진입 시 초기 중심 — 대전시청 부근.
 * 현재위치 기능이 붙어도 위치 권한을 거절한 사용자에게 보여줄 기본값으로 유지한다.
 */
export const DAEJEON_CENTER = { lat: 36.3504, lng: 127.3845 } as const;

/** 대여소 여러 개가 한 화면에 들어오는 줌 단계 */
export const DEFAULT_ZOOM = 14;

/**
 * 경로 출발지의 마지막 수단 — 지도가 아직 만들어지지 않아 중심조차 읽을 수 없을 때만 쓴다.
 * 평소에는 현재 위치를, 위치를 못 얻으면 **지금 보고 있는 지도 중심**을 출발지로 보낸다.
 * 고정 좌표로 경로를 찾으면 사용자가 있지도 않은 곳에서 출발하는 경로가 나온다.
 */
export const START_POS_FALLBACK: Pos = { xPos: DAEJEON_CENTER.lng, yPos: DAEJEON_CENTER.lat };
