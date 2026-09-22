import { useState } from 'react';
import { TopHeader } from '@/shared/ui/TopHeader';

/**
 * 타슈 공식 안내 기준 FAQ.
 *
 * 대여·반납·요금은 **타슈 운영 정책**이라 우리가 문구를 지어내면 안 된다 —
 * 공식 앱의 안내를 그대로 옮겨 적어 두 앱의 설명이 어긋나지 않게 한다.
 * 줄바꿈이 그대로 보여야 해서 답변은 `whitespace-pre-line`으로 렌더한다.
 */
const FAQS = [
  {
    category: '대여/반납',
    q: '자전거를 대여한 곳에만 반납해야 하나요?',
    a: `아닙니다. 자전거를 대여한 곳에 꼭 반납하실 필요는 없습니다. 자전거를 이용하신 후 가까운 타슈 대여소에서 반납이 가능합니다.
예를 들어 대전시청에서 자전거를 대여하여 타임월드 방향으로 이동하였다면 타임월드 근처에 있는 타슈 대여소에 반납하시면 됩니다.`,
  },
  {
    category: '대여/반납',
    q: '대여소란 무엇인가요?',
    a: `대여소는 공영자전거 타슈를 대여하고 반납하는 무인대여소입니다.
타슈 앱에서 대여소의 위치를 확인해보세요.`,
  },
  {
    category: '이용안내',
    q: '자가잠금기능이 무엇인가요?',
    a: '자전거 이용 중 자전거를 세워두고 다른 일을 보실 때, 자전거 분실 및 도난을 방지하기 위해 잠시 자전거를 잠금하는 기능입니다. 이용시간으로 인정되어 추가 사용료가 발생될 수 있습니다. 잠그는 위치가 대여소면 반납처리 됩니다.',
  },
  {
    category: '대여/반납',
    q: '자전거 반납은 어떻게 하나요?',
    a: `반납할 자전거를 대여소에 세워두고 잠금장치를 잠그면 반납이 됩니다.

1. 반납이 정상적으로 완료되었을 경우 정상적으로 반납되었음을 알리는 휴대폰으로 반납완료 알림이 발송됩니다.

2. 잠금장치의 GPS 오차로 반납되지 않는 경우 앱의 "반납이 안돼요" 메뉴로 반납하실 수 있으며 해당 기능은 휴대폰의 GPS를 활용하여 정확도가 대폭 향상됩니다.

3. "반납이 안돼요" 메뉴로도 반납되지 않으면 대여소와 자전거가 보이도록 사진을 촬영한 뒤 반납 요청하실 수 있으며, 등록해주신 사진과 위치정보를 관리자가 확인 후 이상이 없다면 반납처리 합니다.`,
  },
  {
    category: '이용안내',
    q: '자전거를 이용하고 싶은데 어떻게 해야 하나요?',
    a: `만 15세 이상이라면 누구나 공영자전거를 이용하실 수 있습니다. 스마트폰의 QR 단말기 전용앱을 설치하고 휴대폰 인증하시면 대여하실 수 있습니다.

◆ 앱을 이용한 대여
① 스마트폰의 앱을 실행
② 스마트폰의 위치, 블루투스 기능을 켜기
③ 메인화면에서 대여하기 버튼 터치
④ 단말기의 QR코드 스캔
⑤ 스마트폰과 단말기 사이의 블루투스 통신으로 대여시작`,
  },
  {
    category: '회원정보',
    q: '회원인데 휴대폰 번호가 변경되었습니다. 어떻게 해야 하나요?',
    a: `공영자전거 타슈는 본인 휴대폰 인증에 기반을 둔 시스템입니다.
휴대폰 번호가 변경되었다면 바뀐 휴대폰 번호로 앱에서 새로 인증하시면 됩니다.
변경된 정보를 갱신하지 않아서 발생되는 불이익은 고객에게 책임이 있음을 알려드립니다.`,
  },
  {
    category: '운영 및 정책',
    q: '추가 사용료가 부과될 수 있나요?',
    a: `기본이용시간 1시간을 초과하여 이용하시면 30분당 500원의 추가 사용료가 부과됩니다.
추가 사용료는 1일 1회당 최대 5,000원까지 부과되며 1시간이내에 반납하시고 다시 대여하시면 추가 사용료가 발생되지 않습니다.
여러번 대여하셔도 이용시간은 누적되지 않습니다.`,
  },
  {
    category: '이용안내',
    q: '앱에서 대여하기 버튼을 눌렀으나 대여 신청이 안돼요.',
    a: `고객님의 스마트폰의 블루투스 기능이 활성화 되어 있는지 확인해주세요.
또한 단말기에 배터리가 없거나 장치에 문제가 있는 경우, 대여오류가 발생될 수 있습니다.`,
  },
] as const;

