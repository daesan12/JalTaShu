import { describe, expect, it } from 'vitest';
import { withUserStatus, type AdminUserSummary } from '@/features/admin/api/adminUsers';

const users: AdminUserSummary[] = [
  { userId: 1, nickname: '가', recentUsingAt: null, userStatement: 'NORMAL' },
  { userId: 2, nickname: '나', recentUsingAt: null, userStatement: 'NORMAL' },
];

describe('withUserStatus — 정지·해제를 캐시된 목록에 바로 반영', () => {
  it('전체 목록에서는 그 사용자 상태만 바꾸고 순서는 그대로 둔다', () => {
    const next = withUserStatus(users, 2, 'BANNED', '');
    expect(next.map((u) => u.userStatement)).toEqual(['NORMAL', 'BANNED']);
    expect(users[1].userStatement).toBe('NORMAL');
  });

  it('상태 필터와 맞지 않게 된 사용자는 그 목록에서 뺀다', () => {
    expect(withUserStatus(users, 2, 'BANNED', 'NORMAL').map((u) => u.userId)).toEqual([1]);
    expect(withUserStatus(users, 2, 'BANNED', 'BANNED').map((u) => u.userId)).toEqual([1, 2]);
  });
});
