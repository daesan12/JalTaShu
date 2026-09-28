import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/useToast';
import { formatDateTime, formatUserCells } from '@/features/admin/lib/format';
import {
  CLAIM_CATEGORY_LABEL,
  CLAIM_STATUS_LABEL,
  type AdminClaim,
} from '@/features/admin/api/adminClaims';
import {
  CYCLE_STATUS_LABEL,
  getAdminCycleClaims,
  getAdminCycleHistory,
  getAdminCycleOwnStatics,
  getAdminCycles,
} from '@/features/admin/api/adminCycles';
import { ClaimDetailModal } from '@/features/admin/components/ClaimDetailModal';
import { AdminBadge } from '@/features/admin/ui/AdminBadge';
import { AdminDetailState } from '@/features/admin/ui/AdminDetailState';
import { AdminStatCard } from '@/features/admin/ui/AdminStatCard';
import { AdminTable } from '@/features/admin/ui/AdminTable';
import { AdminTableStatus } from '@/features/admin/ui/AdminTableStatus';
import { AdminTabBar, AdminTabButton } from '@/features/admin/ui/AdminTabs';
import { AdminToast } from '@/features/admin/ui/AdminToast';

type DetailTab = 'rides' | 'claims';

/**
 * 07 자전거 상세 — 통계 카드 + 이용 이력 / 제보(07-b) 두 탭. 제보를 누르면 상태를 바꾼다(#157).
 * 개별 조회 API가 이용 이력만 주므로 기본 정보(상태·위치)는 목록 응답에서 찾는다
 * (목록에서 진입하는 화면이라 대부분 캐시에 있다).
 */
