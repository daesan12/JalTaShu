import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { formatDate } from '@/shared/lib/format';
import { TopHeader } from '@/shared/ui/TopHeader';
import { getNotices } from '@/features/mypage/api/support';

/** 공지사항 목록 — 누르면 상세(`NoticeDetailPage`)로 */
export function NoticesPage() {
  const { data: notices, isPending, error } = useQuery({
    queryKey: ['notices'],
    queryFn: getNotices,
  });

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="공지사항" />

      <div className="flex-1 overflow-y-auto px-5 pt-2 pb-6">
        {isPending && <p className="text-sm text-gray-400">불러오는 중…</p>}
        {error && <p className="text-sm text-status-low">에러: {error.message}</p>}

        {notices && (
          <ul className="space-y-3">
            {notices.map((notice) => (
              <li key={notice.noticeId}>
                <Link
                  to={`/mypage/support/notices/${notice.noticeId}`}
                  className="block rounded-2xl border border-gray-200 bg-surface p-4 active:bg-gray-50"
                >
                  <p className="truncate font-medium text-gray-900">{notice.title}</p>
                  <p className="tabular-nums mt-1.5 text-sm text-gray-400">
                    {formatDate(notice.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
