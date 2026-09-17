import { AdminButton } from '@/features/admin/ui/AdminButton';

interface AdminDetailStateProps {
  isError: boolean;
  /** 실패했을 때의 문구 (예: "자전거 정보를 불러오지 못했습니다.") */
  errorText: string;
  onRetry: () => void;
}

/**
 * 상세 페이지 진입 쿼리의 로딩·실패 화면.
 * `if (detail.isPending || detail.isError) return <AdminDetailState … />` 한 줄로 쓴다.
 */
export function AdminDetailState({ isError, errorText, onRetry }: AdminDetailStateProps) {
  if (!isError) {
    return <p className="text-sm text-admin-muted">불러오는 중…</p>;
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-admin-muted">{errorText}</p>
      <AdminButton variant="secondary" size="sm" onClick={onRetry}>
        다시 시도
      </AdminButton>
    </div>
  );
}
