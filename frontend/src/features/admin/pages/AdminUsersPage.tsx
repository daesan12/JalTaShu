import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { formatTimeAgo } from '@/shared/lib/format';
import {
  USER_STATUS_LABEL,
  getAdminUsers,
  type UserStatus,
} from '@/features/admin/api/adminUsers';
import { AdminBadge } from '@/features/admin/ui/AdminBadge';
import { AdminFilterBar, AdminSearchInput, AdminSelect } from '@/features/admin/ui/AdminFilters';
import { ADMIN_PAGE_SIZE, AdminPagination } from '@/features/admin/ui/AdminPagination';
import { AdminTable } from '@/features/admin/ui/AdminTable';
import { AdminTableStatus } from '@/features/admin/ui/AdminTableStatus';

/** 04 사용자 목록 — 상태·정렬은 서버 파라미터(구현 O), 닉네임 검색만 클라 필터 */
export function AdminUsersPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statement, setStatement] = useState<'' | UserStatus>('');
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['adminUsers', statement, order],
    queryFn: () => getAdminUsers({ statement, order }),
  });

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return data ?? [];
    return (data ?? []).filter((user) => user.nickname.toLowerCase().includes(keyword));
  }, [data, search]);
  const pageItems = filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">사용자 관리</h2>

      <AdminFilterBar>
        <AdminSearchInput
          placeholder="닉네임 검색"
          className="w-72"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <AdminSelect
          value={statement}
          onChange={(e) => {
            setStatement(e.target.value as '' | UserStatus);
            setPage(1);
          }}
          aria-label="상태 필터"
        >
          <option value="">전체 상태</option>
          <option value="NORMAL">정상</option>
          <option value="BANNED">정지</option>
        </AdminSelect>
        <AdminSelect
          value={order}
          onChange={(e) => {
            setOrder(e.target.value as 'newest' | 'oldest');
            setPage(1);
          }}
          aria-label="정렬"
        >
          <option value="newest">최근 이용순</option>
          <option value="oldest">오래된순</option>
        </AdminSelect>
      </AdminFilterBar>

      <div className="rounded-lg border border-admin-line">
        <AdminTable clickableRows>
          <thead>
            <tr>
              <th className="w-28">사용자 ID</th>
              <th>닉네임</th>
              <th className="w-28">상태</th>
              <th className="w-40">최근 이용</th>
            </tr>
          </thead>
          <tbody>
            <AdminTableStatus
              colSpan={4}
              isPending={isPending}
              isError={isError}
              onRetry={() => void refetch()}
              isEmpty={pageItems.length === 0}
              emptyText="표시할 사용자가 없습니다"
            />
            {pageItems.map((user) => (
              <tr key={user.userId} onClick={() => navigate(`/admin/users/${user.userId}`)}>
                <td className="tabular-nums text-admin-muted">{user.userId}</td>
                <td className="truncate">{user.nickname}</td>
                <td>
                  <AdminBadge state={USER_STATUS_LABEL[user.userStatement]} />
                </td>
                <td className="text-admin-muted">{formatTimeAgo(user.recentUsingAt)}</td>
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
