import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { formatDate, formatMinutes } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/useToast';
import {
  BAN_COMMENT_MAX,
  USER_STATUS_LABEL,
  banAdminUser,
  getAdminUser,
  getAdminUserBanRecord,
  releaseAdminUserBan,
  type AdminUserDetail,
} from '@/features/admin/api/adminUsers';
import { formatDateTime } from '@/features/admin/lib/format';
import { AdminBadge } from '@/features/admin/ui/AdminBadge';
import { AdminButton } from '@/features/admin/ui/AdminButton';
import { AdminDetailState } from '@/features/admin/ui/AdminDetailState';
import { AdminFieldLabel, AdminTextarea } from '@/features/admin/ui/AdminField';
import { AdminSelect } from '@/features/admin/ui/AdminFilters';
import { AdminModal } from '@/features/admin/ui/AdminModal';
import { AdminStatCard } from '@/features/admin/ui/AdminStatCard';
import { AdminTable } from '@/features/admin/ui/AdminTable';
import { AdminTableStatus } from '@/features/admin/ui/AdminTableStatus';
import { AdminTabBar, AdminTabButton } from '@/features/admin/ui/AdminTabs';
import { AdminToast } from '@/features/admin/ui/AdminToast';

type DetailTab = 'rides' | 'bans';

