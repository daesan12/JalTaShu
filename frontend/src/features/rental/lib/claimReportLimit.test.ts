import { describe, expect, it } from 'vitest';
import {
  DAILY_REPORT_LIMIT,
  addClaim,
  isExhausted,
  rollOver,
  toDateKey,
  type ReportLog,
} from '@/features/rental/lib/claimReportLimit';

describe('허위 제보 신고 일일 가드', () => {
  it('날짜 키는 UTC가 아니라 기기 시간대 자정을 기준으로 끊는다', () => {
    // 한국이면 같은 날 아침이지만 UTC로는 전날인 시각
    const earlyMorning = new Date(2026, 8, 18, 1, 30);
    expect(toDateKey(earlyMorning)).toBe('2026-09-18');
  });

  it('날짜가 바뀌면 기록을 비운다', () => {
    const yesterday: ReportLog = { date: '2026-09-17', claimIds: [1, 2, 3] };
    expect(rollOver(yesterday, '2026-09-18')).toEqual({ date: '2026-09-18', claimIds: [] });
  });

  it('같은 날이면 기록을 그대로 둔다', () => {
    const today: ReportLog = { date: '2026-09-18', claimIds: [7] };
    expect(rollOver(today, '2026-09-18')).toBe(today);
  });

  it('기록이 없으면 빈 기록을 만든다', () => {
    expect(rollOver(null, '2026-09-18')).toEqual({ date: '2026-09-18', claimIds: [] });
  });

  it('같은 제보를 두 번 신고해도 한 번만 센다', () => {
    const log: ReportLog = { date: '2026-09-18', claimIds: [7] };
    expect(addClaim(log, 7).claimIds).toEqual([7]);
    expect(addClaim(log, 8).claimIds).toEqual([7, 8]);
  });

  it('하루 한도에 도달하면 소진으로 본다', () => {
    const ids = Array.from({ length: DAILY_REPORT_LIMIT }, (_, i) => i + 1);
    expect(isExhausted({ date: '2026-09-18', claimIds: ids })).toBe(true);
    expect(isExhausted({ date: '2026-09-18', claimIds: ids.slice(1) })).toBe(false);
  });
});
