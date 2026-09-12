import { useState } from 'react';
import { TopHeader } from '@/shared/ui/TopHeader';
import { BIKE_ROADS, COURSES } from '@/features/mypage/lib/coursesData';

/** 알약형 코스 선택 셀렉트 (모바일 네이티브 피커 사용) */
function CourseSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: number;
  onChange: (index: number) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="코스 선택"
        className="min-h-13 w-full appearance-none rounded-full border-2 border-primary bg-surface px-6 text-center font-bold text-primary focus:outline-none"
      >
        {options.map((name, i) => (
          <option key={name} value={i}>
            {name}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 right-5 h-5 w-5 -translate-y-1/2 text-primary"
        fill="none"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** 코스 정보 표 (코스정보·총 거리·소요시간) */
function CourseInfoBox({ route, distance, duration }: { route: string; distance: string; duration: string }) {
  const rows = [
    { label: '코스정보', value: route },
    { label: '총 거리', value: distance },
    { label: '소요시간', value: duration },
  ];
  return (
    <dl className="space-y-4 rounded-2xl bg-background px-5 py-6">
      {rows.map((row) => (
        <div key={row.label} className="flex gap-4">
          <dt className="flex shrink-0 items-baseline gap-2 font-semibold text-gray-900">
            <span aria-hidden className="h-1.5 w-1.5 rounded-xs bg-primary" />
            {row.label}
          </dt>
          <dd className="min-w-0 leading-relaxed whitespace-pre-line text-gray-600">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GraySection({ title, children }: { title: string; children: string }) {
  return (
    <section className="mt-8">
      <h3 className="text-[17px] font-bold text-primary">{title}</h3>
      <p className="mt-3 rounded-2xl bg-background px-5 py-5 leading-relaxed whitespace-pre-line text-gray-600">
        {children}
      </p>
    </section>
  );
}

const TABS = ['코스정보', '자전거 길 3선'] as const;

/** 추천 코스 (자전거 정보 하위) — 타슈 앱 추천코스 콘텐츠를 잘타슈 스타일로 구성 */
export function RecommendedCoursesPage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [courseIndex, setCourseIndex] = useState(0);
  const [roadIndex, setRoadIndex] = useState(0);

  const course = COURSES[courseIndex];
  const road = BIKE_ROADS[roadIndex];

  return (
    <div className="flex h-full flex-col">
      <TopHeader title="추천 코스" />

      {/* 탭 바 */}
      <div role="tablist" className="flex border-b border-gray-100">
        {TABS.map((label, i) => {
          const active = i === tabIndex;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTabIndex(i)}
              className={`min-h-12 flex-1 border-b-2 text-[15px] transition-[color,border-color] duration-150 ${
                active
                  ? 'border-primary font-bold text-primary'
                  : 'border-transparent font-medium text-gray-400 active:text-gray-500'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-8">
        {tabIndex === 0 ? (
          <>
            <CourseSelect
              options={COURSES.map((c) => c.name)}
              value={courseIndex}
              onChange={setCourseIndex}
            />
            <h2 className="mt-7 text-center text-xl font-bold text-primary">{course.name}</h2>
            <div className="mt-5">
              <CourseInfoBox route={course.route} distance={course.distance} duration={course.duration} />
            </div>
            {/* 타슈 앱의 코스 지도 일러스트 자리 — 자체 일러스트 확보 후 교체 */}
            <div className="mt-6 flex h-56 items-center justify-center rounded-2xl bg-primary-light/60 text-sm text-gray-400">
              코스 지도 자리
            </div>
          </>
        ) : (
          <>
            <CourseSelect
              options={BIKE_ROADS.map((r) => r.name)}
              value={roadIndex}
              onChange={setRoadIndex}
            />
            <div className="mt-7 flex items-center gap-2.5">
              <span className="rounded-lg bg-primary px-2.5 py-1 text-sm font-bold text-white">
                {road.badge}
              </span>
              <h2 className="text-xl font-bold text-primary">{road.title}</h2>
            </div>
            <p className="mt-4 leading-loose text-gray-700">{road.description}</p>

            <section className="mt-8">
              <h3 className="text-[17px] font-bold text-primary">여행코스</h3>
              <div className="mt-3">
                <CourseInfoBox route={road.route} distance={road.distance} duration={road.duration} />
              </div>
            </section>
            <GraySection title="찾아가는 길">{road.directions}</GraySection>
            <GraySection title="여행 TIP">{road.tip}</GraySection>
          </>
        )}
      </div>
    </div>
  );
}
