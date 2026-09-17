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
import { AdminPagination } from '@/features/admin/ui/AdminPagination';
import { AdminTable } from '@/features/admin/ui/AdminTable';

const PAGE_SIZE = 12;

type ClaimFilter = 'all' | 'has' | 'none';

/** 05 자전거 목록 — 통계 4카드 + 필터 + 표. 행을 누르면 07 상세로 */
export function AdminBikesPage() {
  const navigate = useNavigate();

  const [cycleSearch, setCycleSearch] = useState('');
  const [stationSearch, setStationSearch] = useState('');
  const [status, setStatus] = useState<'all' | CycleStatus>('all');
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>('all');
  const [page, setPage] = useState(1);

  const statics = useQuery({ queryKey: ['adminCycleStatics'], queryFn: getAdminCycleStatics });
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['adminCycles'],
    queryFn: getAdminCycles,
  });

  // 명세 필터(cycle·stationName·statement·hasClaim)는 목업이라 클라에서 거른다 (연동 시 서버로)
  const filtered = useMemo(() => {
    const cycleKeyword = cycleSearch.trim().toLowerCase();
    const stationKeyword = stationSearch.trim().toLowerCase();
    return (data ?? []).filter((cycle) => {
      if (cycleKeyword && !cycle.cycleId.toLowerCase().includes(cycleKeyword)) return false;
      if (stationKeyword && !cycle.stationName?.toLowerCase().includes(stationKeyword)) {
        return false;
      }
      if (status !== 'all' && cycle.statement !== status) return false;
      if (claimFilter === 'has' && cycle.openClaimCnt === 0) return false;
      if (claimFilter === 'none' && cycle.openClaimCnt > 0) return false;
      return true;
    });
  }, [data, cycleSearch, stationSearch, status, claimFilter]);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">자전거 관리</h2>

      {/* 통계 4카드 (GET /admin/cycle/statics) */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="전체 자전거" value={statics.data?.totalCnt} />
        <StatCard label="정상" value={statics.data?.activeCnt} valueClass="text-admin-ok-text" />
        <StatCard
          label="정지"
          value={statics.data?.suspendedCnt}
          valueClass="text-admin-danger-text"
        />
        <StatCard
          label="미해결 제보 있는 자전거"
          value={statics.data?.claimedCnt}
          valueClass="text-admin-warn-text"
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
          placeholder="대여소 검색"
          className="w-56"
          value={stationSearch}
          onChange={(e) => {
            setStationSearch(e.target.value);
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
          <option value="ACTIVE">정상</option>
          <option value="SUSPENDED">정지</option>
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
          <option value="has">미해결 제보 있음</option>
          <option value="none">미해결 제보 없음</option>
        </AdminSelect>
      </AdminFilterBar>

      <div className="rounded-lg border border-admin-line">
        <AdminTable clickableRows>
          <thead>
            <tr>
              <th className="w-32">자전거 ID</th>
              <th>배치 대여소</th>
              <th className="w-28">상태</th>
              <th className="w-32 text-right">미해결 제보</th>
              <th className="w-36">최근 이용</th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr>
                <td colSpan={5} className="text-center text-admin-muted">
                  불러오는 중…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={5} className="text-center">
                  <span className="text-admin-muted">목록을 불러오지 못했습니다. </span>
                  <button
                    type="button"
                    className="text-admin-text underline"
                    onClick={() => void refetch()}
                  >
                    다시 시도
                  </button>
                </td>
              </tr>
            )}
            {!isPending && !isError && pageItems.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-admin-muted">
                  표시할 자전거가 없습니다
                </td>
              </tr>
            )}
            {pageItems.map((cycle) => (
              <tr key={cycle.cycleId} onClick={() => navigate(`/admin/bikes/${cycle.cycleId}`)}>
                <td className="tabular-nums">{cycle.cycleId}</td>
                <td className="truncate">
                  {cycle.stationName ?? <span className="text-admin-muted">대여 중</span>}
                </td>
                <td>
                  <AdminBadge state={CYCLE_STATUS_LABEL[cycle.statement]} />
                </td>
                <td
                  className={`text-right tabular-nums ${
                    cycle.openClaimCnt > 0 ? 'font-medium text-admin-danger-text' : ''
                  }`}
                >
                  {cycle.openClaimCnt}
                </td>
                <td className="text-admin-muted">{formatTimeAgo(cycle.lastUsedAt)}</td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
        <AdminPagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={filtered.length}
          onChange={setPage}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass = '',
}: {
  label: string;
  value: number | undefined;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg bg-admin-panel px-5 py-4">
      <p className="text-sm text-admin-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value ?? '–'}</p>
    </div>
  );
}
