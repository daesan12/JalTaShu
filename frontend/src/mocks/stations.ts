import type { Station } from '@/shared/api/types';

/**
 * 대전 실제 좌표 기반 목업 대여소 (07-1 팝업 와이어프레임 데이터 반영).
 * 지도·대여/반납·관리자(히트맵·자전거·사용자)가 전부 같은 목록을 봐야 해서 따로 둔다.
 */
export const STATIONS: Station[] = [
  { stationId: 'ST0001', name: '유성구청역 대여소', lat: 36.362, lng: 127.3565, currentBikes: 7 },
  {
    stationId: 'ST0002',
    name: '월드컵경기장역 대여소',
    lat: 36.3664,
    lng: 127.3216,
    currentBikes: 3,
  },
  { stationId: 'ST0003', name: '시청역 대여소', lat: 36.3505, lng: 127.3848, currentBikes: 1 },
  { stationId: 'ST0004', name: '대전역 대여소', lat: 36.3315, lng: 127.4346, currentBikes: 5 },
  { stationId: 'ST0005', name: '충남대학교 정문', lat: 36.3623, lng: 127.3442, currentBikes: 0 },
  { stationId: 'ST0006', name: '갑천네이처브리지', lat: 36.3688, lng: 127.3893, currentBikes: 8 },
  { stationId: 'ST0007', name: '카이스트 본원', lat: 36.3722, lng: 127.3604, currentBikes: 2 },
  { stationId: 'ST0008', name: '한밭수목원', lat: 36.3667, lng: 127.3887, currentBikes: 11 },
];
