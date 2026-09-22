import { useEffect, useState } from 'react';
import { formatTimeAgo } from '@/shared/lib/format';

interface UpdatedBadgeProps {
  /**
   * 대여소 목록을 **받아온 시각**(epoch ms, react-query `dataUpdatedAt`).
   * 서버가 주는 관측 시각(`time`)이 아니다 — 이 배지는 "우리가 이 숫자를 언제 받아왔나"를 말한다.
   * 실시간이 끊긴 대여소의 관측 시각은 대여소 시트가 따로 안내한다.
   */
  updatedAt: number;
  /** 새로고침 버튼과 하나의 컨트롤로 묶일 때 자체 배경과 그림자를 제거한다 */
  grouped?: boolean;
}

/**
 * 대여소 정보를 언제 받아왔는지 보여주는 배지.
 * 화면을 켜 둔 채로도 경과 시간이 올라가도록 1초마다 다시 그린다. 누를 수는 없다.
 */
export function UpdatedBadge({ updatedAt, grouped = false }: UpdatedBadgeProps) {
  // 시각 자체는 렌더 중에 계산하고, 이 state는 1초마다 다시 그리게 하는 용도로만 쓴다
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className={
        grouped
          ? 'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-muted'
          : 'inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm'
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-status-high" aria-hidden="true" />
      {/* 점과의 간격만 gap으로 두고, 시각과 "업데이트" 사이는 일반 낱말 간격이 되도록 한 덩어리로 묶는다 */}
      <span>
        <span className="tabular-nums">{formatTimeAgo(updatedAt)}</span> 업데이트
      </span>
    </span>
  );
}
