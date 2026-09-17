import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { formatDate, formatMinutes } from '@/shared/lib/format';
import { CLAIM_STATUS_LABEL } from '@/features/admin/api/adminClaims';
import {
  CYCLE_STATUS_LABEL,
  getAdminCycle,
  getAdminCycleClaims,
  getAdminCycleOwnStatics,
} from '@/features/admin/api/adminCycles';
import { formatDateTime } from '@/features/admin/lib/format';
import { AdminBadge } from '@/features/admin/ui/AdminBadge';
import { AdminDetailState } from '@/features/admin/ui/AdminDetailState';
import { AdminStatCard } from '@/features/admin/ui/AdminStatCard';
import { AdminTable } from '@/features/admin/ui/AdminTable';
import { AdminTableStatus } from '@/features/admin/ui/AdminTableStatus';
import { AdminTabBar, AdminTabButton } from '@/features/admin/ui/AdminTabs';

type DetailTab = 'rides' | 'claims';

/** 07 자전거 상세 — 누적 통계 3카드 + 이용 이력 / 제보(07-b) 두 탭 */
export function AdminBikePage() {
  const { cycleId = '' } = useParams();
  const [tab, setTab] = useState<DetailTab>('rides');

  const detail = useQuery({
    queryKey: ['adminCycle', cycleId],
    queryFn: () => getAdminCycle(cycleId),
  });
  const statics = useQuery({
    queryKey: ['adminCycleStatics', cycleId],
    queryFn: () => getAdminCycleOwnStatics(cycleId),
  });
  // 제보 관리(03)와 같은 저장소를 자전거 기준으로 거른 목록
  const claims = useQuery({
    queryKey: ['adminCycleClaims', cycleId],
    queryFn: () => getAdminCycleClaims(cycleId),
  });

  if (detail.isPending || detail.isError) {
    return (
      <AdminDetailState
        isError={detail.isError}
        errorText="자전거 정보를 불러오지 못했습니다."
        onRetry={() => void detail.refetch()}
      />
    );
  }

  const cycle = detail.data;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/admin/bikes" className="text-sm text-admin-muted hover:text-admin-text">
          ← 자전거 관리
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h2 className="text-xl font-semibold tabular-nums">{cycle.cycleId}</h2>
          <AdminBadge state={CYCLE_STATUS_LABEL[cycle.statement]} />
          <span className="text-sm text-admin-muted">
            {cycle.stationId && cycle.stationName ? (
              <>
                배치:{' '}
                <Link to={`/admin/stations/${cycle.stationId}`} className="underline">
                  {cycle.stationName}
                </Link>
              </>
            ) : (
              '대여 중'
            )}
          </span>
        </div>
      </div>

      {/* 누적 통계 3카드 (GET /admin/cycle/{id}/statics) */}
      <div className="grid grid-cols-3 gap-4">
        <AdminStatCard
          label="누적 이용"
          value={statics.data ? `${statics.data.totalRides}회` : '–'}
        />
        <AdminStatCard
          label="누적 거리"
          value={statics.data ? `${statics.data.totalDistanceKm.toLocaleString()}km` : '–'}
        />
        <AdminStatCard
          label="누적 이용 시간"
          value={statics.data ? formatMinutes(statics.data.totalDurationMin) : '–'}
        />
      </div>

      {/* 탭 */}
      <div>
        <AdminTabBar>
          <AdminTabButton active={tab === 'rides'} onClick={() => setTab('rides')}>
            이용 이력 <span className="tabular-nums">{cycle.rides.length}</span>
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
                  <th className="w-36">대여</th>
                  <th className="w-36">반납</th>
                  <th>구간</th>
                  <th className="w-28 text-right">이용 시간</th>
                  <th className="w-24 text-right">거리</th>
                </tr>
              </thead>
              <tbody>
                {cycle.rides.map((ride) => (
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
            <AdminTable>
              <thead>
                <tr>
                  <th className="w-24">제보 ID</th>
                  <th className="w-28">부위</th>
                  <th>제보 내용</th>
                  <th className="w-32">제보자</th>
                  <th className="w-28">상태</th>
                  <th className="w-32">작성일</th>
                </tr>
              </thead>
              <tbody>
                <AdminTableStatus
                  colSpan={6}
                  isPending={claims.isPending}
                  isEmpty={claims.data?.length === 0}
                  emptyText="접수된 제보가 없습니다"
                />
                {claims.data?.map((claim) => (
                  <tr key={claim.claimId}>
                    <td className="tabular-nums text-admin-muted">CL-{claim.claimId}</td>
                    <td>{claim.tag}</td>
                    <td className="truncate">{claim.content}</td>
                    <td className="truncate">{claim.nickname}</td>
                    <td>
                      <AdminBadge state={CLAIM_STATUS_LABEL[claim.statement]} />
                    </td>
                    <td className="tabular-nums text-admin-muted">{formatDate(claim.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </div>
        {tab === 'claims' && (claims.data?.length ?? 0) > 0 && (
          <p className="mt-2 text-xs text-admin-muted">
            상태 변경은 <Link to="/admin/claims" className="underline">제보 관리</Link>에서 할 수
            있습니다.
          </p>
        )}
      </div>
    </div>
  );
}
