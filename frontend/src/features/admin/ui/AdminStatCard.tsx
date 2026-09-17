import type { ReactNode } from 'react';

interface AdminStatCardProps {
  label: string;
  /** 아직 값이 없으면 '–'를 넘긴다 */
  value: ReactNode;
  /** 숫자에 역할 색을 줄 때 (예: text-admin-danger-text) */
  valueClass?: string;
  /** 어제 대비 증감 — 있으면 sub 대신 표시하고 부호에 따라 색을 정한다 */
  delta?: number;
  /** 값 아래 보조 설명 한 줄 */
  sub?: string;
}

/** 목록·상세 상단의 통계 카드. 네 화면이 같은 카드를 쓰므로 여기 한 벌만 둔다 */
export function AdminStatCard({ label, value, valueClass = '', delta, sub }: AdminStatCardProps) {
  return (
    <div className="rounded-lg bg-admin-panel px-5 py-4">
      <p className="text-sm text-admin-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {delta !== undefined ? (
        <p
          className={`mt-1 text-xs tabular-nums ${
            delta > 0
              ? 'text-admin-ok-text'
              : delta < 0
                ? 'text-admin-danger-text'
                : 'text-admin-muted'
          }`}
        >
          어제 대비 {delta > 0 ? `+${delta}` : delta}건
        </p>
      ) : (
        sub && <p className="mt-1 text-xs text-admin-muted">{sub}</p>
      )}
    </div>
  );
}