/** 09 사용자 상세 — 기본 정보·통계 + 이용 기록/밴 이력(09-b) 탭 + 정지(09-c)/해제(09-d) */
export function AdminUserPage() {
  const { userId: userIdParam = '' } = useParams();
  const userId = Number(userIdParam);
  const queryClient = useQueryClient();
  const { message, showToast } = useToast();

  const [tab, setTab] = useState<DetailTab>('rides');
  const [banOpen, setBanOpen] = useState(false);
  const [unbanOpen, setUnbanOpen] = useState(false);

  const detail = useQuery({
    queryKey: ['adminUser', userId],
    queryFn: () => getAdminUser(userId),
  });
  // 백엔드는 밴 이력 리스트가 아니라 **최신 1건**만 준다. 기록이 아예 없으면 404 → null
  const banRecord = useQuery({
    queryKey: ['adminUserBan', userId],
    queryFn: async () => {
      try {
        return await getAdminUserBanRecord(userId);
      } catch (err) {
        if (err instanceof ApiError && err.code === 404) return null;
        throw err;
      }
    },
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['adminUser', userId] });
    void queryClient.invalidateQueries({ queryKey: ['adminUserBan', userId] });
    void queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
  }

  // 해제는 사용자가 아니라 밴 기록 기준 — 최신 기록의 id로 부른다
  const latestBanId = banRecord.data?.banRecordId ?? null;
  const unban = useMutation({
    mutationFn: () => {
      if (latestBanId === null) return Promise.reject(new Error('해제할 밴 기록이 없습니다.'));
      return releaseAdminUserBan(latestBanId);
    },
    onSuccess: () => {
      refresh();
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
  const banned = user.userStatement === 'BANNED';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/users" className="text-sm text-admin-muted hover:text-admin-text">
          ← 사용자 관리
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h2 className="text-xl font-semibold">{user.nickname}</h2>
          <AdminBadge state={USER_STATUS_LABEL[user.userStatement]} />
          <span className="text-sm text-admin-muted">
            사용자 #{user.userId} · 가입 {formatDate(user.joinedAt)}
          </span>
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
        {banned && user.activeBan && (
          <p className="mt-2 rounded-md bg-admin-danger-bg px-4 py-2.5 text-sm text-admin-danger-text">
            {formatDate(user.activeBan.scheduledEndAt)}까지 고장신고 이용 정지
            {user.activeBan.comment && <> · 사유: {user.activeBan.comment}</>}
          </p>
        )}
      </div>

      {/* 이용 통계 3카드 */}
      <div className="grid grid-cols-3 gap-4">
        <AdminStatCard label="누적 이용" value={`${user.totalRides}회`} />
        <AdminStatCard label="누적 거리" value={`${user.totalDistanceKm.toLocaleString()}km`} />
        <AdminStatCard label="누적 이용 시간" value={formatMinutes(user.totalDurationMin)} />
      </div>

      {/* 탭 (09-b) */}
      <div>
        <AdminTabBar>
          <AdminTabButton active={tab === 'rides'} onClick={() => setTab('rides')}>
            이용 기록 <span className="tabular-nums">{user.rides.length}</span>
          </AdminTabButton>
          <AdminTabButton active={tab === 'bans'} onClick={() => setTab('bans')}>
            밴 기록 <span className="tabular-nums">{banRecord.data ? 1 : 0}</span>
          </AdminTabButton>
        </AdminTabBar>

        <div className="mt-4 rounded-lg border border-admin-line">
          {tab === 'rides' ? (
            <AdminTable>
              <thead>
                <tr>
                  <th className="w-36">대여</th>
                  <th className="w-36">반납</th>
                  <th>구간</th>
                  <th className="w-28 text-right">이용 시간</th>
                  <th className="w-24 text-right">거리</th>
                </tr>
              </thead>
              <tbody>
                {user.rides.map((ride) => (
                  <tr key={ride.rideId}>
                    <td className="tabular-nums text-admin-muted">{formatDateTime(ride.startAt)}</td>
                    <td className="tabular-nums text-admin-muted">{formatDateTime(ride.endAt)}</td>
                    <td className="truncate">
                      {ride.fromStation} → {ride.toStation}
                    </td>
                    <td className="text-right tabular-nums">{ride.durationMin}분</td>
                    <td className="text-right tabular-nums">{ride.distanceKm}km</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          ) : (
            /* 백엔드가 최신 밴 기록 1건만 준다 — 전체 이력 조회는 전달 목록 */
            <AdminTable>
              <thead>
                <tr>
                  <th className="w-32">정지 시작</th>
                  <th className="w-32">종료</th>
                  <th className="w-24 text-right">기간</th>
                  <th>사유</th>
                  <th className="w-28">처리자</th>
                </tr>
              </thead>
              <tbody>
                <AdminTableStatus
                  colSpan={5}
                  isPending={banRecord.isPending}
                  isEmpty={banRecord.data === null}
                  emptyText="밴 기록이 없습니다"
                />
                {banRecord.data && (
                  <tr>
                    <td className="tabular-nums text-admin-muted">
                      {formatDate(banRecord.data.banStartedAt)}
                    </td>
                    <td className="tabular-nums text-admin-muted">
                      {formatDate(banRecord.data.banEndAt)}
                    </td>
                    <td className="text-right tabular-nums">{banRecord.data.period}일</td>
                    <td className="truncate">{banRecord.data.comment ?? '—'}</td>
                    <td className="truncate text-admin-muted">
                      관리자 #{banRecord.data.adminId}
                    </td>
                  </tr>
                )}
              </tbody>
            </AdminTable>
          )}
        </div>
      </div>

      {/* 09-c 이용 정지 — 닫으면 입력 초기화되게 열릴 때만 마운트 */}
      {banOpen && (
        <BanModal
          user={user}
          onClose={() => setBanOpen(false)}
          onBanned={() => {
            refresh();
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
            <AdminButton
              disabled={unban.isPending || latestBanId === null}
              onClick={() => unban.mutate()}
            >
              {unban.isPending ? '해제 중…' : '해제'}
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-admin-muted">
          {user.nickname} 님의 고장신고 이용 제한을 지금 해제합니다. 해제 기록은 밴 이력에
          남습니다.
        </p>
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

/** 정지 기간 선택지 — 종료 시각(scheduledEndAt)으로 환산해 보낸다 (백엔드 @Future 필수) */
const BAN_PERIODS = [
  { days: 7, label: '7일' },
  { days: 30, label: '30일' },
  { days: 90, label: '90일' },
] as const;

interface BanModalProps {
  user: AdminUserDetail;
  onClose: () => void;
  onBanned: () => void;
}

/** 09-c 이용 정지 — 기간 + 사유(100자, 백엔드 @Size 실측) */
function BanModal({ user, onClose, onBanned }: BanModalProps) {
  const [days, setDays] = useState<number>(7);
  const [comment, setComment] = useState('');
  // 종료 시각 기준 — 미리보기와 실제 전송값이 어긋나지 않게 모달 연 시각 하나로 고정
  // (자정 근처에 모달을 열어 두어도 화면에 보인 날짜 그대로 전송된다)
  const [openedAt] = useState(() => Date.now());

  const ban = useMutation({
    mutationFn: () =>
      banAdminUser(user.userId, {
        scheduledEndAt: new Date(openedAt + days * 24 * 3600_000).toISOString(),
        comment: comment.trim(),
      }),
    onSuccess: onBanned,
  });

  const endDate = formatDate(new Date(openedAt + days * 24 * 3600_000).toISOString());

  return (
    <AdminModal
      open
      onClose={onClose}
      title={`${user.nickname} 님을 이용 정지할까요?`}
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
        <p className="text-sm text-admin-muted">
          정지 기간 동안 대여·반납은 가능하지만 고장신고(제보)를 쓸 수 없습니다.
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
                <option key={period.days} value={period.days}>
                  {period.label}
                </option>
              ))}
            </AdminSelect>
            <span className="text-sm text-admin-muted tabular-nums">{endDate}까지</span>
          </div>
        </div>
        <div>
          <AdminFieldLabel label="사유" count={comment.length} max={BAN_COMMENT_MAX} />
          <AdminTextarea
            className="min-h-20"
            placeholder="예: 허위 제보 반복 접수 (3회)"
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
