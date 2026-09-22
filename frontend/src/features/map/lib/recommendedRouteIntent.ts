/** 추천 코스 화면에서 지도 탭으로 넘기는 일회성 고정 코스 요청 */
export interface RecommendedRouteIntent {
  courseId: string;
}

export interface RecommendedRouteLocationState {
  recommendedRoute?: RecommendedRouteIntent;
}

/** 브라우저 history.state는 외부 입력이므로 지도 상태로 쓰기 전에 모양을 확인한다. */
export function readRecommendedRouteIntent(state: unknown): RecommendedRouteIntent | null {
  if (typeof state !== 'object' || state === null) return null;
  const intent = (state as RecommendedRouteLocationState).recommendedRoute;
  if (
    intent === undefined ||
    typeof intent.courseId !== 'string' ||
    !/^[a-z0-9-]+$/.test(intent.courseId)
  ) {
    return null;
  }
  return intent;
}
