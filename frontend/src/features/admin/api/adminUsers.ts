import { apiGet, apiPost } from '@/shared/api/client';

/**
 * 04·09 사용자 관리.
 * 구현 O(백엔드 실측): 목록(statement·order 서버 필터), 밴({scheduledEndAt, comment}), 해제.
 * 구현 X(목업 기준): 상세, 밴 이력 조회. 목록의 nickname도 백엔드에 추가 요청 상태.
 * 401은 관리자 가드가 처리(skipAuthRedirect).
 */

/** 서버 enum (AdminUserService.normalizeStatement 실측) */
export type UserStatus = 'NORMAL' | 'BANNED';

export const USER_STATUS_LABEL: Record<UserStatus, '정상' | '정지'> = {
  NORMAL: '정상',
  BANNED: '정지',
};

/** 밴 사유 최대 길이 — 백엔드 UserBanRequest @Size(max = 100) 실측 */
export const BAN_COMMENT_MAX = 100;

export interface AdminUserSummary {
  userId: number;
  /** ⚠ 실제 목록 응답에는 아직 없음 — 백엔드에 추가 요청 (목업은 포함) */
  nickname: string;
  recentUsingAt: string;
  userStatement: UserStatus;
}

/** 진행 중인 제재 (상세 화면용) */
export interface ActiveBan {
  scheduledEndAt: string;
  comment: string | null;
}

export interface AdminUserRide {
  rideId: number;
  startAt: string;
  endAt: string;
  fromStation: string;
  toStation: string;
  durationMin: number;
  distanceKm: number;
}

/** GET /admin/user/{userId} — 백엔드 미구현(컨트롤러 TODO), 목업 기준 임시 스키마 */
export interface AdminUserDetail {
  userId: number;
  nickname: string;
  joinedAt: string;
  userStatement: UserStatus;
  activeBan: ActiveBan | null;
  totalRides: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  rides: AdminUserRide[];
}

/** user_ban_records 한 줄 (조회 API는 백엔드 미구현 — 테이블 컬럼 실측 기준) */
export interface BanRecord {
  banId: number;
  startedAt: string;
  scheduledEndAt: string;
  /** null이면 아직 해제되지 않음 */
  releasedAt: string | null;
  comment: string | null;
  adminName: string;
}

/** statement·order는 백엔드가 실제로 받는 파라미터 — 그대로 넘긴다 */
export function getAdminUsers(params: {
  statement?: UserStatus | '';
  order?: 'newest' | 'oldest';
}): Promise<AdminUserSummary[]> {
  const query = new URLSearchParams();
  if (params.statement) query.set('statement', params.statement);
  if (params.order) query.set('order', params.order);
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return apiGet<AdminUserSummary[]>(`/admin/user/list${suffix}`, { skipAuthRedirect: true });
}

export function getAdminUser(userId: number): Promise<AdminUserDetail> {
  return apiGet<AdminUserDetail>(`/admin/user/${userId}`, { skipAuthRedirect: true });
}

export function getAdminUserBanRecords(userId: number): Promise<BanRecord[]> {
  return apiGet<BanRecord[]>(`/admin/user/${userId}/ban-records`, { skipAuthRedirect: true });
}

/** POST /admin/user/{userId}/ban — 백엔드 UserBanRequest 실측 스키마 */
export function banAdminUser(
  userId: number,
  input: { scheduledEndAt: string; comment: string },
): Promise<null> {
  return apiPost<null>(`/admin/user/${userId}/ban`, input, { skipAuthRedirect: true });
}

export function unbanAdminUser(userId: number): Promise<null> {
  return apiPost<null>(`/admin/user/${userId}/un-ban`, undefined, { skipAuthRedirect: true });
}
