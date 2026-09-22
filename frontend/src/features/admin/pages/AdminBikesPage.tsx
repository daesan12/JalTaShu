import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { formatTimeAgo } from '@/shared/lib/format';
import {
  CYCLE_STATUS_LABEL,
  getAdminCycleStatics,
  getAdminCycles,
  type CycleStatus,
} from '@/features/admin/api/adminCycles';
import { AdminBadge } from '@/features/admin/ui/AdminBadge';
import { AdminFilterBar, AdminSearchInput, AdminSelect } from '@/features/admin/ui/AdminFilters';
import { ADMIN_PAGE_SIZE, AdminPagination } from '@/features/admin/ui/AdminPagination';
import { AdminStatCard } from '@/features/admin/ui/AdminStatCard';
import { AdminTable } from '@/features/admin/ui/AdminTable';
import { AdminTableStatus } from '@/features/admin/ui/AdminTableStatus';

type ClaimFilter = 'all' | 'has' | 'none';

/** 05 자전거 목록 — 통계 4카드 + 필터 + 표. 행을 누르면 07 상세로 */
export function AdminBikesPage() {
  const navigate = useNavigate();

  const [cycleSearch, setCycleSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [status, setStatus] = useState<'all' | CycleStatus>('all');
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>('all');
  const [page, setPage] = useState(1);

  const statics = useQuery({ queryKey: ['adminCycleStatics'], queryFn: getAdminCycleStatics });
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['adminCycles'],
    queryFn: getAdminCycles,
  });

  // 서버 필터(cycle·stationName·statement·hasClaim)가 있지만 입력 즉시 반응하도록 클라에서 거른다
  const filtered = useMemo(() => {
    const cycleKeyword = cycleSearch.trim().toLowerCase();
    const locationKeyword = locationSearch.trim().toLowerCase();
    return (data ?? []).filter((cycle) => {
      if (cycleKeyword && !cycle.cycleId.toLowerCase().includes(cycleKeyword)) return false;
      if (locationKeyword && !cycle.currentLocation?.toLowerCase().includes(locationKeyword)) {
        return false;
      }
      if (status !== 'all' && cycle.statement !== status) return false;
      if (claimFilter === 'has' && cycle.claimCnt === 0) return false;
      if (claimFilter === 'none' && cycle.claimCnt > 0) return false;
      return true;
    });
  }, [data, cycleSearch, locationSearch, status, claimFilter]);
  const pageItems = filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">자전거 관리</h2>

      {/* 통계 4카드 (GET /admin/cycle/statics 실측 — 정상/정지가 아니라 대기/대여 구분) */}
      <div className="grid grid-cols-4 gap-4">
        <AdminStatCard label="전체 자전거" value={statics.data?.totalCycleCnt ?? '–'} />
        <AdminStatCard
          label="대기중"
          value={statics.data?.waitCycleCnt ?? '–'}
          valueClass="text-admin-ok-text"
        />
        <AdminStatCard
          label="대여중"
          value={statics.data?.rentCycleCnt ?? '–'}
          valueClass="text-admin-warn-text"
        />
        <AdminStatCard
          label="제보 있는 자전거"
          value={statics.data?.claimCycleCnt ?? '–'}
          valueClass="text-admin-danger-text"
        />
      </div>

      <AdminFilterBar>
        <AdminSearchInput
          placeholder="자전거 ID 검색"
          className="w-56"
          value={cycleSearch}
          onChange={(e) => {
            setCycleSearch(e.target.value);
            setPage(1);
          }}
        />
        <AdminSearchInput
          placeholder="현재 위치 검색"
          className="w-56"
          value={locationSearch}
          onChange={(e) => {
            setLocationSearch(e.target.value);
            setPage(1);
          }}
        />
        <AdminSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as 'all' | CycleStatus);
            setPage(1);
          }}
          aria-label="상태 필터"
        >
          <option value="all">전체 상태</option>
          <option value="READY">대기중</option>
          <option value="RENTING">대여중</option>
        </AdminSelect>
        <AdminSelect
          value={claimFilter}
          onChange={(e) => {
            setClaimFilter(e.target.value as ClaimFilter);
            setPage(1);
          }}
          aria-label="제보 필터"
        >
          <option value="all">제보 전체</option>
          <option value="has">제보 있음</option>
          <option value="none">제보 없음</option>
        </AdminSelect>
      </AdminFilterBar>

      <div className="rounded-lg border border-admin-line">
        <AdminTable clickableRows>
          <thead>
            <tr>
              <th className="w-32">자전거 ID</th>
              <th>현재 위치</th>
              <th className="w-28">상태</th>
              <th className="w-24 text-right">제보</th>
              <th className="w-36">최근 이용</th>
            </tr>
          </thead>
          <tbody>
            <AdminTableStatus
              colSpan={5}
              isPending={isPending}
              isError={isError}
              onRetry={() => void refetch()}
              isEmpty={pageItems.length === 0}
              emptyText="표시할 자전거가 없습니다"
            />
            {pageItems.map((cycle) => (
              <tr key={cycle.cycleId} onClick={() => navigate(`/admin/bikes/${cycle.cycleId}`)}>
                <td className="tabular-nums">{cycle.cycleId}</td>
                <td className="truncate">
                  {cycle.currentLocation ?? <span className="text-admin-muted">대여 중</span>}
                </td>
                <td>
                  <AdminBadge state={CYCLE_STATUS_LABEL[cycle.statement]} />
                </td>
                <td
                  className={`text-right tabular-nums ${
                    cycle.claimCnt > 0 ? 'font-medium text-admin-danger-text' : ''
                  }`}
                >
                  {cycle.claimCnt}
                </td>
                <td className="text-admin-muted">
                  {cycle.recentUsingAt ? formatTimeAgo(cycle.recentUsingAt) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
        <AdminPagination
          page={page}
          pageSize={ADMIN_PAGE_SIZE}
          totalCount={filtered.length}
          onChange={setPage}
        />
      </div>
    </div>
  );
}
