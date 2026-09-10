import { useNavigate } from 'react-router';
import { ListRow } from '@/shared/ui/ListRow';
import { TopHeader } from '@/shared/ui/TopHeader';

/** 타슈 관제센터 전화번호 (타슈 공식 공지 기준) */
const TASHU_TEL = '1899-2282';

/** 고객센터 (프로필 메뉴) — 타슈 앱 고객센터 구성을 우리 앱 스타일로 배치 */
export function SupportPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="고객센터" />

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* 전화 문의 카드 */}
        <section className="mt-2 flex items-center gap-4 rounded-2xl bg-primary-light p-5">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900">타슈 고객센터</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              (성수기 3월~11월) 07:00 ~ 24:00
              <br />
              (비수기 12월~2월) 07:00 ~ 22:00
            </p>
          </div>
          <a
            href={`tel:${TASHU_TEL}`}
            aria-label={`타슈 고객센터 전화 걸기 ${TASHU_TEL}`}
            className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm active:scale-[0.96]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary" fill="currentColor">
              <path d="M6.6 3.2c.6-.2 1.2 0 1.6.5l1.9 2.6c.4.6.4 1.4-.1 1.9l-1 1.1a12.6 12.6 0 0 0 5.7 5.7l1.1-1c.5-.5 1.3-.6 1.9-.1l2.6 1.9c.5.4.7 1 .5 1.6l-.6 1.9c-.2.7-.9 1.2-1.6 1.1C10.9 19.6 4.4 13.1 3.6 5.4c-.1-.7.4-1.4 1.1-1.6l1.9-.6Z" />
            </svg>
          </a>
        </section>

        {/* 메뉴 */}
        <ul className="mt-3 divide-y divide-gray-100">
          <li>
            <ListRow title="공지사항" onClick={() => navigate('/mypage/support/notices')} />
          </li>
          <li>
            <ListRow title="자주 묻는 질문" onClick={() => navigate('/mypage/support/faq')} />
          </li>
          <li>
            {/* 17-4 내 민원 내역 재사용 */}
            <ListRow title="나의 민원" onClick={() => navigate('/report/my')} />
          </li>
        </ul>
      </div>
    </div>
  );
}
