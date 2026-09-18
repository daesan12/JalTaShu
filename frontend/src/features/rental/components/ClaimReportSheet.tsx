import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import {
  CLAIM_REPORT_CATEGORIES,
  reportCycleClaim,
  type BikeReport,
  type ClaimReportCategory,
} from '@/features/rental/api/bikes';
import { DAILY_REPORT_LIMIT } from '@/features/rental/lib/claimReportLimit';

/** 사유를 안 고른 채 열리지 않도록 첫 항목을 기본 선택으로 둔다 (디자인도 선택된 상태) */
const DEFAULT_CATEGORY: ClaimReportCategory = 'FALSE_INFORMATION';

interface ClaimReportSheetProps {
  /** 신고 대상 제보 — null이면 시트가 닫힌 상태 */
  target: BikeReport | null;
  /** 어느 자전거의 제보인지 (시트 부제에 표시) */
  bikeCode: string;
  /** 오늘 이미 신고한 건수 */
  usedCount: number;
  onClose: () => void;
  /** 접수 성공 — 부모가 기록·시트 닫기를 처리한다 */
  onReported: (claimId: number) => void;
}

/** 18·20 제보 카드의 "신고" — 남의 제보가 잘못됐을 때 사유를 골라 접수한다 */
export function ClaimReportSheet({
  target,
  bikeCode,
  usedCount,
  onClose,
  onReported,
}: ClaimReportSheetProps) {
  const [category, setCategory] = useState<ClaimReportCategory>(DEFAULT_CATEGORY);

  const mutation = useMutation({
    mutationFn: (claimId: number) => reportCycleClaim(claimId, category),
    onSuccess: (_data, claimId) => {
      close();
      onReported(claimId);
    },
  });

  /** 닫을 때마다 사유·에러를 처음 상태로 — 다음에 열면 새 신고다 */
  function close() {
    setCategory(DEFAULT_CATEGORY);
    mutation.reset();
    onClose();
  }

  const serverError =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? '신고에 실패했어요. 잠시 후 다시 시도해 주세요.'
        : null;

  return (
    <BottomSheet open={target !== null} snapPoint="half" onClose={close}>
      <div className="flex h-full flex-col pb-4">
        <h2 className="text-xl font-bold text-gray-900">이 제보를 신고할까요?</h2>
        {target && (
          <p className="mt-1.5 truncate text-sm text-gray-500">
            {bikeCode} · &ldquo;{target.content}&rdquo;
          </p>
        )}

        <fieldset className="mt-4 flex-1 overflow-y-auto">
          <legend className="sr-only">신고 사유</legend>
          {CLAIM_REPORT_CATEGORIES.map(({ value, label }) => (
            <label
              key={value}
              className="flex min-h-13 cursor-pointer items-center gap-3 text-[17px] text-gray-900"
            >
              <input
                type="radio"
                name="claim-report-category"
                value={value}
                checked={category === value}
                onChange={() => setCategory(value)}
                className="size-5 accent-primary"
              />
              {label}
            </label>
          ))}
        </fieldset>

        {serverError ? (
          <p className="mt-2 text-sm text-status-low">{serverError}</p>
        ) : (
          <p className="mt-2 text-xs text-gray-400">
            하루 {DAILY_REPORT_LIMIT}건까지 신고할 수 있어요 (오늘 {usedCount}/
            {DAILY_REPORT_LIMIT})
          </p>
        )}

        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={close}
            className="min-h-13 flex-1 rounded-xl border border-gray-200 font-semibold text-gray-700 transition-[background-color] duration-75 active:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={target === null || mutation.isPending}
            onClick={() => target && mutation.mutate(target.claimId)}
            className="min-h-13 flex-1 rounded-xl bg-status-low font-semibold text-white transition-[background-color] duration-75 active:bg-red-600 disabled:opacity-40"
          >
            {mutation.isPending ? '접수 중…' : '신고하기'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
