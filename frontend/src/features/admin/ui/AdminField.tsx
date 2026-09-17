import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

/**
 * 관리자 입력 컨트롤이 전부 같이 쓰는 껍데기(테두리·배경·포커스 링).
 * 크기(h-*·px-*·py-*)는 쓰는 쪽이 붙인다 — 필터 줄은 h-9, 로그인은 h-11, 모달 입력은 py-2.
 */
export const ADMIN_FIELD_FRAME =
  'rounded-md border border-admin-line bg-admin-bg text-sm text-admin-text ' +
  'placeholder:text-admin-muted focus:border-admin-indicator focus:ring-1 focus:ring-admin-indicator focus:outline-none';

/** 모달 안 한 줄 입력 */
export function AdminInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`w-full px-3 py-2 ${ADMIN_FIELD_FRAME} ${className}`} {...props} />;
}

/** 모달 안 여러 줄 입력 — 최소 높이는 쓰는 쪽이 min-h-*로 준다 */
export function AdminTextarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={`w-full resize-y px-3 py-2 ${ADMIN_FIELD_FRAME} ${className}`} {...props} />
  );
}

interface AdminFieldLabelProps {
  label: string;
  /** count·max를 함께 주면 오른쪽에 "12/100" 카운터가 붙는다 */
  count?: number;
  max?: number;
}

/** 입력칸 위 라벨 줄 */
export function AdminFieldLabel({ label, count, max }: AdminFieldLabelProps) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <span className="text-sm font-medium">{label}</span>
      {count !== undefined && max !== undefined && (
        <span className="text-xs text-admin-muted tabular-nums">
          {count}/{max}
        </span>
      )}
    </div>
  );
}