export function AdminBikePage() {
  const { cycleId = '' } = useParams();
  const [tab, setTab] = useState<DetailTab>('rides');
  const [selectedClaim, setSelectedClaim] = useState<AdminClaim | null>(null);
  const { message, showToast } = useToast();

  const history = useQuery({
    queryKey: ['adminCycleHistory', cycleId],
    queryFn: () => getAdminCycleHistory(cycleId),
  });
  const statics = useQuery({
    queryKey: ['adminCycleStatics', cycleId],
    queryFn: () => getAdminCycleOwnStatics(cycleId),
  });
  // 상태·현재 위치는 목록 API에만 있다 — 캐시를 공유하므로 목록에서 왔다면 재요청 없음
  const cycles = useQuery({ queryKey: ['adminCycles'], queryFn: getAdminCycles });
  // 제보 관리(03)와 같은 저장소를 자전거 기준으로 거른 목록
  const claims = useQuery({
    queryKey: ['adminCycleClaims', cycleId],
    queryFn: () => getAdminCycleClaims(cycleId),
  });

  if (history.isPending || history.isError) {
    return (
      <AdminDetailState
        isError={history.isError}
        errorText="자전거 정보를 불러오지 못했습니다."
        onRetry={() => void history.refetch()}
      />
    );
  }

  const summary = cycles.data?.find((c) => c.cycleId === cycleId) ?? null;
  const rides = history.data;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/bikes" className="text-sm text-admin-muted hover:text-admin-text">
          ← 자전거 관리
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h2 className="text-xl font-semibold tabular-nums">{cycleId}</h2>
          {summary && <AdminBadge state={CYCLE_STATUS_LABEL[summary.statement]} />}
          {summary?.currentLocation && (
            <span className="text-sm text-admin-muted">위치: {summary.currentLocation}</span>
          )}
        </div>
      </div>

      {/* 통계 3카드 (GET /admin/cycle/{id}/statics 실측 — 거리·시간 대신 제보·등록일) */}
      <div className="grid grid-cols-3 gap-4">
        <AdminStatCard
          label="누적 이용"
          value={statics.data ? `${statics.data.usingCnt}회` : '–'}
        />
        <AdminStatCard
          label="미해결 제보"
          value={statics.data ? `${statics.data.unresolvedClaim}건` : '–'}
          valueClass={
            statics.data && statics.data.unresolvedClaim > 0 ? 'text-admin-danger-text' : ''
          }
        />
        <AdminStatCard
          label="등록일"
          value={statics.data ? formatDate(statics.data.registeredAt) : '–'}
        />
      </div>

      {/* 탭 */}
      <div>
        <AdminTabBar>
          <AdminTabButton active={tab === 'rides'} onClick={() => setTab('rides')}>
            이용 이력 <span className="tabular-nums">{rides.length}</span>
          </AdminTabButton>
          <AdminTabButton active={tab === 'claims'} onClick={() => setTab('claims')}>
            제보 <span className="tabular-nums">{claims.data?.length ?? 0}</span>
          </AdminTabButton>
        </AdminTabBar>

        <div className="mt-4 rounded-lg border border-admin-line">
          {tab === 'rides' ? (
            <AdminTable>
              <thead>
                <tr>
                  <th className="w-36">이용일</th>
                  <th>구간</th>
                  <th className="w-40">닉네임</th>
                  <th className="w-28">사용자 ID</th>
                </tr>
              </thead>
              <tbody>
                <AdminTableStatus
                  colSpan={4}
                  isPending={false}
                  isEmpty={rides.length === 0}
                  emptyText="이용 이력이 없습니다"
                />
                {rides.map((ride) => {
                  const user = formatUserCells(ride.nickname, ride.userId);
                  return (
                    <tr key={ride.recordId}>
                      <td className="tabular-nums text-admin-muted">
                        {formatDateTime(ride.usingAt)}
                      </td>
                      <td className="truncate">
                        {ride.startingPoint} → {ride.endPoint}
                      </td>
                      <td className="truncate">{user.nickname}</td>
                      <td className="tabular-nums text-admin-muted">{user.userCode}</td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          ) : (
            <AdminTable clickableRows>
              <thead>
                <tr>
                  <th className="w-24">제보 ID</th>
                  <th className="w-28">부위</th>
                  <th>제보 내용</th>
                  <th className="w-32">닉네임</th>
                  <th className="w-28">사용자 ID</th>
                  <th className="w-28">상태</th>
                  <th className="w-32">작성일</th>
                </tr>
              </thead>
              <tbody>
                <AdminTableStatus
                  colSpan={7}
                  isPending={claims.isPending}
                  isEmpty={claims.data?.length === 0}
                  emptyText="접수된 제보가 없습니다"
                />
                {claims.data?.map((claim) => {
                  const user = formatUserCells(claim.nickname, claim.userId);
                  return (
                    <tr key={claim.claimId} onClick={() => setSelectedClaim(claim)}>
                      <td className="tabular-nums text-admin-muted">CL-{claim.claimId}</td>
                      <td>
                        {claim.category === null ? '-' : CLAIM_CATEGORY_LABEL[claim.category]}
                      </td>
                      <td className="truncate">{claim.content}</td>
                      <td className="truncate">{user.nickname}</td>
                      <td className="tabular-nums text-admin-muted">{user.userCode}</td>
                      <td>
                        <AdminBadge state={CLAIM_STATUS_LABEL[claim.status]} />
                      </td>
                      <td className="tabular-nums text-admin-muted">
                        {formatDate(claim.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          )}
        </div>
        {tab === 'claims' && (claims.data?.length ?? 0) > 0 && (
          <p className="mt-2 text-xs text-admin-muted">
            제보를 누르면 상태를 바꿀 수 있습니다. 바꾼 상태는{' '}
            <Link to="/admin/claims" className="underline">
              제보 관리
            </Link>
            에도 바로 반영됩니다.
          </p>
        )}
      </div>

      {/* 제보 관리(03)와 같은 상세 모달 — 닫으면 입력이 초기화되도록 열릴 때만 마운트 */}
      {selectedClaim && (
        <ClaimDetailModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onSaved={() => {
            setSelectedClaim(null);
            showToast('제보 상태가 변경되었습니다');
          }}
        />
      )}

      {message && <AdminToast message={message} />}
    </div>
  );
}
