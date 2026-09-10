import { Checkbox } from '@/shared/ui/Checkbox';

interface NoticeStepProps {
  confirmed: boolean;
  onConfirmChange: (checked: boolean) => void;
}

/** 04 온보딩 3of3 · 예측 고지 */
export function NoticeStep({ confirmed, onConfirmChange }: NoticeStepProps) {
  return (
    <div className="flex flex-1 flex-col justify-center px-6">
      <h2 className="text-xl font-bold text-gray-900">
        도착했을 때 남아 있을
        <br />
        자전거 대수를 알려줘요
      </h2>
      <p className="mt-4 rounded-2xl bg-background p-4 text-[15px] leading-relaxed text-gray-600">
        잘타슈는 과거 대여 패턴과 실시간 잔여량으로 &ldquo;내가 대여소에 도착하는 시점에 남아 있을
        자전거 대수&rdquo;를 예측해요. 예측값이라 실제와 다를 수 있어요. 표시된 대수가 있어도
        자전거가 없을 수 있으니 참고 지표로 사용해 주세요.
      </p>
      <div className="mt-4">
        <Checkbox checked={confirmed} onChange={onConfirmChange}>
          예측값이라는 점을 확인했습니다
        </Checkbox>
      </div>
    </div>
  );
}
