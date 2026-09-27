/**
 * 안드로이드 뒤로가기를 "화면 위에 뜬 것 닫기"로 쓰기 위한 등록부.
 *
 * URL 파라미터로 여는 시트(비교·상세·검색)는 히스토리 뒤로가기로 닫히지만, **React state로만
 * 여는 시트**(대여소 시트·반납 입력·대여소 확인·정지 안내)는 히스토리가 없어서 뒤로가기가
 * 곧장 "앱 종료"로 갔다(실기기 확인). 그런 시트는 여기에 닫는 함수를 등록해 두고,
 * 뒤로가기 브리지가 종료보다 먼저 이걸 부른다.
 *
 * 나중에 등록한 것부터 부른다 — 위에 겹쳐 뜬 시트가 먼저 닫혀야 한다.
 * 라우터 밖의 순수 모듈이라 브리지와 화면이 서로를 몰라도 된다.
 */
type BackHandler = () => void;

const handlers: BackHandler[] = [];

/** 등록하고, 해제 함수를 돌려준다 */
export function registerBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index !== -1) handlers.splice(index, 1);
  };
}

/** 가장 최근 것 하나를 실행한다. 등록된 게 없으면 false — 그때 브리지가 원래 동작을 한다 */
export function runBackHandler(): boolean {
  const handler = handlers[handlers.length - 1];
  if (handler === undefined) return false;
  handler();
  return true;
}
