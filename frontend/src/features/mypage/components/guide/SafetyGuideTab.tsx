import type { ReactNode } from 'react';
import { GuideHeading } from '@/features/mypage/components/guide/GuideBlocks';

const s = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;
const cls = 'h-9 w-9';

/** 안전 수칙 8개 — 타슈 공식 안내 콘텐츠 */
const SAFETY_RULES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    title: '안전모 착용!',
    desc: '브레이크, 체인, 안장 높이도 확인해요.',
    icon: (
      <svg viewBox="0 0 36 36" className={cls}>
        <path d="M6 20a12 12 0 0 1 24 0v2H6v-2Z" {...s} />
        <path d="M18 8v14M24 22l3 6" {...s} />
      </svg>
    ),
  },
  {
    title: '교통법규 지키기!',
    desc: '자전거도 차예요. 보행자의 보호와 안전을 위해 과속하지 않아요.',
    icon: (
      <svg viewBox="0 0 36 36" className={cls}>
        <rect x="12" y="4" width="12" height="24" rx="4" {...s} />
        <circle cx="18" cy="10" r="1.8" {...s} />
        <circle cx="18" cy="16" r="1.8" {...s} />
        <circle cx="18" cy="22" r="1.8" {...s} />
        <path d="M18 28v4" {...s} />
      </svg>
    ),
  },
  {
    title: '음주 운전 금지!',
    desc: '잠깐의 방심이 사고를 불러와요.',
    icon: (
      <svg viewBox="0 0 36 36" className={cls}>
        <circle cx="18" cy="18" r="13" {...s} />
        <path d="M16 10h4v5l2 4v7h-8v-7l2-4v-5Z" {...s} />
        <path d="M9 9l18 18" {...s} />
      </svg>
    ),
  },
  {
    title: '2인 이상 동반 탑승 금지!',
    desc: '타슈는 1인용이에요. 2인 이상 탑승할 경우 사고 날 확률이 높아져요.',
    icon: (
      <svg viewBox="0 0 36 36" className={cls}>
        <circle cx="13" cy="14" r="4" {...s} />
        <circle cx="23" cy="14" r="4" {...s} />
        <path d="M6 28c1-5 4-7 7-7s6 2 7 7M20 21.5c2 .5 4.5 2.5 5.5 6.5" {...s} />
        <path d="M26 6l6 6M32 6l-6 6" {...s} />
      </svg>
    ),
  },
  {
    title: '눈, 비, 태풍에는 이용 자제!',
    desc: '길이 미끄러워 사고가 날지도 몰라요. 평소보다 감속 운전해요.',
    icon: (
      <svg viewBox="0 0 36 36" className={cls}>
        <path d="M13 6v12M7 9l12 6M19 9 7 15" {...s} />
        <path d="M22 22h9a3 3 0 1 0-3-5M6 27h20a3 3 0 1 1-3 5" {...s} />
      </svg>
    ),
  },
  {
    title: '횡단보도 주행 금지!',
    desc: '횡단보도에서는 자전거에서 내려서 끌고 가요.',
    icon: (
      <svg viewBox="0 0 36 36" className={cls}>
        <path d="M18 5 22 13H14l4-8ZM18 8.5v2" {...s} />
        <path d="M8 20v10M14.5 20v10M21.5 20v10M28 20v10" {...s} />
      </svg>
    ),
  },
  {
    title: '짐받이 바구니가 너무 무겁지 않게!',
    desc: '짐받이 바구니에 너무 무거운 물건을 실으면 자전거 조종이 어려워요.',
    icon: (
      <svg viewBox="0 0 36 36" className={cls}>
        <path d="M7 14h22l-3 14H10L7 14Z" {...s} />
        <path d="M13 14l3-7M23 14l-3-7M14 19v5M18 19v5M22 19v5" {...s} />
      </svg>
    ),
  },
  {
    title: '타슈는 일반 생활용!',
    desc: '경주, 산악등반, 자전거 묘기 등 특수 목적을 위해 사용해선 안 돼요.',
    icon: (
      <svg viewBox="0 0 36 36" className={cls}>
        <circle cx="11" cy="24" r="5" {...s} />
        <circle cx="27" cy="24" r="5" {...s} />
        <path d="M11 24 16 14h6l5 10M16 14l4 10" {...s} />
        <path d="M6 6l24 24" {...s} />
      </svg>
    ),
  },
];

/** 타슈의 약속 4개 */
const PROMISES = [
  '보다 많은 사람들이 타슈를 이용할 수 있도록 기본 이용 시간을 지켜주세요.',
  '기본 이용 시간 내에 자전거를 반납한다면 다시 대여하여 타슈를 이용할 수도 있어요.',
  '대여소 시설물을 고의로 훼손하거나 타슈를 분실/절도할 경우 관련 규정에 따라 위약금이 부과돼요.',
  '자전거 이용 중 위법, 부당한 행위로 손실 및 비용이 발생한다면 이용자가 부담해야 해요.',
];

/** 이용안내 > 안전과 약속 — 타슈 공식 안내 콘텐츠 */
export function SafetyGuideTab() {
  return (
    <div>
      <GuideHeading title="안전 운전! 꼭 지켜주세요." tags="#안전운전 #안전수칙 #꼭_지켜요" />

      <ul className="mt-8 space-y-7 px-6 pb-10">
        {SAFETY_RULES.map((rule) => (
          <li key={rule.title} className="flex items-start gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-background text-primary">
              {rule.icon}
            </span>
            <div className="min-w-0 pt-1.5">
              <p className="font-bold text-gray-900">{rule.title}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-gray-500">{rule.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* 타슈의 약속 */}
      <section className="bg-primary-light/60 px-6 py-10">
        <div className="text-center">
          <h3 className="text-xl font-bold text-primary">타슈의 약속! 함께 지켜요.</h3>
          <p className="mt-1.5 text-[15px] text-gray-500">#책임 #의무 #모두_같이_지켜요</p>
        </div>
        <ol className="mt-8">
          {PROMISES.map((promise, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-2 border-primary bg-surface leading-none">
                  <span className="text-[11px] font-bold text-primary">Check</span>
                  <span className="tabular-nums mt-0.5 text-sm font-bold text-primary">
                    0{i + 1}
                  </span>
                </span>
                {i < PROMISES.length - 1 && <span className="w-0.5 flex-1 bg-primary/30" />}
              </div>
              <p className="pt-3 pb-7 text-[15px] leading-relaxed text-gray-700">{promise}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
