import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { formatDate } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/useToast';
import {
  CLAIM_STATUS_LABEL,
  getAdminClaims,
  updateAdminClaim,
  type AdminClaim,
  type ClaimStatus,
} from '@/features/admin/api/adminClaims';
import { AdminBadge } from '@/features/admin/ui/AdminBadge';
import { AdminButton } from '@/features/admin/ui/AdminButton';
import { AdminFieldLabel, AdminTextarea } from '@/features/admin/ui/AdminField';
import { AdminFilterBar, AdminSearchInput, AdminSelect } from '@/features/admin/ui/AdminFilters';
import { AdminModal } from '@/features/admin/ui/AdminModal';
import { ADMIN_PAGE_SIZE, AdminPagination } from '@/features/admin/ui/AdminPagination';
import { AdminStatCard } from '@/features/admin/ui/AdminStatCard';
import { AdminTable } from '@/features/admin/ui/AdminTable';
import { AdminTableStatus } from '@/features/admin/ui/AdminTableStatus';
import { AdminToast } from '@/features/admin/ui/AdminToast';

const STATUS_ORDER: ClaimStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
type SortOrder = 'newest' | 'oldest' | 'reports';

/** 상태 통계 카드의 숫자 색 — 배지와 같은 역할 색 */
const STATUS_COUNT_CLASS: Record<ClaimStatus, string> = {
  OPEN: 'text-admin-danger-text',
  IN_PROGRESS: 'text-admin-warn-text',
  RESOLVED: 'text-admin-ok-text',
};

/**
 * 03 제보 관리 — 상태 통계 3카드 + 필터 목록 + 상세 모달(03-a)에서 상태 변경(03-b).
 * 화면 이름은 "제보"지만 API 용어는 claim (신고=report는 허위 제보 신고, 별개 기능).
 */
export function AdminClaimsPage() {
  const { message, showToast } = useToast();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | ClaimStatus>('all');
  const [order, setOrder] = useState<SortOrder>('newest');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminClaim | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['adminClaims'],
    queryFn: getAdminClaims,
  });

  const counts = useMemo(() => {
    const base: Record<ClaimStatus, number> = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 };
    for (const claim of data ?? []) base[claim.statement] += 1;
    return base;
  }, [data]);

  // 필터·정렬은 클라이언트에서 — 명세 파라미터(nickname·cycleId·order·status)는 연동 시 서버로 교체
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const list = (data ?? []).filter((claim) => {
      if (status !== 'all' && claim.statement !== status) return false;
      if (
        keyword &&
        !claim.nickname.toLowerCase().includes(keyword) &&
        !claim.cycleId.toLowerCase().includes(keyword)
      ) {
        return false;
      }
      return true;
    });
    return list.sort((a, b) =>
      order === 'newest'
        ? b.createdAt.localeCompare(a.createdAt)
        : order === 'oldest'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.reportCnt - a.reportCnt || b.createdAt.localeCompare(a.createdAt),
    );
  }, [data, search, status, order]);
  const pageItems = filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">제보 관리</h2>

      {/* 상태 통계 3카드 */}
      <div className="grid grid-cols-3 gap-4">
        {STATUS_ORDER.map((key) => (
          <AdminStatCard
            key={key}
            label={CLAIM_STATUS_LABEL[key]}
            value={counts[key]}
            valueClass={STATUS_COUNT_CLASS[key]}
          />
        ))}
      </div>

      <AdminFilterBar>
        <AdminSearchInput
          placeholder="닉네임·자전거 ID 검색"
          className="w-72"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <AdminSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as 'all' | ClaimStatus);
            setPage(1);
          }}
          aria-label="상태 필터"
        >
          <option value="all">전체 상태</option>
          {STATUS_ORDER.map((key) => (
            <option key={key} value={key}>
              {CLAIM_STATUS_LABEL[key]}
            </option>
          ))}
        </AdminSelect>
        <AdminSelect
          value={order}
          onChange={(e) => {
            setOrder(e.target.value as SortOrder);
            setPage(1);
          }}
          aria-label="정렬"
        >
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="reports">신고 많은순</option>
        </AdminSelect>
      </AdminFilterBar>

      <div className="rounded-lg border border-admin-line">
        <AdminTable clickableRows>
          <thead>
            <tr>
              <th className="w-24">제보 ID</th>
              <th className="w-32">자전거</th>
              <th className="w-28">부위</th>
              <th>제보 내용</th>
              <th className="w-32">제보자</th>
              <th className="w-16 text-right">신고</th>
              <th className="w-28">상태</th>
              <th className="w-32">작성일</th>
            </tr>
          </thead>
          <tbody>
            <AdminTableStatus
              colSpan={8}
              isPending={isPending}
              isError={isError}
              onRetry={() => void refetch()}
              isEmpty={pageItems.length === 0}
              emptyText="표시할 제보가 없습니다"
            />
            {pageItems.map((claim) => (
              <tr key={claim.claimId} onClick={() => setSelected(claim)}>
                <td className="tabular-nums text-admin-muted">CL-{claim.claimId}</td>
                <td className="tabular-nums">{claim.cycleId}</td>
                <td>{claim.tag}</td>
                <td className="truncate">{claim.content}</td>
                <td className="truncate">{claim.nickname}</td>
                <td
                  className={`text-right tabular-nums ${
                    claim.reportCnt >= 3 ? 'font-medium text-admin-danger-text' : ''
                  }`}
                >
                  {claim.reportCnt}
                </td>
                <td>
                  <AdminBadge state={CLAIM_STATUS_LABEL[claim.statement]} />
                </td>
                <td className="tabular-nums text-admin-muted">{formatDate(claim.createdAt)}</td>
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

      {/* 03-a 제보 상세 — 닫으면 입력이 초기화되도록 열릴 때만 마운트 */}
      {selected && (
        <ClaimDetailModal
          claim={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            showToast('제보 상태가 변경되었습니다');
          }}
        />
      )}

      {message && <AdminToast message={message} />}
    </div>
  );
}

