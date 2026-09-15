import { useState } from 'react';
import { useNavigate } from 'react-router';
import { markOnboardingDone } from '@/features/onboarding/lib/onboardingStorage';
import { Button } from '@/shared/ui/Button';
import { IntroStep } from '@/features/onboarding/components/IntroStep';
import { NoticeStep } from '@/features/onboarding/components/NoticeStep';
import { PermissionStep } from '@/features/onboarding/components/PermissionStep';
import { requestPermissionsSequentially } from '@/features/onboarding/lib/permissions';

const LAST_STEP = 2;

/** 02~04 온보딩 — 스텝 3개를 한 라우트에서 전환 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [noticeConfirmed, setNoticeConfirmed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const finish = () => {
    markOnboardingDone();
    navigate('/login', { replace: true });
  };

  const handleNext = async () => {
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      // 위치 → 카메라 → 알림 권한 팝업을 차례로 띄운 뒤 다음 스텝
      setRequesting(true);
      await requestPermissionsSequentially();
      setRequesting(false);
      setStep(2);
    } else {
      finish();
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* 상단: 건너뛰기 (첫 스텝만, 예측 고지(04)는 건너뛸 수 없어 04로 이동) */}
      <div className="flex h-14 items-center justify-end px-4">
        {step === 0 && (
          <button
            type="button"
            onClick={() => setStep(LAST_STEP)}
            className="flex min-h-11 items-center px-2 text-sm text-gray-400 active:text-gray-500"
          >
            건너뛰기
          </button>
        )}
      </div>

      {step === 0 && <IntroStep />}
      {step === 1 && <PermissionStep />}
      {step === 2 && <NoticeStep confirmed={noticeConfirmed} onConfirmChange={setNoticeConfirmed} />}

      {/* 하단: 진행 점 + 버튼 */}
      <div className="pb-safe px-6 pb-8">
        <div className="mb-5 flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-[width,background-color] duration-200 ${
                i === step ? 'w-5 bg-primary' : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>
        <Button
          full
          onClick={handleNext}
          disabled={requesting || (step === LAST_STEP && !noticeConfirmed)}
        >
          {step === 0 && '다음'}
          {step === 1 && (requesting ? '권한 요청 중…' : '확인')}
          {step === 2 && '시작하기'}
        </Button>
      </div>
    </div>
  );
}
