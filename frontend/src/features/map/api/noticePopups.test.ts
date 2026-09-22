import { describe, expect, it } from 'vitest';
import {
  BUNDLED_NOTICE_POPUPS,
  resolveNoticePopups,
  type PopupNotice,
} from '@/features/map/api/noticePopups';

describe('resolveNoticePopups', () => {
  it('서버 팝업이 없으면 앱에 포함된 기본 5장을 사용한다', () => {
    const notices = resolveNoticePopups([]);

    expect(notices).toHaveLength(5);
    expect(notices).toBe(BUNDLED_NOTICE_POPUPS);
    expect(notices[0]?.photoUrl).toContain('notices/notice-01-temporary-closure.jpg');
  });

  it('서버 팝업이 있으면 서버 목록을 우선한다', () => {
    const serverNotices: PopupNotice[] = [
      { title: '서버 공지', photoUrl: 'https://example.com/notice.jpg', noticeId: 99 },
    ];

    expect(resolveNoticePopups(serverNotices)).toBe(serverNotices);
  });
});
