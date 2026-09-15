import { GuideHeading, GuideStep, GuideTipSection } from '@/features/mypage/components/guide/GuideBlocks';
import { BikeCheckIcon, LockIcon, QrScanIcon, UnlockIcon } from '@/features/mypage/components/guide/guideIcons';

/** 이용안내 > 대여 — 타슈 공식 안내 콘텐츠 */
export function RentGuideTab() {
  return (
    <div className="pb-4">
      <GuideHeading title="자전거 대여! 따라하면 쉬워요." tags="#이용 #대여 #대여는_이렇게" />

      <GuideStep no={1} icon={QrScanIcon}>
        자전거의 QR코드를 스캔해주세요.
      </GuideStep>
      <GuideStep no={2} icon={UnlockIcon}>
        대여 시작 메시지와 함께 자전거의 잠금이 해제돼요.
      </GuideStep>
      <GuideStep no={3} icon={BikeCheckIcon}>
        즐거운 자전거 운행!
      </GuideStep>

      <GuideTipSection
        title="잠깐 자전거를 세워두고 싶나요?"
        icon={LockIcon}
        headline="자전거의 잠금장치를 잠가주세요."
      >
        다시 이용하고 싶을 때 앱에서 자가 잠금 해제 버튼을 누르면 잠금이 해제되고 자전거를
        재이용할 수 있답니다.
      </GuideTipSection>
    </div>
  );
}
