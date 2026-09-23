import { useQuery } from '@tanstack/react-query';
import {
  getNotifications,
  NOTIFICATIONS_QUERY_KEY,
  type NotificationType,
} from '@/features/notification/api/notifications';
import { formatDate } from '@/shared/lib/format';
import { TopHeader } from '@/shared/ui/TopHeader';

function NotificationIcon({ type }: { type: NotificationType }) {
  if (type === 'RETURN_COMPLETED') {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
          <path d="m6.5 12.5 3.4 3.4 7.6-8" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
        <circle cx="7" cy="17" r="3" fill="none" stroke="currentColor" strokeWidth={1.8} />
        <circle cx="17" cy="17" r="3" fill="none" stroke="currentColor" strokeWidth={1.8} />
        <path d="m7 17 3.2-7h3.1l3.7 7M9 12h6.2M11.5 7.5h2" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function formatNotificationTime(createdAt: string): string {
  const date = new Date(createdAt);
  const hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, '0');
  const period = hour < 12 ? '오전' : '오후';
  return `${formatDate(createdAt)} ${period} ${hour % 12 || 12}:${minute}`;
}

export function NotificationsPage() {
  const notifications = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: getNotifications,
  });

  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopHeader title="알림" />
      <div className="flex-1 overflow-y-auto px-5 pt-2 pb-8">
        <p className="mb-5 text-sm text-muted">대여와 반납 소식을 한곳에서 확인하세요.</p>

        {notifications.isPending && (
          <div className="space-y-3" aria-label="알림 불러오는 중">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-[22px] bg-surface-soft motion-reduce:animate-none" />
            ))}
          </div>
        )}

        {notifications.isError && (
          <div className="rounded-[22px] border border-status-low/20 bg-red-50 p-5 text-center">
            <p className="text-sm text-status-low">알림을 불러오지 못했어요.</p>
            <button type="button" onClick={() => void notifications.refetch()} className="mt-3 min-h-10 rounded-xl bg-surface px-4 text-sm font-semibold text-ink shadow-sm active:bg-surface-soft">
              다시 시도
            </button>
          </div>
        )}

        {notifications.data?.length === 0 && (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-[28px] border border-dashed border-line bg-surface px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
                <path d="M18 9a6 6 0 0 0-12 0c0 6.5-2.75 6.75-2.75 8.25h17.5C20.75 15.75 18 15.5 18 9ZM9.75 20h4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="mt-4 font-bold text-ink">아직 받은 알림이 없어요</p>
            <p className="mt-1.5 text-sm leading-5 text-muted">자전거를 대여하거나 반납하면 여기에 알려드릴게요.</p>
          </div>
        )}

        {notifications.data && notifications.data.length > 0 && (
          <ul className="space-y-3">
            {notifications.data.map((notification) => (
              <li key={notification.notificationId} className="flex gap-3.5 rounded-[22px] border border-line/80 bg-surface p-4 shadow-[0_8px_24px_rgba(42,60,34,0.06)]">
                <NotificationIcon type={notification.type} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="font-bold text-ink">{notification.title}</p>
                  <p className="mt-1 text-sm leading-5 text-gray-600">{notification.body}</p>
                  <time dateTime={notification.createdAt} className="tabular-nums mt-2 block text-xs text-muted">
                    {formatNotificationTime(notification.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
