import { useState } from 'react';
import { TopHeader } from '@/shared/ui/TopHeader';
import { RentGuideTab, ReturnGuideTab, SafetyGuideTab } from '@/features/mypage/components/guide/placeholderTabs';
import { TashuIntroTab } from '@/features/mypage/components/guide/TashuIntroTab';

/** 탭 구성 — Figma '이용안내 / Tabs' 기준. 탭별 콘텐츠는 독립 컴포넌트라 나눠서 작업 가능 */
const TABS = [
  { label: '타슈란', content: <TashuIntroTab /> },
  { label: '대여', content: <RentGuideTab /> },
  { label: '반납', content: <ReturnGuideTab /> },
  { label: '안전과 약속', content: <SafetyGuideTab /> },
] as const;

/** 34 이용안내 */
export function GuidePage() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="이용안내" />

      {/* 탭 바 */}
      <div role="tablist" className="flex border-b border-gray-100">
        {TABS.map((tab, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveIndex(i)}
              className={`min-h-12 flex-1 border-b-2 text-[15px] transition-[color,border-color] duration-150 ${
                active
                  ? 'border-primary font-bold text-primary'
                  : 'border-transparent font-medium text-gray-400 active:text-gray-500'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto pb-6">{TABS[activeIndex].content}</div>
    </div>
  );
}
