/**
 * CSS 커스텀 프로퍼티(디자인 토큰) 값을 문자열로 읽는다.
 * 네이버 Polyline처럼 Tailwind 클래스를 받지 못하고 색 문자열만 받는 곳에서 쓴다.
 * Tailwind 4는 소스에서 쓰이는 변수만 CSS로 내보내므로, 여기서 읽는 토큰은
 * 어딘가의 클래스 문자열(예: `bg-route-fast`)이 사용처 역할을 해 줘야 값이 나온다.
 */
export function readCssToken(cssVar: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
}
