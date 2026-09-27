import { apiGet, apiPost } from '@/shared/api/client';

/**
 * 04·09 사용자 관리 — 백엔드 실구현(AdminController/AdminUserService) 스키마.
 * 목록·상세·경로 기록·밴 이력·밴·해제 모두 구현 O.
 * 401은 관리자 가드가 처리(skipAuthRedirect).
 *
 * 시각은 전부 백엔드 LocalDateTime — "2026-09-01T14:32:00"처럼 오프셋이 없다.
 * 브라우저가 로컬(KST)로 파싱하므로 그대로 Date에 넣어 쓴다.
 */

/** 서버 enum (AdminUserService.normalizeStatement 실측) */
export type UserStatus = 'NORMAL' | 'BANNED';

export const USER_STATUS_LABEL: Record<UserStatus, '정상' | '정지'> = {
  NORMAL: '정상',
  BANNED: '정지',
};

/** 밴 사유 최대 길이 — 백엔드 UserBanRequest @Size(max = 100) 실측 */
export const BAN_COMMENT_MAX = 100;

/** 목록 한 명 (AdminUserListResponse 실측) */
export interface AdminUserSummary {
  userId: number;
  /** 소셜 로그인만 하고 가입을 끝내지 않은 사용자는 null (UserService가 nickname(null)로 만든다) */
  nickname: string | null;
  /** 대여 이력이 없으면 null */
  recentUsingAt: string | null;
  userStatement: UserStatus;
}

/**
 * GET /admin/user/{userId} (AdminUserDetailResponse 실측).
 * userId·상태는 응답에 없다 — userId는 URL 파라미터, 상태는 밴 이력에서 판정한다.
 */
export interface AdminUserDetail {
  /** 가입 미완료 사용자는 null */
  nickname: string | null;
  /** 가입일 — UserEntity.created_at에 not null 제약이 없어 옛 행은 null일 수 있다 */
  createdAt: string | null;
  /** 최종 사용일시(최근 대여 시각) — 이용 이력이 없으면 null */
  recentUsingAt: string | null;
  /** 총 이용 횟수 */
  totalUsingCnt: number | null;
  /** 누적 이용 시간(분) — 이용 이력이 없으면 null */
  totalUsingTime: number | null;
}

/** 경로 기록 한 건 (AdminUserPathHistoryResponse.PathInfo 실측) */
export interface AdminUserPath {
  /** 이용일시 = 자전거 대여 시각 */
  usingAt: string | null;
  /** 대여소 이름 */
  startingPoint: string | null;
  /** 반납소 이름 */
  endPoint: string | null;
  cycleId: string | null;
  /** 총 소요 시간(분) — 경로 생성~종료 */
  totalDuration: number | null;
  /** 자전거 탑승 시간(분) — 대여~반납 */
  cycleDuration: number | null;
}

/** GET /admin/user/{userId}/path — 거리 미수집 기록이 섞이면 총거리는 null(미확정) */
export interface AdminUserPathHistory {
  /** 총 이용 거리(m) */
  totalUsingDistance: number | null;
  pathsList: AdminUserPath[];
}

/** 밴 기록 한 건 (AdminUserBanHistoryResponse 실측) */
export interface AdminUserBanRecord {
  banRecordId: number;
  banStartedAt: string;
  /** 조기 해제됐으면 해제 시각, 아니면 예정 종료 시각 */
  banEndAt: string;
  /** 제재 기간(일) — 시작~예정 종료 */
  period: number;
  comment: string | null;
  adminId: number;
}

/**
 * 진행 중인 제재 판정 — 종료 시각이 미래인 기록.
 * 조기 해제된 기록은 banEndAt이 해제 시각(과거)으로 내려오므로 자연히 걸러진다.
 */
export function isActiveBan(record: AdminUserBanRecord): boolean {
  return new Date(record.banEndAt).getTime() > Date.now();
}

/**
 * 정지·해제 직후 캐시된 목록에 바로 반영한다(#151) — 1.45만 명 목록 재조회가 끝날 때까지
 * 옛 상태가 보이지 않게. filter는 그 목록을 불러온 상태 필터('' = 전체)로, 새 상태와 맞지 않으면 뺀다
 */
export function withUserStatus(
  list: AdminUserSummary[],
  userId: number,
  status: UserStatus,
  filter: UserStatus | '',
): AdminUserSummary[] {
  return list
    .map((user) => (user.userId === userId ? { ...user, userStatement: status } : user))
    .filter((user) => user.userId !== userId || filter === '' || filter === status);
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

/** GET /admin/user/{userId}/path — 이용 기록 탭(총 이용 거리 + 경로 목록) */
export function getAdminUserPaths(userId: number): Promise<AdminUserPathHistory> {
  return apiGet<AdminUserPathHistory>(`/admin/user/${userId}/path`, { skipAuthRedirect: true });
}

/** GET /admin/user/{userId}/ban — 전체 이력을 최신순으로. 기록이 없으면 빈 배열 */
export function getAdminUserBanRecords(userId: number): Promise<AdminUserBanRecord[]> {
  return apiGet<AdminUserBanRecord[]>(`/admin/user/${userId}/ban`, { skipAuthRedirect: true });
}

/**
 * POST /admin/user/{userId}/ban — 백엔드 UserBanRequest 실측 스키마.
 * scheduledEndAt은 LocalDateTime이라 오프셋 없는 문자열이어야 한다(toISOString 금지 — 파싱 실패).
 */
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
