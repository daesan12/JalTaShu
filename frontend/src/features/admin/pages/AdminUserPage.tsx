import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { formatDate, formatDistance, formatMinutes } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/useToast';
import {
  BAN_COMMENT_MAX,
  USER_STATUS_LABEL,
  banAdminUser,
  getAdminUser,
  getAdminUserBanRecords,
  getAdminUserPaths,
  isActiveBan,
  releaseAdminUserBan,
  withUserStatus,
  type AdminUserSummary,
  type UserStatus,
} from '@/features/admin/api/adminUsers';
import {
  formatDateTime,
  formatDateTimeFull,
  formatUserCode,
  toLocalDateTimeString,
} from '@/features/admin/lib/format';
import { AdminBadge } from '@/features/admin/ui/AdminBadge';
import { AdminButton } from '@/features/admin/ui/AdminButton';
import { AdminDetailState } from '@/features/admin/ui/AdminDetailState';
import { AdminFieldLabel, AdminTextarea } from '@/features/admin/ui/AdminField';
import { AdminSelect } from '@/features/admin/ui/AdminFilters';
import { AdminModal } from '@/features/admin/ui/AdminModal';
import { ADMIN_PAGE_SIZE, AdminPagination } from '@/features/admin/ui/AdminPagination';
import { AdminStatCard } from '@/features/admin/ui/AdminStatCard';
import { AdminTable } from '@/features/admin/ui/AdminTable';
import { AdminTableStatus } from '@/features/admin/ui/AdminTableStatus';
import { AdminTabBar, AdminTabButton } from '@/features/admin/ui/AdminTabs';
import { AdminToast } from '@/features/admin/ui/AdminToast';

type DetailTab = 'rides' | 'bans';

/** 절약한 시간 = 같은 거리를 걸었을 때 예상 시간 − 실제 총 소요 시간 (도보 5km/h 기준) */
const WALK_METERS_PER_MIN = 5000 / 60;

