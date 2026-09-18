import { useEffect, useState } from 'react';
import { formatTimeAgo } from '@/shared/lib/format';

interface UpdatedBadgeProps {
  /**
   * 대여소 목록을 마지막으로 받아온 시각 (epoch ms — react-query의 `dataUpdatedAt`).
   * 서버가 "이 데이터는 몇 시 기준"인지 알려주지 않기 때문에 **우리가 받아온 시각**을 기준으로 삼는다.
   * 나중에 응답에 갱신 시각이 생기면 그 값을 넘기도록 호출부만 바꾸면 된다.
   */
  updatedAt: number;
}

/**
 * 대여소 정보가 얼마나 오래됐는지 보여주는 배지.
 * 화면을 켜 둔 채로도 경과 시간이 올라가도록 1초마다 다시 그린다. 누를 수는 없다.
 */
export function UpdatedBadge({ updatedAt }: UpdatedBadgeProps) {
  // 시각 자체는 렌더 중에 계산하고, 이 state는 1초마다 다시 그리게 하는 용도로만 쓴다
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-status-high" aria-hidden="true" />
      {/* 점과의 간격만 gap으로 두고, 시각과 "업데이트" 사이는 일반 낱말 간격이 되도록 한 덩어리로 묶는다 */}
      <span>
        <span className="tabular-nums">{formatTimeAgo(updatedAt)}</span> 업데이트
      </span>
    </span>
  );
}
