import { ELLIPSIS, getPageItems } from '@/shared/lib/pagination';

/** 관리자 목록 표의 공통 페이지 크기 */
export const ADMIN_PAGE_SIZE = 12;

interface AdminPaginationProps {
  /** 1부터 시작 */
  page: number;
  pageSize: number;
  totalCount: number;
  onChange: (page: number) => void;
}

const CELL = 'h-8 min-w-8 rounded-md px-2 text-sm transition-colors';
const IDLE = 'text-admin-muted hover:bg-admin-panel hover:text-admin-text';

/** "366건 중 1–12 표시" + 페이지 버튼. 페이지 번호 계산은 shared/lib/pagination에서 가져온다. */
export function AdminPagination({ page, pageSize, totalCount, onChange }: AdminPaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <p className="text-admin-muted tabular-nums">
        {totalCount === 0
          ? '표시할 내용이 없습니다'
          : `${totalCount.toLocaleString()}건 중 ${first.toLocaleString()}–${last.toLocaleString()} 표시`}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={`${CELL} ${IDLE} disabled:pointer-events-none disabled:opacity-30`}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="이전 페이지"
        >
          ‹
        </button>
        {getPageItems(page, totalPages).map((item, index) =>
          item === ELLIPSIS ? (
            // 말줄임은 값이 서로 같아 번호 대신 위치를 key로 쓴다
            <span key={`gap-${index}`} className="px-1 text-admin-muted">
              {ELLIPSIS}
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`${CELL} tabular-nums ${
                item === page ? 'bg-admin-primary font-medium text-white' : IDLE
              }`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className={`${CELL} ${IDLE} disabled:pointer-events-none disabled:opacity-30`}
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="다음 페이지"
        >
          ›
        </button>
      </div>
    </div>
  );
}