/** 09 사용자 상세 — 기본 정보 + 이용 기록/밴 이력(09-b) 탭 + 정지(09-c)/해제(09-d) */
export function AdminUserPage() {
  const { userId: userIdParam = '' } = useParams();
  const userId = Number(userIdParam);
  const queryClient = useQueryClient();
  const { message, showToast } = useToast();

  const [tab, setTab] = useState<DetailTab>('rides');
  const [banOpen, setBanOpen] = useState(false);
  const [unbanOpen, setUnbanOpen] = useState(false);
  const [ridePage, setRidePage] = useState(1);

  // 상세(기본 정보) · 경로 기록(이용 기록 탭) · 밴 이력(밴 이력 탭)이 각각 다른 API다
  const detail = useQuery({
    queryKey: ['adminUser', userId],
    queryFn: () => getAdminUser(userId),
  });
  const paths = useQuery({
    queryKey: ['adminUserPaths', userId],
    queryFn: () => getAdminUserPaths(userId),
  });
  const bans = useQuery({
    queryKey: ['adminUserBans', userId],
    queryFn: () => getAdminUserBanRecords(userId),
  });

  // 상세 응답에 상태가 없다 — 진행 중인 제재가 있으면 정지로 본다(목록 API와 같은 판정)
  const activeBan = useMemo(() => bans.data?.find(isActiveBan) ?? null, [bans.data]);

  /**
   * 정지·해제 후 — 목록 캐시(키 `['adminUsers', statement, order]`)의 이 사용자 상태를 바로 바꿔 두고,
   * 서버 재조회는 뒤에서 그대로 한다. 무효화만 하면 목록에 돌아갔을 때 재조회가 끝날 때까지 옛 상태가 보인다
   */
  function refresh(status: UserStatus) {
    for (const [key, list] of queryClient.getQueriesData<AdminUserSummary[]>({
      queryKey: ['adminUsers'],
    })) {
      if (!list) continue;
      const filter = (key[1] ?? '') as UserStatus | '';
      queryClient.setQueryData(key, withUserStatus(list, userId, status, filter));
    }
    void queryClient.invalidateQueries({ queryKey: ['adminUserBans', userId] });
    void queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
  }

  // 해제는 사용자가 아니라 밴 기록 기준 — 진행 중인 기록의 id로 부른다
  const unban = useMutation({
    mutationFn: () => {
      if (!activeBan) return Promise.reject(new Error('해제할 밴 기록이 없습니다.'));
      return releaseAdminUserBan(activeBan.banRecordId);
    },
    onSuccess: () => {
      refresh('NORMAL');
      setUnbanOpen(false);
      showToast('이용 정지가 해제되었습니다');
    },
  });

  if (detail.isPending || detail.isError) {
    return (
      <AdminDetailState
        isError={detail.isError}
        errorText="사용자 정보를 불러오지 못했습니다."
        onRetry={() => void detail.refetch()}
      />
    );
  }

  const user = detail.data;
  const banned = activeBan !== null;
  // 가입을 끝내지 않은 사용자는 닉네임이 없다 — 화면에서는 사용자 코드로 대신 부른다
  const displayName = user.nickname ?? formatUserCode(userId);

  const rides = paths.data?.pathsList ?? [];
  const pageRides = rides.slice((ridePage - 1) * ADMIN_PAGE_SIZE, ridePage * ADMIN_PAGE_SIZE);
  // 총 소요 시간 합 — 절약한 시간 계산의 기준(경로 시간이 빠진 기록은 0으로 둔다)
  const totalPathMin = rides.reduce((sum, path) => sum + (path.totalDuration ?? 0), 0);
  const distanceM = paths.data?.totalUsingDistance ?? null;
  const savedMin =
    distanceM === null
      ? null
      : Math.max(0, Math.round(distanceM / WALK_METERS_PER_MIN) - totalPathMin);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/users" className="text-sm text-admin-muted hover:text-admin-text">
          ← 사용자 관리
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h2 className="text-xl font-semibold">{displayName}</h2>
          <AdminBadge state={USER_STATUS_LABEL[banned ? 'BANNED' : 'NORMAL']} />
          <div className="ml-auto">
            {banned ? (
              <AdminButton variant="secondary" onClick={() => setUnbanOpen(true)}>
                정지 해제
              </AdminButton>
            ) : (
              <AdminButton variant="danger" onClick={() => setBanOpen(true)}>
                이용 정지
              </AdminButton>
            )}
          </div>
        </div>
      </div>

      {/* 기본 정보 — GET /admin/user/{userId} 실측 필드 그대로 */}
      <dl className="grid grid-cols-3 gap-x-6 gap-y-5 rounded-lg bg-admin-panel px-5 py-5">
        <UserInfoField label="사용자 ID" value={formatUserCode(userId)} />
        <UserInfoField label="닉네임" value={user.nickname ?? '—'} />
        <UserInfoField label="가입일" value={user.createdAt ? formatDate(user.createdAt) : '—'} />
        <UserInfoField
          label="최종 사용일시"
          value={user.recentUsingAt ? formatDateTimeFull(user.recentUsingAt) : '—'}
        />
        <UserInfoField label="총 이용 횟수" value={`${user.totalUsingCnt ?? 0}회`} />
        <UserInfoField
          label="누적 이용 시간"
          value={user.totalUsingTime === null ? '—' : formatMinutes(user.totalUsingTime)}
        />
      </dl>

      {banned && (
        <p className="rounded-md bg-admin-danger-bg px-4 py-2.5 text-sm text-admin-danger-text">
          {formatDate(activeBan.banEndAt)}까지 이용 정지
          {activeBan.comment && <> · 사유: {activeBan.comment}</>}
        </p>
      )}

      {/* 탭 (09-b) */}
      <div>
        <AdminTabBar>
          <AdminTabButton active={tab === 'rides'} onClick={() => setTab('rides')}>
            이용 기록 <span className="tabular-nums">{rides.length}</span>
          </AdminTabButton>
          <AdminTabButton active={tab === 'bans'} onClick={() => setTab('bans')}>
            밴 이력 <span className="tabular-nums">{bans.data?.length ?? 0}</span>
          </AdminTabButton>
        </AdminTabBar>

        {tab === 'rides' ? (
          <>
            {/* 이용 통계 3카드 — 거리·경로 시간은 /path, 누적 이용 시간은 상세에서 온다 */}
            <div className="mt-4 grid grid-cols-3 gap-4">
              <AdminStatCard
                label="총 이용 거리"
                value={distanceM === null ? '–' : formatDistance(distanceM)}
              />
              <AdminStatCard
                label="총 이용 시간"
                value={user.totalUsingTime === null ? '–' : formatMinutes(user.totalUsingTime)}
              />
              <AdminStatCard
                label="절약한 시간"
                value={savedMin === null ? '–' : formatMinutes(savedMin)}
                sub="같은 거리를 걸었을 때보다"
              />
            </div>

            <div className="mt-4 rounded-lg border border-admin-line">
              <AdminTable>
                <thead>
                  <tr>
                    <th className="w-36">이용일시</th>
                    <th>출발지</th>
                    <th>도착지</th>
                    <th className="w-32">자전거 ID</th>
                    <th className="w-28 text-right">총 소요 시간</th>
                    <th className="w-32 text-right">자전거 탑승 시간</th>
                  </tr>
                </thead>
                <tbody>
                  <AdminTableStatus
                    colSpan={6}
                    isPending={paths.isPending}
                    isError={paths.isError}
                    onRetry={() => void paths.refetch()}
                    isEmpty={pageRides.length === 0}
                    emptyText="이용 기록이 없습니다"
                  />
                  {pageRides.map((ride, index) => (
                    // 경로 응답에 식별자가 없어 페이지 내 위치 + 대여 시각으로 key를 만든다
                    <tr key={`${ride.usingAt ?? 'unknown'}-${index}`}>
                      <td className="tabular-nums text-admin-muted">
                        {ride.usingAt ? formatDateTime(ride.usingAt) : '—'}
                      </td>
                      <td className="truncate">{ride.startingPoint ?? '—'}</td>
                      <td className="truncate">{ride.endPoint ?? '—'}</td>
                      <td className="tabular-nums">
                        {ride.cycleId ? (
                          <Link to={`/admin/bikes/${ride.cycleId}`} className="underline">
                            {ride.cycleId}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="text-right tabular-nums">
                        {ride.totalDuration === null ? '—' : `${ride.totalDuration}분`}
                      </td>
                      <td className="text-right tabular-nums">
                        {ride.cycleDuration === null ? '—' : `${ride.cycleDuration}분`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
              <AdminPagination
                page={ridePage}
                pageSize={ADMIN_PAGE_SIZE}
                totalCount={rides.length}
                onChange={setRidePage}
              />
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-lg border border-admin-line">
            <AdminTable>
              <thead>
                <tr>
                  <th className="w-32">정지 시작일</th>
                  <th className="w-32">정지 종료일</th>
                  <th className="w-24 text-right">정지 기간</th>
                  <th>사유</th>
                  <th className="w-32">처리 관리자</th>
                  <th className="w-24">상태</th>
                </tr>
              </thead>
              <tbody>
                <AdminTableStatus
                  colSpan={6}
                  isPending={bans.isPending}
                  isError={bans.isError}
                  onRetry={() => void bans.refetch()}
                  isEmpty={(bans.data?.length ?? 0) === 0}
                  emptyText="밴 이력이 없습니다"
                />
                {bans.data?.map((record) => (
                  <tr key={record.banRecordId}>
                    <td className="tabular-nums text-admin-muted">
                      {formatDate(record.banStartedAt)}
                    </td>
                    <td className="tabular-nums text-admin-muted">{formatDate(record.banEndAt)}</td>
                    <td className="text-right tabular-nums">{record.period}일</td>
                    <td className="truncate">{record.comment ?? '—'}</td>
                    {/* 백엔드가 관리자 이름 없이 adminId만 준다 */}
                    <td className="truncate text-admin-muted">관리자 #{record.adminId}</td>
                    <td>
                      {isActiveBan(record) ? (
                        <AdminBadge state="정지" />
                      ) : (
                        <span className="text-admin-muted">해제됨</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          </div>
        )}
      </div>

      {/* 09-c 이용 정지 — 닫으면 입력 초기화되게 열릴 때만 마운트 */}
      {banOpen && (
        <BanModal
          userId={userId}
          nickname={displayName}
          onClose={() => setBanOpen(false)}
          onBanned={() => {
            refresh('BANNED');
            setBanOpen(false);
            showToast('이용 정지가 등록되었습니다');
          }}
        />
      )}

      {/* 09-d 정지 해제 */}
      <AdminModal
        open={unbanOpen}
        onClose={() => setUnbanOpen(false)}
        title="이용 정지를 해제할까요?"
        size="md"
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setUnbanOpen(false)}>
              취소
            </AdminButton>
            <AdminButton disabled={unban.isPending || !activeBan} onClick={() => unban.mutate()}>
              {unban.isPending ? '해제 중…' : '정지 해제'}
            </AdminButton>
          </>
        }
      >
        {activeBan && (
          <dl className="mb-4 grid grid-cols-[5rem_1fr] gap-y-2 rounded-md bg-admin-panel px-4 py-3 text-sm">
            <dt className="text-admin-muted">정지 기간</dt>
            <dd className="tabular-nums">
              {formatDate(activeBan.banStartedAt)} ~ {formatDate(activeBan.banEndAt)} (
              {activeBan.period}일)
            </dd>
            <dt className="text-admin-muted">사유</dt>
            <dd>{activeBan.comment ?? '—'}</dd>
          </dl>
        )}
        <p className="text-sm">이 사용자의 이용 정지를 해제하시겠습니까?</p>
        <p className="mt-1 text-sm text-admin-muted">해제 즉시 타슈 이용이 가능해집니다.</p>
        {unban.isError && (
          <p className="mt-2 text-sm text-admin-danger-text">
            {unban.error instanceof ApiError ? unban.error.message : '해제에 실패했습니다.'}
          </p>
        )}
      </AdminModal>

      {message && <AdminToast message={message} />}
    </div>
  );
}

/** 기본 정보 한 칸 */
function UserInfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-admin-muted">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** 정지 기간 선택지 — 종료 시각(scheduledEndAt)으로 환산해 보낸다 (백엔드 @Future 필수) */
const BAN_PERIODS = [3, 7, 30] as const;

interface BanModalProps {
  userId: number;
  nickname: string;
  onClose: () => void;
  onBanned: () => void;
}

/** 09-c 이용 정지 — 기간 + 사유(100자, 백엔드 @Size 실측) */
function BanModal({ userId, nickname, onClose, onBanned }: BanModalProps) {
  const [days, setDays] = useState<number>(7);
  const [comment, setComment] = useState('');
  // 종료 시각 기준 — 미리보기와 실제 전송값이 어긋나지 않게 모달 연 시각 하나로 고정
  // (자정 근처에 모달을 열어 두어도 화면에 보인 날짜 그대로 전송된다)
  const [openedAt] = useState(() => Date.now());
  const endAt = new Date(openedAt + days * 24 * 3600_000);

  const ban = useMutation({
    mutationFn: () =>
      banAdminUser(userId, {
        // LocalDateTime이라 오프셋 없는 문자열이어야 한다
        scheduledEndAt: toLocalDateTimeString(endAt),
        comment: comment.trim(),
      }),
    onSuccess: onBanned,
  });

  return (
    <AdminModal
      open
      onClose={onClose}
      title="이용 정지"
      size="md"
      footer={
        <>
          <AdminButton variant="secondary" onClick={onClose}>
            취소
          </AdminButton>
          <AdminButton variant="danger" disabled={ban.isPending} onClick={() => ban.mutate()}>
            {ban.isPending ? '정지 중…' : '이용 정지'}
          </AdminButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-md bg-admin-panel px-4 py-3 text-sm">
          {nickname} · <span className="tabular-nums">{formatUserCode(userId)}</span>
        </p>
        <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
          <span className="text-sm font-medium">정지 기간</span>
          <div className="flex items-center gap-3">
            <AdminSelect
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-32"
              aria-label="정지 기간"
            >
              {BAN_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {period}일
                </option>
              ))}
            </AdminSelect>
            <span className="text-sm text-admin-muted tabular-nums">
              정지 종료 예정일: {formatDate(endAt.toISOString())}
            </span>
          </div>
        </div>
        <div>
          <AdminFieldLabel label="정지 사유" count={comment.length} max={BAN_COMMENT_MAX} />
          <AdminTextarea
            className="min-h-20"
            placeholder="정지 사유를 입력하세요"
            value={comment}
            maxLength={BAN_COMMENT_MAX}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        {ban.isError && (
          <p className="text-sm text-admin-danger-text">
            {ban.error instanceof ApiError
              ? ban.error.message
              : '이용 정지에 실패했습니다. 다시 시도해 주세요.'}
          </p>
        )}
      </div>
    </AdminModal>
  );
}
