import type { Pos } from '@/shared/api/types';

/**
 * 07 진입 시 초기 중심 — 대전시청 부근.
 * 현재위치 기능이 붙어도 위치 권한을 거절한 사용자에게 보여줄 기본값으로 유지한다.
 */
export const DAEJEON_CENTER = { lat: 36.3504, lng: 127.3845 } as const;

/** 대여소 여러 개가 한 화면에 들어오는 줌 단계 */
export const DEFAULT_ZOOM = 14;

/**
 * 경로 출발지 임시값 — 현재위치 기능(별도 이슈)이 없어 지도 초기 중심을 대신 보낸다.
 * 현재위치 이슈에서 실제 좌표로 교체한다. 화면에는 "현재 위치"로만 표시하고 이 좌표의 주소는 보여주지 않는다.
 */
export const START_POS_FALLBACK: Pos = { xPos: DAEJEON_CENTER.lng, yPos: DAEJEON_CENTER.lat };
