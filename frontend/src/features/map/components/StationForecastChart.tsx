import type { StationForecastPoint } from '@/shared/api/types';
import { formatBikes } from '@/features/map/lib/bikeCount';
import {
  STATION_STATUS_LABEL,
  toStationStatus,
  type StationStatus,
} from '@/shared/ui/stationStatus';

/**
 * 대여소 예상 대수 추이 (2-1) — 시간대별 막대.
 *
 * 색은 대여소 마커·뱃지와 **같은 여유/보통/부족 판정**을 쓴다(`toStationStatus`).
 * 화면마다 다른 색을 쓰면 같은 숫자가 다르게 읽힌다. 기준값이 바뀌면 그 함수만 고치면 된다.
 * 확률은 표시하지 않는다(기존 결정) — 대수와 상태만.
 *
 * **예측값은 소수로 온다(2.4, 1.9 …). 숫자·색·높이가 모두 그 소수값을 그대로 쓴다.**
 *
 * 처음에는 숫자만 반올림해 보여줬는데, 1.7과 1.9가 똑같이 "2대"로 찍히면서 색과 높이만
 * 달라 보이는 화면이 나왔다(#105). 반올림을 어디에 적용할지 맞추는 대신 **반올림을 아예
 * 없앴다** — 값 하나로 셋을 다 그리면 어긋날 곳이 없고, 1.7과 1.9가 서로 다른 값이라는
 * 사실도 그대로 전달된다. 예측값이라 소수가 오히려 "추정치"라는 신호가 된다.
 */

/** 막대 색 — index.css 토큰을 그대로 쓴다 */
const BAR_CLASS: Record<StationStatus, string> = {
  high: 'bg-status-high',
  mid: 'bg-status-mid',
  low: 'bg-status-low',
  // 예측 점은 항상 숫자라 여기까지 오지 않지만, 상태 목록이 늘면 타입이 요구한다
  unknown: 'bg-gray-400',
};

/**
 * 몇 칸마다 시각을 적을지.
 *
 * 응답은 1분 간격 최대 15점인데, 시트 안쪽 폭(약 390px)에 15칸이면 칸당 22px이라
 * `16:05`(약 32px)를 칸마다 적으면 두 줄로 깨진다. 마지막 점부터 거꾸로 5칸마다 적으면
 * 15점일 때 5·10·15분 자리 셋이 남고, 점이 적게 와도 항상 마지막 점에는 시각이 붙는다.
 */
const LABEL_EVERY = 5;

const TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: false,
});

function formatTime(dateTime: string): string {
  const date = new Date(dateTime);
  return Number.isNaN(date.getTime()) ? '-' : TIME_FORMAT.format(date);
}

interface StationForecastChartProps {
  points: StationForecastPoint[];
  /** 현재 대수 — 막대 높이 기준을 현재값까지 포함해 잡는다. 모르면 null */
  currentBikes: number | null;
}

export function StationForecastChart({ points, currentBikes }: StationForecastChartProps) {
  // 0대일 때도 막대가 보이도록 최소 높이를 주고, 가장 큰 값이 꽉 차게 맞춘다
  const max = Math.max(currentBikes ?? 0, ...points.map((p) => p.bikeCnt), 1);
  const last = points.length - 1;

  return (
    <div>
      <div
        role="img"
        aria-label={`예상 대수 추이: ${points
          .map((p) => `${formatTime(p.dateTime)} ${formatBikes(p.bikeCnt)}대`)
          .join(', ')}`}
        className="flex h-32 items-end gap-1"
      >
        {points.map((point) => {
          // 숫자·색·높이가 모두 이 값 하나를 쓴다 — 반올림을 끼워 넣으면 셋이 어긋난다
          const shown = formatBikes(point.bikeCnt);
          const status = toStationStatus(point.bikeCnt);
          return (
            // 칸에 h-full을 줘야 막대의 퍼센트 높이가 기준을 갖는다.
            // 기준 높이가 없는 부모에 퍼센트를 주면 0으로 계산돼 막대가 아예 안 보인다
            <div
              key={point.dateTime}
              className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
            >
              {/*
                줄바꿈 금지 — `10.6`처럼 네 글자면 칸(약 22px)보다 1px 넓어 두 줄로 깨지고,
                그만큼 칸이 높아져 그 막대들만 눌려 보인다. 넘치는 폭은 막대 사이 간격이 삼킨다.
              */}
              <span className="whitespace-nowrap text-center text-xs font-semibold tabular-nums text-gray-500">
                {shown}
              </span>
              <div
                title={`${formatTime(point.dateTime)} · ${shown}대 (${STATION_STATUS_LABEL[status]})`}
                className={`w-full rounded-t ${BAR_CLASS[status]}`}
                // 0대도 보이도록 최소 높이를 주고, 위쪽은 숫자 자리로 비워 둔다
                style={{ height: `${Math.max(5, (point.bikeCnt / max) * 85)}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* 칸은 막대와 1:1로 두고 글자만 비운다 — 칸 수가 달라지면 막대와 어긋난다 */}
      <div className="mt-1.5 flex gap-1 border-t border-gray-200 pt-1.5">
        {points.map((point, i) => (
          <span
            key={point.dateTime}
            className="min-w-0 flex-1 whitespace-nowrap text-center text-xs tabular-nums text-gray-400"
          >
            {(last - i) % LABEL_EVERY === 0 ? formatTime(point.dateTime) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