interface ClaimDetailModalProps {
  claim: AdminClaim;
  onClose: () => void;
  onSaved: () => void;
}

/** 03-a 제보 상세 + 상태 변경. 저장하면 03-b 토스트는 부모가 띄운다 */
function ClaimDetailModal({ claim, onClose, onSaved }: ClaimDetailModalProps) {
  const queryClient = useQueryClient();
  const [statement, setStatement] = useState<ClaimStatus>(claim.statement);
  const [content, setContent] = useState(claim.adminContent ?? '');

  const save = useMutation({
    mutationFn: () => updateAdminClaim(claim.claimId, { statement, content: content.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['adminClaims'] });
      onSaved();
    },
  });

  return (
    <AdminModal
      open
      onClose={onClose}
      title={`제보 상세 CL-${claim.claimId}`}
      size="lg"
      footer={
        <>
          <AdminButton variant="secondary" onClick={onClose}>
            취소
          </AdminButton>
          <AdminButton disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? '저장 중…' : '저장'}
          </AdminButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-4 gap-x-4 gap-y-2 text-sm">
          <InfoItem label="자전거" value={claim.cycleId} />
          <InfoItem label="제보자" value={claim.nickname} />
          <InfoItem label="부위" value={claim.tag} />
          <InfoItem label="작성일" value={formatDate(claim.createdAt)} />
        </dl>

        <div className="rounded-md bg-admin-panel px-4 py-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{claim.content}</p>
          {claim.reportCnt > 0 && (
            <p className="mt-2 text-xs text-admin-danger-text">
              허위 제보 신고 {claim.reportCnt}건
            </p>
          )}
        </div>

        <div className="grid grid-cols-[8rem_1fr] items-center gap-3">
          <span className="text-sm font-medium">처리 상태</span>
          <AdminSelect
            value={statement}
            onChange={(e) => setStatement(e.target.value as ClaimStatus)}
            className="w-40"
            aria-label="처리 상태"
          >
            {STATUS_ORDER.map((key) => (
              <option key={key} value={key}>
                {CLAIM_STATUS_LABEL[key]}
              </option>
            ))}
          </AdminSelect>
        </div>

        <div>
          <AdminFieldLabel label="처리 내용" />
          <AdminTextarea
            className="min-h-24"
            placeholder="처리 결과나 조치 내용을 남겨 주세요 (선택)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        {save.isError && (
          <p className="text-sm text-admin-danger-text">
            {save.error instanceof ApiError
              ? save.error.message
              : '저장에 실패했습니다. 다시 시도해 주세요.'}
          </p>
        )}
      </div>
    </AdminModal>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-admin-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
