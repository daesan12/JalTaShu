/**
 * 지도 위에 떠 있는 동그란 아이콘 버튼 공통 스타일 (현재위치·대여소 새로고침).
 * 두 버튼이 세로로 맞붙어 있어 지름·그림자·눌림 반응이 어긋나면 바로 눈에 띈다 — 한 곳에서 관리한다.
 */
export const MAP_ROUND_BUTTON_CLASS =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-gray-600 shadow-md transition-[scale,background-color] duration-75 active:scale-95 active:bg-gray-100 disabled:pointer-events-none disabled:opacity-60';
