/**
 * 지도 위 물방울 핀 — 출발(파랑)·목적지(검정)가 색만 다르고 모양이 같다.
 * 네이버 마커 `content`는 DOM 문자열만 받으므로 컴포넌트가 아니라 문자열을 만든다.
 */

/** 시안의 핀 크기(px). anchor는 핀 끝(아래 중앙)으로 잡는다 */
export const PIN_WIDTH = 42;
export const PIN_HEIGHT = 52;

/** 지도 글자와 겹쳐도 읽히도록 흰 테두리와 흰 중심점을 둔다 */
export function pinSvg(fill: string): string {
  return `<svg viewBox="0 0 42 52" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" aria-hidden="true" style="filter:drop-shadow(0 2px 3px rgb(0 0 0 / 0.28))"><path d="M21 51S4 35.2 4 20.5C4 11.4 11.6 4 21 4s17 7.4 17 16.5C38 35.2 21 51 21 51Z" fill="${fill}" stroke="#fff" stroke-width="2.5"/><circle cx="21" cy="20" r="5" fill="#fff"/></svg>`;
}

/** 출발 핀 색 */
export const START_PIN_FILL = '#2563EB';
/** 목적지 핀 색 */
export const DESTINATION_PIN_FILL = '#18181B';
