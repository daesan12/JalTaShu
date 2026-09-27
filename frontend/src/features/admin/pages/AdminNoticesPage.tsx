import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { formatDate } from '@/shared/lib/format';
import { useToast } from '@/shared/lib/useToast';
import {
  MAX_PINNED_NOTICES,
  NOTICE_CONTENT_MAX,
  NOTICE_TITLE_MAX,
  createAdminNotice,
  deleteAdminNotice,
  getAdminNotice,
  getAdminNotices,
  getAdminPopups,
  pinNotice,
  unpinNotice,
  updatePinnedPhoto,
  type AdminNoticeSummary,
} from '@/features/admin/api/adminNotices';
import { PinIcon } from '@/features/admin/ui/PinIcon';
import { AdminButton } from '@/features/admin/ui/AdminButton';
import { AdminFieldLabel, AdminInput, AdminTextarea } from '@/features/admin/ui/AdminField';
import { AdminDateRange, AdminFilterBar, AdminSearchInput } from '@/features/admin/ui/AdminFilters';
import { AdminModal } from '@/features/admin/ui/AdminModal';
import { ADMIN_PAGE_SIZE, AdminPagination } from '@/features/admin/ui/AdminPagination';
import { AdminTable } from '@/features/admin/ui/AdminTable';
import { AdminTableStatus } from '@/features/admin/ui/AdminTableStatus';
import { AdminToast } from '@/features/admin/ui/AdminToast';

