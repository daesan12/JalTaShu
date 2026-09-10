import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CategoryGrid } from '@/features/report/components/CategoryGrid';
import { ReportForm } from '@/features/report/components/ReportForm';
import type { ReportType } from '@/features/report/api/reports';

const REPORT_TYPES: ReportType[] = ['broken', 'abandoned', 'inquiry'];

/**
 * 17-0 ~ 17-3 자전거·민원 — 한 화면의 연속 흐름.
 * 상단(고객센터 배너·자전거 상태 확인·카테고리)은 항상 유지되고,
 * 카테고리를 선택하면 아래에 폼이 열리며 그 위치로 스크롤된다 (위로 올리면 QR 카드가 그대로 보임).
 * 스캔 복귀는 `?type=...&code=...` 쿼리로 받는다.
 */
export function ReportPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const formRef = useRef<HTMLDivElement>(null);

  const typeParam = searchParams.get('type');
  const type = REPORT_TYPES.includes(typeParam as ReportType) ? (typeParam as ReportType) : null;
  const code = searchParams.get('code') ?? '';

  // 카테고리 선택(또는 스캔 복귀) 시 폼 위치로 스크롤
  useEffect(() => {
    if (type) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [type]);

  const selectType = (next: ReportType) => {
    setSearchParams({ type: next }, { replace: true }); // 카테고리 전환 시 code는 초기화
  };

  const goScan = () => {
    if (!type) return;
    navigate(`/report/scan?next=${encodeURIComponent(`/report?type=${type}`)}`);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-gray-100 px-5 pt-5 pb-4">
        <h1 className="text-[22px] font-bold text-gray-900">자전거 · 민원</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* 고객센터 배너 */}
        <div className="flex items-center gap-3 bg-background px-5 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-lg font-bold text-gray-300">
            ?
          </span>
          <p className="text-sm leading-snug text-gray-700">
            <span className="block font-semibold text-gray-900">문제가 생기셨나요?</span>
            <button
              type="button"
              onClick={() => navigate('/mypage/support')}
              className="font-medium text-blue-500"
            >
              고객센터
            </button>
            에서 언제든 도와드릴게요.
          </p>
        </div>

        <div className="px-5">
          {/* 자전거 상태 확인 → QR 스캔 → 18 자전거 상태 */}
          <button
            type="button"
            onClick={() => navigate('/report/scan')}
            className="mt-5 flex w-full items-center gap-4 rounded-2xl border-2 border-primary bg-primary-light p-4 text-left active:scale-[0.99]"
          >
            <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-surface text-lg font-extrabold text-primary shadow-sm">
              QR
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold text-gray-900">자전거 상태 확인</span>
              <span className="mt-0.5 block text-sm text-gray-600">
                QR 스캔으로 자전거 상태와 이용자 제보를 확인해요
              </span>
            </span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-400" fill="none">
              <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h2 className="mt-6 text-[17px] font-bold text-gray-900">민원 내용을 선택해주세요</h2>
          <div className="mt-4">
            <CategoryGrid
              selected={type}
              onSelect={selectType}
              onMyReports={() => navigate('/report/my')}
            />
          </div>

          {!type && (
            <p className="mt-5 text-sm leading-relaxed text-gray-400">
              고장·방치·기타 민원은 타슈 공식 민원으로 전달돼요. 자전거 상태·제보는 잘타슈 커뮤니티
              기능입니다.
            </p>
          )}

          {/* key=type: 카테고리 전환 시 폼 입력값 초기화. scroll-mt로 스크롤 시 제목이 가려지지 않게 */}
          {type && (
            <div ref={formRef} className="scroll-mt-4">
              <ReportForm key={type} type={type} initialCode={code} onScan={goScan} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
