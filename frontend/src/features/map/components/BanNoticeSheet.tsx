import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';

/** 백엔드가 사유 없이 막았을 때 돌려주는 기본 문구(`UserErrorCode.BANNED_USER`) — 사유로 보여 주지 않는다 */
const DEFAULT_BAN_MESSAGE = '제재 중인 사용자는 이 기능을 이용할 수 없습니다.';

interface BanNoticeSheetProps {
  /** 관리자가 적은 정지 사유. null이면 닫힌다 */
  reason: string | null;
  onClose: () => void;
}

/**
 * 정지된 계정의 대여 차단 안내(#146).
 * 관리자 화면에서 정지하면 대여 API가 403으로 막는다 — 왜 막혔는지 알 수 있게 사유를 보여 준다.
 * 정지 종료 일자는 아직 응답에 없어 쓰지 않는다(지어내지 않는다).
 */
export function BanNoticeSheet({ reason, onClose }: BanNoticeSheetProps) {
  const detail = reason === null || reason === DEFAULT_BAN_MESSAGE ? null : reason;

  return (
    <BottomSheet open={reason !== null} snapPoint="mini" onClose={onClose} backdrop>
      <div className="flex h-full flex-col">
        <p className="text-lg font-semibold text-gray-900">이용이 정지된 계정입니다</p>
        <p className="mt-1 text-sm text-gray-500">
          정지가 풀리기 전까지 자전거를 대여할 수 없어요. 빌린 자전거 반납은 할 수 있어요.
        </p>
        {detail === null ? null : (
          <p className="mt-3 rounded-xl bg-surface-soft px-3 py-2 text-sm text-gray-700">
            사유: {detail}
          </p>
        )}
        <div className="mt-auto pb-3">
          <Button full onClick={onClose}>
            확인
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
