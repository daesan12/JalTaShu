import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { formatDate } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/useToast';
import {
  NOTICE_CONTENT_MAX,
  NOTICE_TITLE_MAX,
  createAdminNotice,
  deleteAdminNotice,
  getAdminNotices,
  type AdminNotice,
} from '@/features/admin/api/adminNotices';
import { AdminButton } from '@/features/admin/ui/AdminButton';
import { AdminDateRange, AdminFilterBar, AdminSearchInput } from '@/features/admin/ui/AdminFilters';
import { AdminModal } from '@/features/admin/ui/AdminModal';
import { AdminPagination } from '@/features/admin/ui/AdminPagination';
import { AdminTable } from '@/features/admin/ui/AdminTable';
import { AdminToast } from '@/features/admin/ui/AdminToast';

const PAGE_SIZE = 12;

/** 모달 안 입력칸 — AdminFilters의 컨트롤과 같은 결 */
const FIELD_CLASS =
  'w-full rounded-md border border-admin-line bg-admin-bg px-3 py-2 text-sm text-admin-text ' +
  'placeholder:text-admin-muted focus:border-admin-indicator focus:ring-1 focus:ring-admin-indicator focus:outline-none';

/** 06 공지 목록 + 06-a 삭제 확인 + 08 공지 등록 (수정 없음, 이미지 첨부 없음 — Figma 명시) */
export function AdminNoticesPage() {
  const queryClient = useQueryClient();
  const { message, showToast } = useToast();

  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AdminNotice | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminNotice | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['adminNotices'],
    queryFn: getAdminNotices,
  });

  // 검색·기간은 클라이언트 필터 — 목록 API에 파라미터 명세가 없어 임시 (연동 시 대조)
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (data ?? []).filter((notice) => {
      if (keyword && !notice.title.toLowerCase().includes(keyword)) return false;
      const day = notice.createdAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [data, search, from, to]);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const remove = useMutation({
    mutationFn: (notice: AdminNotice) => deleteAdminNotice(notice.noticeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['adminNotices'] });
      setDeleteTarget(null);
      setDetail(null);
      showToast('공지사항이 삭제되었습니다');
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">공지사항</h2>
        <AdminButton onClick={() => setComposeOpen(true)}>공지 등록</AdminButton>
      </div>

      <AdminFilterBar>
        <AdminSearchInput
          placeholder="제목 검색"
          className="w-72"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <AdminDateRange
          from={from}
          to={to}
          onFromChange={(value) => {
            setFrom(value);
            setPage(1);
          }}
          onToChange={(value) => {
            setTo(value);
            setPage(1);
          }}
        />
      </AdminFilterBar>

      <div className="rounded-lg border border-admin-line">
        <AdminTable clickableRows>
          <thead>
            <tr>
              <th className="w-20">번호</th>
              <th>제목</th>
              <th className="w-32">작성일</th>
              <th className="w-24 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr>
                <td colSpan={4} className="text-center text-admin-muted">
                  불러오는 중…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={4} className="text-center">
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
                <td colSpan={4} className="text-center text-admin-muted">
                  표시할 공지가 없습니다
                </td>
              </tr>
            )}
            {pageItems.map((notice) => (
              <tr key={notice.noticeId} onClick={() => setDetail(notice)}>
                <td className="tabular-nums text-admin-muted">{notice.noticeId}</td>
                <td className="truncate">{notice.title}</td>
                <td className="tabular-nums text-admin-muted">{formatDate(notice.createdAt)}</td>
                <td className="text-right">
                  <AdminButton
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(notice);
                    }}
                  >
                    삭제
                  </AdminButton>
                </td>
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

      {/* 06 상세 보기 — 목록 응답에 내용이 포함된 임시 스키마라 재요청 없이 연다 */}
      <AdminModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.title ?? ''}
        size="lg"
        footer={
          <>
            <AdminButton
              variant="danger"
              onClick={() => detail && setDeleteTarget(detail)}
            >
              삭제
            </AdminButton>
            <AdminButton variant="secondary" onClick={() => setDetail(null)}>
              닫기
            </AdminButton>
          </>
        }
      >
        {detail && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-admin-muted">
              {formatDate(detail.createdAt)} · 공지 #{detail.noticeId}
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{detail.content}</p>
          </div>
        )}
      </AdminModal>

      {/* 08 공지 등록 — 닫으면 입력이 초기화되도록 열릴 때만 마운트 */}
      {composeOpen && (
        <ComposeNoticeModal
          onClose={() => setComposeOpen(false)}
          onCreated={() => {
            setComposeOpen(false);
            setPage(1);
            void queryClient.invalidateQueries({ queryKey: ['adminNotices'] });
            showToast('공지사항이 등록되었습니다');
          }}
        />
      )}

      {/* 06-a 삭제 확인 */}
      <AdminModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="공지사항을 삭제할까요?"
        size="sm"
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setDeleteTarget(null)}>
              취소
            </AdminButton>
            <AdminButton
              variant="danger"
              disabled={remove.isPending}
              onClick={() => deleteTarget && remove.mutate(deleteTarget)}
            >
              {remove.isPending ? '삭제 중…' : '삭제'}
            </AdminButton>
          </>
        }
      >
        <p className="text-sm text-admin-muted">삭제한 공지는 되돌릴 수 없습니다.</p>
        {deleteTarget && <p className="mt-2 truncate text-sm">{deleteTarget.title}</p>}
      </AdminModal>

      {message && <AdminToast message={message} />}
    </div>
  );
}

interface ComposeNoticeModalProps {
  onClose: () => void;
  onCreated: () => void;
}

/** 08 공지 등록 — 제목 0/60·내용 0/2000 카운터, 이미지 첨부 없음 */
function ComposeNoticeModal({ onClose, onCreated }: ComposeNoticeModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const create = useMutation({
    mutationFn: () => createAdminNotice({ title: title.trim(), content: content.trim() }),
    onSuccess: onCreated,
  });

  const valid = title.trim().length > 0 && content.trim().length > 0;

  return (
    <AdminModal
      open
      onClose={onClose}
      title="공지 등록"
      size="lg"
      footer={
        <>
          <AdminButton variant="secondary" onClick={onClose}>
            취소
          </AdminButton>
          <AdminButton disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? '등록 중…' : '등록'}
          </AdminButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <FieldLabel label="제목" count={title.length} max={NOTICE_TITLE_MAX} />
          <input
            className={FIELD_CLASS}
            placeholder="공지 제목을 입력해 주세요"
            value={title}
            maxLength={NOTICE_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel label="내용" count={content.length} max={NOTICE_CONTENT_MAX} />
          <textarea
            className={`${FIELD_CLASS} min-h-56 resize-y`}
            placeholder="공지 내용을 입력해 주세요"
            value={content}
            maxLength={NOTICE_CONTENT_MAX}
            onChange={(e) => setContent(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-admin-muted">사진은 첨부할 수 없습니다.</p>
        </div>
        {create.isError && (
          <p className="text-sm text-admin-danger-text">
            {create.error instanceof ApiError
              ? create.error.message
              : '등록에 실패했습니다. 다시 시도해 주세요.'}
          </p>
        )}
      </div>
    </AdminModal>
  );
}

function FieldLabel({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-admin-muted tabular-nums">
        {count}/{max}
      </span>
    </div>
  );
}
