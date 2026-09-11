import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ListRow } from '@/shared/ui/ListRow';
import { TopHeader } from '@/shared/ui/TopHeader';
import { BikeDiagram } from '@/features/rental/components/BikeDiagram';

/** to가 없는 항목은 콘텐츠 확정 전 (자전거 보험·Open API) */
const MENUS: { label: string; to?: string }[] = [
  { label: '추천 코스', to: '/mypage/bike-info/courses' },
  { label: '자전거 보험' },
  { label: 'Open API' },
];

/** 자전거 정보 (프로필 메뉴) — 타슈 앱의 메뉴 구성을 우리 앱 스타일로 배치 */
export function BikeInfoPage() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="자전거 정보" />

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* 히어로 — 브랜드 톤 + 자전거 다이어그램 일러스트 재사용 */}
        <section className="mt-2 rounded-2xl bg-primary-light px-6 pt-5 pb-2">
          <p className="text-sm font-medium text-primary">대전 공영자전거</p>
          <p className="mt-0.5 text-lg font-bold text-gray-900">타슈, 이렇게 이용해요</p>
          <BikeDiagram highlighted={[]} decorative className="mx-auto mt-2 max-w-60" />
        </section>

        {/* 메뉴 */}
        <ul className="mt-3 divide-y divide-gray-100">
          {MENUS.map((menu) => (
            <li key={menu.label}>
              <ListRow
                title={menu.label}
                onClick={() => (menu.to ? navigate(menu.to) : setNotice(menu.label))}
              />
            </li>
          ))}
        </ul>

        {notice && (
          <p className="mt-4 text-center text-sm text-gray-400">
            &lsquo;{notice}&rsquo; 콘텐츠 연결을 준비 중이에요.
          </p>
        )}
      </div>
    </div>
  );
}
