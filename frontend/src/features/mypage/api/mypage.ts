import { apiGet } from '@/shared/api/client';
import type { UsageStats } from '@/features/history/api/rides';

/**
 * 24 프로필 이용 통계 — 백엔드에 "이번 달" 통계가 없어(전달 목록)
 * 이동 기록과 같은 누적 통계(GET /cycle/statics)를 쓴다.
 */
export function getMyStats(): Promise<UsageStats> {
  return apiGet<UsageStats>('/cycle/statics');
}
