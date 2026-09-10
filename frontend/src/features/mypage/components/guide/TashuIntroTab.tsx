import { useState } from 'react';
import { Button } from '@/shared/ui/Button';

/** 이용안내 > 타슈란 — 34 프레임 기준 */
export function TashuIntroTab() {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center px-6 pt-8 text-center">
      {/* 타슈 로고 자리 — 공식 로고 이미지 확보 후 교체 */}
      <div className="flex h-16 w-40 items-center justify-center rounded-2xl bg-primary-light text-sm font-medium text-primary">
        타슈 로고
      </div>

      <h2 className="mt-8 text-xl leading-relaxed font-bold text-primary">
        건강한, 깨끗한
        <br />
        녹색성장 자전거 도시
      </h2>

      <div className="mt-8 w-full max-w-70 space-y-3">
        <Button full className="rounded-full" onClick={() => setNotice('이용방법 동영상')}>
          이용방법 동영상보기
        </Button>
        <Button full variant="line" className="rounded-full" onClick={() => setNotice('이용요금 안내')}>
          이용요금 안내
        </Button>
      </div>

      <p className="mt-8 text-[15px] leading-relaxed text-gray-500">
        타슈는 만 15세 이상부터 이용할 수 있어요.
        <br />
        이용 규칙을 꼭 준수해주세요.
      </p>

      {notice && (
        <p className="mt-4 text-sm text-gray-400">&lsquo;{notice}&rsquo; 연결을 준비 중이에요.</p>
      )}

      {/* 일러스트 자리 (375×240) — 에셋 확보 후 교체 */}
      <div className="mt-8 -mx-6 flex h-60 w-[calc(100%+3rem)] items-center justify-center bg-primary-light/60 text-sm text-gray-400">
        일러스트 자리
      </div>
    </div>
  );
}
