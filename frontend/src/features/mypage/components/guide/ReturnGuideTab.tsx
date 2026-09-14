import { GuideHeading, GuideStep, GuideTipSection } from '@/features/mypage/components/guide/GuideBlocks';
import { LockIcon, MessageIcon, StationIcon } from '@/features/mypage/components/guide/guideIcons';

/** 이용안내 > 반납 — 타슈 공식 안내 콘텐츠 */
export function ReturnGuideTab() {
  return (
    <div className="pb-4">
      <GuideHeading title="자전거 반납! 따라하면 쉬워요." tags="#반납 #주차 #반납은_이렇게" />

      <GuideStep no={1} icon={StationIcon}>
        가까운 &ldquo;타슈 대여소&rdquo;를 찾아주세요.
      </GuideStep>
      <GuideStep no={2} icon={LockIcon}>
        자전거 뒷 부분에 있는 잠금장치를 잠근 후 잠시만 기다려주세요.
      </GuideStep>
      <GuideStep no={3} icon={MessageIcon}>
        전송된 반납완료 메시지(알림톡, 휴대폰문자)를 &ldquo;꼭&rdquo; 확인하시고, 이동하여 주세요.
      </GuideStep>

      <GuideTipSection
        title="단말기 오류, 잠금장치 고장 등으로 대여소에 반납이 안되었나요?"
        icon={MessageIcon}
        headline="앱에서도 반납을 할 수 있어요."
      >
        &ldquo;대여소 앞에서 앱으로 반납&rdquo; 버튼을 눌러서 처리가 가능해요.
      </GuideTipSection>
    </div>
  );
}
