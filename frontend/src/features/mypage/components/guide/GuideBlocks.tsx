import type { ReactNode } from 'react';

/** 이용안내 탭 공용 블록 — 타슈 앱 구성을 잘타슈 색으로 재구성 */

export function GuideHeading({ title, tags }: { title: string; tags: string }) {
  return (
    <div className="pt-8 text-center">
      <h2 className="text-xl font-bold text-primary">{title}</h2>
      <p className="mt-1.5 text-[15px] text-gray-500">{tags}</p>
    </div>
  );
}

export function GuideStep({ no, icon, children }: { no: number; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-10 flex flex-col items-center px-6 text-center">
      <div className="flex h-36 w-36 items-center justify-center rounded-full bg-background text-primary">
        {icon}
      </div>
      <p className="tabular-nums mt-5 font-bold text-gray-900">STEP 0{no}</p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-gray-500">{children}</p>
    </div>
  );
}

interface GuideTipProps {
  title: string;
  icon: ReactNode;
  headline: string;
  children: ReactNode;
}

export function GuideTipSection({ title, icon, headline, children }: GuideTipProps) {
  return (
    <section className="mt-12 flex flex-col items-center bg-primary-light/60 px-6 py-10 text-center">
      <span className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-white">TIP</span>
      <h3 className="mt-4 text-lg leading-relaxed font-bold text-primary">{title}</h3>
      <div className="mt-6 flex h-32 w-32 items-center justify-center rounded-full bg-surface text-primary">
        {icon}
      </div>
      <p className="mt-5 font-bold text-gray-900">{headline}</p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-gray-500">{children}</p>
    </section>
  );
}
