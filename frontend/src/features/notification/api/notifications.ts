import { apiGet } from '@/shared/api/client';

export type NotificationType = 'RENTAL_STARTED' | 'RETURN_COMPLETED';

export interface UserNotification {
  notificationId: number;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
}

export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const;

export function getNotifications(): Promise<UserNotification[]> {
  return apiGet<UserNotification[]>('/notifications');
}