/** 06 공지 목록 + 06-a 삭제 확인 + 08 공지 등록 (수정 없음, 이미지 첨부 없음 — Figma 명시) */
export function AdminNoticesPage() {
  const queryClient = useQueryClient();
  const { message, showToast } = useToast();

  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AdminNoticeSummary | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminNoticeSummary | null>(null);
  /** 핀을 켜려는 공지 — 이미지를 받아야 해서 창을 거친다 */
  const [pinTarget, setPinTarget] = useState<AdminNoticeSummary | null>(null);

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
  const pageItems = filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  // 본문은 목록 응답에 없다(실측) — 상세를 열 때 따로 조회한다
  const detailQuery = useQuery({
    queryKey: ['adminNotice', detail?.noticeId],
    queryFn: () => getAdminNotice(detail!.noticeId),
    enabled: detail !== null,
  });

  /*
   * 핀 상태는 공지 목록이 그대로 알려 준다 — `popupId`가 null 이면 꺼짐, 값이 있으면 켜짐이고
   * 그 값이 해제에 쓸 id다. 팝업 목록을 따로 부르지 않아 행 수와 무관하게 요청이 하나다.
   * 개수도 **전체 목록** 기준으로 센다(검색·기간 필터나 페이지에 걸리면 상한이 틀어진다).
   */
  const pinnedCount = useMemo(
    () => (data ?? []).filter((notice) => notice.popupId !== null).length,
    [data],
  );

  function refreshNotices() {
    void queryClient.invalidateQueries({ queryKey: ['adminNotices'] });
    // 고정·해제하면 팝업 목록(상세의 이미지)도 달라진다
    void queryClient.invalidateQueries({ queryKey: ['adminPopups'] });
  }

  const unpin = useMutation({
    mutationFn: (popupId: number) => unpinNotice(popupId),
    onSuccess: () => {
      refreshNotices();
      showToast('팝업 고정을 해제했습니다');
    },
    onError: (error) =>
      showToast(error instanceof ApiError ? error.message : '고정을 해제하지 못했습니다'),
  });

  /** 핀 아이콘을 눌렀을 때 — 켜져 있으면 바로 끄고, 꺼져 있으면 이미지를 받아야 하므로 창을 연다 */
  function togglePin(notice: AdminNoticeSummary) {
    if (notice.popupId !== null) {
      unpin.mutate(notice.popupId);
      return;
    }
    if (pinnedCount >= MAX_PINNED_NOTICES) {
      showToast(`팝업은 최대 ${MAX_PINNED_NOTICES}개까지 고정할 수 있습니다`);
      return;
    }
    setPinTarget(notice);
  }

  const remove = useMutation({
    mutationFn: (notice: AdminNoticeSummary) => deleteAdminNotice(notice.noticeId),
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
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-semibold">공지사항</h2>
          {/* 핀을 켜기 전에 몇 자리가 남았는지 보이게 — 6번째를 누르고 나서 알면 늦다 */}
          <span className="text-sm text-admin-muted">
            팝업 고정 <span className="tabular-nums">{pinnedCount}</span>/{MAX_PINNED_NOTICES}
          </span>
        </div>
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
              <th className="w-16 text-center">팝업</th>
              <th className="w-24 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            <AdminTableStatus
              colSpan={5}
              isPending={isPending}
              isError={isError}
              onRetry={() => void refetch()}
              isEmpty={pageItems.length === 0}
              emptyText="표시할 공지가 없습니다"
            />
            {pageItems.map((notice) => (
              <tr key={notice.noticeId} onClick={() => setDetail(notice)}>
                <td className="tabular-nums text-admin-muted">{notice.noticeId}</td>
                <td className="truncate">{notice.title}</td>
                <td className="tabular-nums text-admin-muted">{formatDate(notice.createdAt)}</td>
                <td className="text-center">
                  {/* 행 전체가 상세를 여는 클릭 대상이라 핀은 전파를 끊어야 한다 */}
                  <button
                    type="button"
                    aria-pressed={notice.popupId !== null}
                    aria-label={
                      notice.popupId !== null
                        ? `${notice.title} 팝업 고정 해제`
                        : `${notice.title} 팝업으로 고정`
                    }
                    disabled={unpin.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(notice);
                    }}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-admin-line/60 disabled:opacity-50 ${
                      notice.popupId !== null ? 'text-admin-accent' : 'text-admin-muted'
                    }`}
                  >
                    <PinIcon filled={notice.popupId !== null} className="h-5 w-5" />
                  </button>
                </td>
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
          pageSize={ADMIN_PAGE_SIZE}
          totalCount={filtered.length}
          onChange={setPage}
        />
      </div>

      {/* 06 상세 보기 — 본문은 상세 API로 받아 채운다 */}
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
              {formatDate(detail.createdAt)} · {detail.author} · 공지 #{detail.noticeId}
            </p>
            {detailQuery.isPending && (
              <p className="text-sm text-admin-muted">내용을 불러오는 중…</p>
            )}
            {detailQuery.isError && (
              <p className="text-sm text-admin-muted">내용을 불러오지 못했습니다.</p>
            )}
            {detailQuery.data && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {detailQuery.data.content}
              </p>
            )}
            {detail.popupId !== null && (
              <PinnedPhotoSection
                popupId={detail.popupId}
                onUpdated={() => showToast('팝업 이미지를 바꿨습니다')}
              />
            )}
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

      {/* 팝업 고정 — 팝업은 이미지가 있어야 등록되므로 파일을 받고 나서 켠다 */}
      {pinTarget && (
        <PinNoticeModal
          notice={pinTarget}
          onClose={() => setPinTarget(null)}
          onPinned={() => {
            setPinTarget(null);
            refreshNotices();
            showToast('앱 첫 화면 팝업으로 고정했습니다');
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
          <AdminFieldLabel label="제목" count={title.length} max={NOTICE_TITLE_MAX} />
          <AdminInput
            placeholder="공지 제목을 입력해 주세요"
            value={title}
            maxLength={NOTICE_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <AdminFieldLabel label="내용" count={content.length} max={NOTICE_CONTENT_MAX} />
          <AdminTextarea
            className="min-h-56"
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

interface PinNoticeModalProps {
  notice: AdminNoticeSummary;
  onClose: () => void;
  onPinned: () => void;
}

/** 이미지 용량 상한 — S3에 올라가고 앱에서 바로 받으므로 너무 크면 팝업이 늦게 뜬다 */
const PIN_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * 공지를 팝업으로 고정하는 창.
 * 백엔드 팝업은 이미지가 필수라(`createPopup`이 사진을 S3에 올린다) 핀을 켜는 순간 파일을 받는다.
 * 팝업 제목은 화면에 보이지 않고 이미지 대체 텍스트로만 쓰여, 기본값을 공지 제목으로 채운다.
 */
function PinNoticeModal({ notice, onClose, onPinned }: PinNoticeModalProps) {
  const [title, setTitle] = useState(notice.title);
  const [photo, setPhoto] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const pin = useMutation({
    mutationFn: () => pinNotice({ noticeId: notice.noticeId, title: title.trim(), photo: photo! }),
    onSuccess: onPinned,
  });

  function pickPhoto(file: File | null) {
    setFileError(null);
    if (file && file.size > PIN_IMAGE_MAX_BYTES) {
      setFileError('이미지는 5MB 이하만 올릴 수 있습니다.');
      setPhoto(null);
      return;
    }
    setPhoto(file);
  }

  const valid = title.trim().length > 0 && photo !== null;

  return (
    <AdminModal
      open
      onClose={onClose}
      title="앱 팝업으로 고정"
      footer={
        <>
          <AdminButton variant="secondary" onClick={onClose}>
            취소
          </AdminButton>
          <AdminButton disabled={!valid || pin.isPending} onClick={() => pin.mutate()}>
            {pin.isPending ? '고정 중…' : '고정'}
          </AdminButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-admin-muted">
          앱을 열면 이 이미지가 팝업으로 뜨고, 누르면 공지 본문이 열립니다.
        </p>
        <p className="truncate rounded-md bg-admin-line/40 px-3 py-2 text-sm">
          공지 #{notice.noticeId} · {notice.title}
        </p>

        <div>
          <AdminFieldLabel label="팝업 이미지" />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-admin-line/60 file:px-3 file:py-1.5 file:text-sm"
          />
          <p className="mt-1.5 text-xs text-admin-muted">5MB 이하 이미지 파일</p>
          {fileError && <p className="mt-1.5 text-sm text-admin-danger-text">{fileError}</p>}
        </div>

        <div>
          <AdminFieldLabel label="팝업 제목" count={title.length} max={NOTICE_TITLE_MAX} />
          <AdminInput
            value={title}
            maxLength={NOTICE_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-admin-muted">
            화면에는 이미지만 보입니다. 이미지를 불러오지 못했을 때 대신 읽히는 문구입니다.
          </p>
        </div>

        {pin.isError && (
          <p className="text-sm text-admin-danger-text">
            {pin.error instanceof ApiError
              ? pin.error.message
              : '고정에 실패했습니다. 다시 시도해 주세요.'}
          </p>
        )}
      </div>
    </AdminModal>
  );
}

interface PinnedPhotoSectionProps {
  popupId: number;
  onUpdated: () => void;
}

/**
 * 고정 공지의 팝업 이미지 — 올린 사진을 다시 보고, 다른 사진으로 바꾼다(#146).
 * 전에는 고정할 때 한 번 올리면 관리자 화면에서 다시 볼 방법이 없었다.
 * 공지 목록에는 이미지가 없어 팝업 목록(`GET /admin/pop-up`)에서 이 공지의 팝업을 찾는다.
 * 새 사진은 고르면 바로 미리 보여 주고, "이미지 바꾸기"를 눌러야 서버에 올린다.
 */
function PinnedPhotoSection({ popupId, onUpdated }: PinnedPhotoSectionProps) {
  const queryClient = useQueryClient();
  const [photo, setPhoto] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const popups = useQuery({ queryKey: ['adminPopups'], queryFn: getAdminPopups });
  const popup = popups.data?.find((p) => p.popupId === popupId) ?? null;

  // 고른 파일의 미리보기 주소 — 파일이 바뀌거나 창이 닫히면 풀어 준다
  const previewUrl = useMemo(() => (photo === null ? null : URL.createObjectURL(photo)), [photo]);
  useEffect(() => {
    if (previewUrl === null) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const update = useMutation({
    mutationFn: () => updatePinnedPhoto(popupId, photo!),
    onSuccess: () => {
      setPhoto(null);
      void queryClient.invalidateQueries({ queryKey: ['adminPopups'] });
      onUpdated();
    },
  });

  function pickPhoto(file: File | null) {
    setFileError(null);
    if (file && file.size > PIN_IMAGE_MAX_BYTES) {
      setFileError('이미지는 5MB 이하만 올릴 수 있습니다.');
      setPhoto(null);
      return;
    }
    setPhoto(file);
  }

  const shownUrl = previewUrl ?? popup?.photoUrl ?? null;

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-admin-line pt-4">
      <AdminFieldLabel label={photo === null ? '앱 팝업 이미지' : '바꿀 이미지 (미리보기)'} />
      {popups.isPending && <p className="text-sm text-admin-muted">이미지를 불러오는 중…</p>}
      {popups.isError && <p className="text-sm text-admin-muted">이미지를 불러오지 못했습니다.</p>}
      {popups.isSuccess && shownUrl === null && (
        <p className="text-sm text-admin-muted">등록된 이미지를 찾지 못했습니다.</p>
      )}
      {shownUrl !== null && (
        <img
          src={shownUrl}
          alt={popup?.title ?? '팝업 이미지'}
          className="max-h-80 w-fit max-w-full rounded-md border border-admin-line object-contain"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept="image/*"
          aria-label="새 팝업 이미지 선택"
          onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
          className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-admin-line/60 file:px-3 file:py-1.5 file:text-sm"
        />
        <AdminButton
          size="sm"
          disabled={photo === null || update.isPending}
          onClick={() => update.mutate()}
        >
          {update.isPending ? '바꾸는 중…' : '이미지 바꾸기'}
        </AdminButton>
      </div>
      <p className="text-xs text-admin-muted">
        5MB 이하 이미지 파일. 바꾸면 앱 팝업에 바로 반영됩니다.
      </p>
      {fileError && <p className="text-sm text-admin-danger-text">{fileError}</p>}
      {update.isError && (
        <p className="text-sm text-admin-danger-text">
          {update.error instanceof ApiError
            ? update.error.message
            : '이미지를 바꾸지 못했습니다. 다시 시도해 주세요.'}
        </p>
      )}
    </div>
  );
}
