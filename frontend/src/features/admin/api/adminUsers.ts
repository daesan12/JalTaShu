import { apiGet, apiPost } from '@/shared/api/client';

/**
 * 04·09 사용자 관리 — 백엔드 실구현(AdminController) 스키마.
 * 구현 O: 목록(statement·order 서버 필터), 밴, 최신 밴 기록 조회, 밴 해제(banRecordId).
 * 구현 X(목업 기준 유지): 사용자 상세(컨트롤러 TODO — 전달 목록).
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

/** 목록 한 명 (AdminUserListResponse 실측) — 닉네임은 응답에 없다(전달 목록) */
export interface AdminUserSummary {
  userId: number;
  recentUsingAt: string | null;
  userStatement: UserStatus;
}

/** 진행 중인 제재 (상세 화면용 — 상세 API가 목업이라 임시 스키마) */
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

/** 최신 밴 기록 한 건 (AdminUserBanHistoryResponse 실측 — 리스트가 아니라 최신 1건만 온다) */
export interface AdminUserBanRecord {
  banRecordId: number;
  banStartedAt: string;
  /** 조기 해제됐으면 해제 시각, 아니면 예정 종료 시각 */
  banEndAt: string;
  /** 제재 기간(일) */
  period: number;
  comment: string | null;
  adminId: number;
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

/** GET /admin/user/{userId}/ban — 기록이 하나도 없으면 404(호출부가 "이력 없음"으로 처리) */
export function getAdminUserBanRecord(userId: number): Promise<AdminUserBanRecord> {
  return apiGet<AdminUserBanRecord>(`/admin/user/${userId}/ban`, { skipAuthRedirect: true });
}

/** POST /admin/user/{userId}/ban — 백엔드 UserBanRequest 실측 스키마 */
export function banAdminUser(
  userId: number,
  input: { scheduledEndAt: string; comment: string },
): Promise<null> {
  return apiPost<null>(`/admin/user/${userId}/ban`, input, { skipAuthRedirect: true });
}

/** POST /admin/user/ban/{banRecordId}/release — 해제는 사용자가 아니라 **밴 기록** 기준이다 */
export function releaseAdminUserBan(banRecordId: number): Promise<null> {
  return apiPost<null>(`/admin/user/ban/${banRecordId}/release`, undefined, {
    skipAuthRedirect: true,
  });
}
