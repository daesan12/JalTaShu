import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '@/shared/api/client';
import {
  BUNDLED_NOTICE_POPUPS,
  getNoticePopups,
  type PopupNotice,
} from '@/features/map/api/noticePopups';

vi.mock('@/shared/api/client', () => ({ apiGet: vi.fn() }));

const mockedApiGet = vi.mocked(apiGet);

describe('getNoticePopups', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
  });

  it('서버 팝업이 있으면 서버 목록을 그대로 쓴다', async () => {
    const serverNotices: PopupNotice[] = [
      { title: '서버 공지', photoUrl: 'https://example.com/notice.jpg', noticeId: 99 },
    ];
    mockedApiGet.mockResolvedValue(serverNotices);

    await expect(getNoticePopups()).resolves.toBe(serverNotices);
  });

  it('서버 팝업이 비어 있으면(핀이 모두 꺼짐) 기본 5장으로 채우지 않는다', async () => {
    mockedApiGet.mockResolvedValue([]);

    await expect(getNoticePopups()).resolves.toEqual([]);
  });

  it('API가 실패하면 앱에 포함된 기본 5장을 쓴다', async () => {
    mockedApiGet.mockRejectedValue(new Error('network'));

    const notices = await getNoticePopups();

    expect(notices).toBe(BUNDLED_NOTICE_POPUPS);
    expect(notices[0]?.photoUrl).toContain('notices/notice-01-temporary-closure.jpg');
  });
});
