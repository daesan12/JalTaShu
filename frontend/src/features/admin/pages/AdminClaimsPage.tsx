/*
 * 03 제보 관리 — 목록·상세 모달이 들어올 자리. 이슈 1 범위 밖이다.
 * 화면 이름은 "제보"지만 API 명세의 용어는 claim이다 (신고=report는 허위 제보를 신고하는 별개 기능).
 * 경로·파일·타입은 API를 따라 claim으로 쓴다.
 */
export function AdminClaimsPage() {
  return <h2 className="text-xl font-semibold">제보 관리</h2>;
}
