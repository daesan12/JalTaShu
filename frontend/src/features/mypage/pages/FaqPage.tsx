import { useState } from 'react';
import { Chip } from '@/shared/ui/Chip';
import { TopHeader } from '@/shared/ui/TopHeader';

/** 잘타슈 기준 FAQ — 타슈 정책 관련 내용은 확정된 사실만 담는다 */
const FAQS = [
  {
    category: '이용',
    q: '잘타슈에서 바로 대여·반납할 수 있나요?',
    a: '대여와 반납은 타슈 공식 앱에서 진행돼요. 잘타슈는 도착 시점의 자전거 잔여를 예측해서 "탈 수 있는 대여소"를 안내하고, 이동 경로와 자전거 상태 정보를 도와드리는 서비스예요.',
  },
  {
    category: '예측',
    q: '"도착 시 예상 N대"는 정확한 숫자인가요?',
    a: '과거 대여 패턴과 실시간 잔여량으로 계산한 예측값이라 실제와 다를 수 있어요. 표시된 대수가 있어도 자전거가 없을 수 있으니 참고 지표로 활용해 주세요.',
  },
  {
    category: '민원',
    q: '접수한 민원은 어디서 확인하나요?',
    a: '민원 탭의 "나의 민원 조회" 또는 고객센터의 "나의 민원"에서 처리 상태를 확인할 수 있어요.',
  },
  {
    category: '민원',
    q: '고장 신고를 하면 타슈에 전달되나요?',
    a: '고장·방치·기타 민원은 타슈 공식 민원으로 전달돼요. 자전거 상태 화면의 제보 표시는 다음 이용자를 위한 잘타슈 커뮤니티 기능이에요.',
  },
  {
    category: '계정',
    q: '닉네임은 어떻게 바꾸나요?',
    a: '마이 탭 > 프로필에서 "닉네임 변경" 버튼을 누르면 바꿀 수 있어요. (2~10자, 한글·영문·숫자)',
  },
  {
    category: '이용',
    q: '위치·카메라 권한을 거부했는데 다시 켜려면?',
    a: '브라우저(또는 휴대폰 설정)의 사이트 권한에서 위치와 카메라를 허용으로 바꾸면 돼요. 위치는 주변 대여소 안내, 카메라는 QR 스캔에만 사용해요.',
  },
] as const;

const CATEGORIES = ['전체', '이용', '예측', '민원', '계정'] as const;

/** 자주 묻는 질문 — 카테고리 칩 + 아코디언 */
export function FaqPage() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('전체');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = FAQS.filter((f) => category === '전체' || f.category === category);

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="자주 묻는 질문" />

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* 카테고리 필터 */}
        <div className="flex gap-2 overflow-x-auto pt-2 pb-1">
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              selected={category === c}
              onClick={() => {
                setCategory(c);
                setOpenIndex(null);
              }}
            >
              {c}
            </Chip>
          ))}
        </div>

        {/* 아코디언 */}
        <ul className="mt-2 divide-y divide-gray-100">
          {faqs.map((faq, i) => {
            const open = openIndex === i;
            return (
              <li key={faq.q}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="flex min-h-14 w-full items-start gap-2.5 py-4 text-left"
                >
                  <span className="font-bold text-primary">Q.</span>
                  <span className="flex-1 text-[15px] font-medium text-gray-900">{faq.q}</span>
                  <svg
                    viewBox="0 0 24 24"
                    className={`mt-0.5 h-5 w-5 shrink-0 text-gray-300 transition-[rotate] duration-200 ${open ? 'rotate-180' : ''}`}
                    fill="none"
                  >
                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {open && (
                  <p className="rounded-xl bg-background px-4 py-3.5 mb-4 text-[15px] leading-relaxed text-gray-600">
                    {faq.a}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
