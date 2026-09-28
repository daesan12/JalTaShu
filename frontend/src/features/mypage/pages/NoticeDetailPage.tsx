import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { formatDate } from '@/shared/lib/format';
import { TopHeader } from '@/shared/ui/TopHeader';
import { getNotice } from '@/features/mypage/api/support';

export function NoticeDetailPage() {
  const { noticeId } = useParams();
  const id = Number(noticeId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const { data: notice, isPending, error } = useQuery({
    queryKey: ['notice', id],
    queryFn: () => getNotice(id),
    enabled: validId,
  });

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="공지사항" />
      <div className="flex-1 overflow-y-auto px-5 pt-2 pb-6">
        {!validId && <p className="text-sm text-status-low">잘못된 공지사항 주소입니다.</p>}
        {validId && isPending && <p className="text-sm text-gray-400">불러오는 중…</p>}
        {error && <p className="text-sm text-status-low">공지사항을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
        {notice && (
          <article className="rounded-2xl border border-gray-200 bg-surface p-4">
            <h1 className="break-words text-lg font-bold text-gray-900">{notice.title}</h1>
            <p className="mt-1.5 text-sm text-gray-400">
              {notice.author} · {formatDate(notice.createdAt)}
            </p>
            <div className="mt-5 border-t border-gray-200 pt-5 text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-900">
              {notice.content}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
