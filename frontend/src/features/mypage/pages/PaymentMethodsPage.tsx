import { useState } from 'react';
import { TopHeader } from '@/shared/ui/TopHeader';

/**
 * 결제수단 (프로필 메뉴) — 타슈 앱 결제수단 화면 참고.
 * 등록 플로우는 결제(PG) 연동 방식 확정 후 구현 — 지금은 빈 상태 + 안내만.
 */
export function PaymentMethodsPage() {
  const [notice, setNotice] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="결제수단" />

      {/* 안내 배너 */}
      <div className="flex items-start gap-4 bg-background px-5 py-5">
        {/* 지갑 아이콘 */}
        <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0" aria-hidden>
          <rect x="4" y="12" width="40" height="28" rx="5" fill="#3b82f6" />
          <rect x="4" y="18" width="40" height="4" fill="#2563eb" />
          <circle cx="20" cy="12" r="7" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" />
          <rect x="32" y="23" width="12" height="8" rx="2" fill="#93c5fd" />
        </svg>
        <p className="text-[15px] leading-relaxed text-gray-600">
          등록된 결제수단은 이용권 및 추가요금 등의 결제 시 사용되며, 요금이 청구되면 등록된
          결제수단을 통해 <span className="font-medium text-blue-500">비용 결제</span>가
          이루어집니다.
        </p>
      </div>

      <div className="flex-1 px-5 pt-6">
        {/* 등록된 결제수단이 없을 때: 점선 추가 카드 (타슈 앱과 동일한 빈 상태) */}
        <button
          type="button"
          onClick={() => setNotice(true)}
          className="flex min-h-24 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-background text-[17px] font-medium text-gray-700 active:bg-gray-100"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-status-mid text-lg font-bold text-white">
            +
          </span>
          결제수단 추가
        </button>

        {notice && (
          <p className="mt-4 text-center text-sm text-gray-400">
            결제수단 등록은 결제 연동 준비 중이에요. 조금만 기다려 주세요!
          </p>
        )}
      </div>
    </div>
  );
}
