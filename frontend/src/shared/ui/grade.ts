/**
 * 경사도 4단계 색·라벨 단일 정의 — 경로 그림·고도 그래프·범례·구간 안내가 공유.
 * 색은 dataviz 검증기(CVD 분리·명도 밴드) 통과 값 — 임의 변경 금지, 바꾸면 재검증할 것.
 *
 * 원래 `features/history/lib/grade.ts`였고 11 경로 상세도 쓰게 되어 `shared/`로 올렸다(경호님 승인, #32).
 */
export type GradeClass = 'flat' | 'gentle' | 'climb' | 'steep';

export const GRADE_ORDER: GradeClass[] = ['flat', 'gentle', 'climb', 'steep'];

export const GRADE_META: Record<GradeClass, { label: string; color: string }> = {
  flat: { label: '평지·내리막', color: '#0891b2' },
  gentle: { label: '완만', color: '#3d7410' },
  climb: { label: '오르막', color: '#ea8c00' },
  steep: { label: '가파름', color: '#991b1b' },
};

/** 도보 구간 색 (경로 그림에서는 점선으로도 구분) */
export const WALK_COLOR = '#2563eb';
