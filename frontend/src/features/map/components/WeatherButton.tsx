import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatTimeAgo } from '@/shared/lib/format';
import { getWeather, WEATHER_QUERY_KEY } from '@/features/map/api/weather';
import {
  formatRainfall,
  formatTemperature,
  isStale,
  RAIN_LABEL,
  toRainLevel,
  toRidingHint,
} from '@/features/map/lib/weatherDisplay';

/** 기상 관측은 매시간 갱신된다 — 그 사이에 다시 부를 이유가 없다 */
const WEATHER_STALE_MS = 10 * 60 * 1000;

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-status-mid">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <path
        d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function RainIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-blue-500">
      <path
        d="M7 15a4 4 0 0 1 .5-7.97 5.5 5.5 0 0 1 10.4 1.55A3.5 3.5 0 0 1 17.5 15H7Z"
        fill="currentColor"
      />
      <path
        d="M8.5 18l-1 2.5M12 18l-1 2.5M15.5 18l-1 2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 07 지도의 현재 날씨 — 새로고침·현재위치 버튼 위에 얹는다.
 *
 * 평소에는 기온만 보여주고, 누르면 강수량·관측 시각·주의 문구가 담긴 카드를 편다.
 * 자전거를 탈지 정하는 데 실제로 필요한 값이 "비가 오는가"라서 아이콘이 그것부터 알린다.
 * 관측값이 없으면(수집기 정지 등) 버튼 자체를 그리지 않는다 — 고장난 컨트롤을 지도에 두지 않는다.
 */
export function WeatherButton() {
  const [open, setOpen] = useState(false);
  const { data: weather } = useQuery({
    queryKey: WEATHER_QUERY_KEY,
    queryFn: getWeather,
    staleTime: WEATHER_STALE_MS,
  });

  if (!weather) return null;

  const level = toRainLevel(weather.rainfall1h);
  const hint = toRidingHint(level);
  const stale = isStale(weather.observedAt);

  return (
    <>
      {/* 카드 밖을 누르면 닫힌다. 어둡게 하지 않아 지도를 계속 볼 수 있다 */}
      {open && (
        <button
          type="button"
          aria-label="날씨 정보 닫기"
          onClick={() => setOpen(false)}
          className="fixed inset-0 cursor-default"
        />
      )}

      <div className="relative">
        {open && (
          <div className="absolute right-0 bottom-full mb-2 w-56 rounded-2xl bg-surface p-4 shadow-lg">
            <div className="flex items-center gap-2.5">
              {level === 'none' ? <SunIcon /> : <RainIcon />}
              <span className="tabular-nums text-2xl font-bold text-gray-900">
                {formatTemperature(weather.temperature)}
              </span>
              <span className="text-sm font-medium text-gray-500">{RAIN_LABEL[level]}</span>
            </div>

            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">1시간 강수량</dt>
                <dd className="tabular-nums text-gray-800">{formatRainfall(weather.rainfall1h)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">관측</dt>
                <dd className="text-gray-800">{formatTimeAgo(weather.observedAt)}</dd>
              </div>
            </dl>

            {hint && <p className="mt-3 text-sm leading-relaxed text-gray-600">{hint}</p>}
            {stale && (
              <p className="mt-2 text-xs text-gray-400">
                최신 관측을 받지 못해 이전 값을 보여주고 있어요.
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={`현재 날씨 ${formatTemperature(weather.temperature)}, ${RAIN_LABEL[level]}`}
          className="flex h-11 items-center gap-1.5 rounded-full bg-surface pr-3.5 pl-2.5 shadow-md transition-[scale,background-color] duration-75 active:scale-95 active:bg-gray-100"
        >
          {level === 'none' ? <SunIcon /> : <RainIcon />}
          <span className="tabular-nums text-[15px] font-semibold text-gray-700">
            {formatTemperature(weather.temperature)}
          </span>
        </button>
      </div>
    </>
  );
}