/**
 * 타슈 공식 앱의 분류를 그대로 쓴다 — 항목이 하나도 없는 분류(결제/환불 등)도 그대로 둔다.
 * 공식 앱에도 비어 있고, 우리가 임의로 빼면 두 앱의 목차가 달라진다.
 */
const CATEGORIES = [
  '전체',
  '이용안내',
  '대여/반납',
  '결제/환불',
  '운영 및 정책',
  '회원정보',
  '자전거/시설관리',
  '기타',
] as const;

type Category = (typeof CATEGORIES)[number];

/** 자주 묻는 질문 — 카테고리 드롭다운 + 아코디언 */
export function FaqPage() {
  const [category, setCategory] = useState<Category>('전체');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = FAQS.filter((f) => category === '전체' || f.category === category);

  function pick(next: Category) {
    setCategory(next);
    setPickerOpen(false);
    // 분류가 바뀌면 목록이 통째로 달라진다 — 펼쳐 둔 답변을 접어 위치를 잃지 않게 한다
    setOpenIndex(null);
  }

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="자주 묻는 질문" />

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* 카테고리 드롭다운 — 분류가 8개라 칩을 가로로 늘어놓으면 화면을 넘어간다 */}
        <div className="pt-3">
          <button
            type="button"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
            className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-primary px-4 font-bold text-primary"
          >
            {category}
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={`h-4 w-4 transition-[rotate] duration-200 ${pickerOpen ? 'rotate-180' : ''}`}
              fill="none"
            >
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* 답변 펼침과 같은 방식 — 목록 높이를 브라우저가 재게 해서 항목 수가 달라져도 맞는다 */}
          <div
            aria-hidden={!pickerOpen}
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              pickerOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="overflow-hidden">
              <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-surface">
                {CATEGORIES.map((c) => (
                  <li key={c}>
                    <button
                      type="button"
                      onClick={() => pick(c)}
                      className={`min-h-12 w-full px-4 text-[15px] ${
                        c === category ? 'font-bold text-primary' : 'text-gray-600'
                      }`}
                    >
                      {c}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 항목이 없는 분류(결제/환불 등)는 공식 앱에선 빈 화면이지만, 빈 화면은 오류처럼 보인다 */}
        {faqs.length === 0 && (
          <p className="pt-10 text-center text-sm text-gray-400">
            이 분류에는 아직 등록된 질문이 없어요.
          </p>
        )}

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
                    className={`mt-0.5 h-5 w-5 shrink-0 text-gray-300 transition-[rotate] duration-300 ${open ? 'rotate-180' : ''}`}
                    fill="none"
                  >
                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {/*
                  펼침 애니메이션 — 답변 길이가 제각각이라 높이를 고정할 수 없다.
                  grid 행을 0fr↔1fr로 바꾸면 브라우저가 내용 높이를 스스로 재서 그 사이를 그린다
                  (max-height 어림값처럼 긴 답변이 잘리거나 짧은 답변이 늦게 열리는 일이 없다).
                  닫힌 동안에도 DOM에 남아야 애니메이션이 가능하므로 보조기기에선 숨긴다.
                */}
                <div
                  aria-hidden={!open}
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="mb-4 rounded-xl bg-background px-4 py-3.5 text-[15px] leading-relaxed whitespace-pre-line text-gray-600">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
