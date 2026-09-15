import { TopHeader } from '@/shared/ui/TopHeader';
import {
  INSURANCE_BASICS,
  INSURANCE_CONTACT,
  INSURANCE_COVERAGES,
  INSURANCE_DOCUMENTS,
  INSURANCE_INTRO,
} from '@/features/mypage/lib/insuranceData';

/** 섹션 구분 알약 배지 */
function SectionBadge({ children }: { children: string }) {
  return (
    <div className="mt-10 mb-5 text-center">
      <span className="rounded-full bg-primary px-5 py-2 font-bold text-white">{children}</span>
    </div>
  );
}

/** 자전거 보험 (자전거 정보 하위) — 대전시 시민 자전거보험 안내 (타슈 앱 콘텐츠) */
export function BikeInsurancePage() {
  return (
    <div className="flex h-full flex-col">
      <TopHeader title="자전거 보험" />

      <div className="flex-1 overflow-y-auto pb-10">
        {/* 안내 배너 */}
        <div className="bg-primary-light/60 px-5 py-6">
          <h2 className="text-lg font-bold text-primary">{INSURANCE_INTRO.title}</h2>
          <p className="mt-3 leading-relaxed text-gray-600">{INSURANCE_INTRO.description}</p>
        </div>

        <div className="px-5">
          {/* 기본정보 */}
          <SectionBadge>기본정보</SectionBadge>
          <dl className="space-y-5">
            {INSURANCE_BASICS.map((item) => (
              <div key={item.label}>
                <dt className="text-[17px] font-bold text-primary">{item.label}</dt>
                <dd className="mt-1.5 leading-relaxed text-gray-700">{item.value}</dd>
              </div>
            ))}
          </dl>

          {/* 보장내용 */}
          <SectionBadge>보장내용</SectionBadge>
          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <div className="grid grid-cols-[104px_1fr] border-b-2 border-gray-800 bg-background text-center font-bold text-gray-900">
              <div className="px-2 py-3">보장명</div>
              <div className="border-l border-gray-200 px-3 py-3">보험금 지급사유</div>
            </div>
            {INSURANCE_COVERAGES.map((coverage) => (
              <div
                key={coverage.name}
                className="grid grid-cols-[104px_1fr] border-b border-gray-200 text-sm last:border-b-0"
              >
                <div className="px-2.5 py-4 font-semibold break-keep text-gray-900">
                  {coverage.name}{' '}
                  {coverage.note && (
                    <span className="font-semibold text-status-mid">{coverage.note}</span>
                  )}
                </div>
                <div className="border-l border-gray-200 px-3 py-4 leading-relaxed whitespace-pre-line text-gray-600">
                  {coverage.detail}
                  {coverage.highlight && (
                    <p className="mt-1 font-semibold text-status-mid">{coverage.highlight}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 첨부서류 */}
          <SectionBadge>보험금 지급사유별 첨부서류</SectionBadge>
          <dl className="space-y-6">
            {INSURANCE_DOCUMENTS.map((doc) => (
              <div key={doc.label}>
                <dt className="text-[17px] font-bold text-primary">{doc.label}</dt>
                <dd className="mt-1.5 leading-relaxed whitespace-pre-line text-gray-700">
                  {doc.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* 문의 */}
          <div className="mt-10 rounded-2xl border border-gray-200 px-5 py-6 text-center">
            <p className="text-gray-600">{INSURANCE_CONTACT.guide}</p>
            <p className="tabular-nums mt-3 font-bold break-all text-gray-900">
              Tel : <a href={`tel:${INSURANCE_CONTACT.tel}`} className="text-primary underline underline-offset-2">{INSURANCE_CONTACT.tel}</a> / Fax : {INSURANCE_CONTACT.fax}
              <br />
              email : {INSURANCE_CONTACT.email}
            </p>
            <p className="mt-4 text-lg font-extrabold text-gray-400">{INSURANCE_CONTACT.insurer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
