import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/** 03-a 제보 상세는 넓고, 06-a 삭제 확인은 좁다 */
type AdminModalSize = 'sm' | 'md' | 'lg';

interface AdminModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** 하단 버튼 줄. 없으면 그 영역 자체를 그리지 않는다 */
  footer?: ReactNode;
  size?: AdminModalSize;
  children: ReactNode;
}

const SIZE_CLASS: Record<AdminModalSize, string> = {
  sm: 'w-100', // 06-a 공지 삭제 확인
  md: 'w-130', // 09-c 이용 정지 · 09-d 정지 해제
  lg: 'w-180', // 03-a 제보 상세
};

/**
 * 껍데기만 있는 모달. 안에 뭘 넣을지는 쓰는 화면이 정한다.
 *
 * 직접 만들지 않고 <dialog>를 쓴다. ESC로 닫기, 포커스 가두기, 뒤 배경 클릭 막기를
 * 브라우저가 해 주므로 손으로 구현할 게 없다.
 * m-auto는 필수다 — Tailwind preflight가 margin:0을 걸어 <dialog>의 기본 가운데 정렬을 지운다.
 */
export function AdminModal({
  open,
  onClose,
  title,
  footer,
  size = 'md',
  children,
}: AdminModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // 바깥 클릭으로 닫기 — 안쪽 요소를 누르면 target이 dialog가 아니라 그 요소다
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className={`${SIZE_CLASS[size]} m-auto max-w-[calc(100vw-4rem)] rounded-xl border border-admin-line bg-admin-bg p-0 text-admin-text backdrop:bg-black/40`}
    >
      <header className="flex items-center justify-between border-b border-admin-line px-5 py-4">
        <h3 className="font-semibold">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="-mr-1 rounded-md px-2 py-1 text-lg text-admin-muted transition-colors hover:bg-admin-panel hover:text-admin-text"
        >
          ×
        </button>
      </header>
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <footer className="flex justify-end gap-2 border-t border-admin-line px-5 py-4">
          {footer}
        </footer>
      )}
    </dialog>
  );
}
