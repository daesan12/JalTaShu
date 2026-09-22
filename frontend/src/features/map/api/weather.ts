import { apiGet } from '@/shared/api/client';

export const WEATHER_QUERY_KEY = ['map', 'weather'] as const;

/**
 * 백엔드 WeatherResponse 원형 — 수집기가 Redis에 넣은 최신 관측 한 건.
 * 숫자가 BigDecimal이라 문자열로 올 수도 있어 화면에 쓰기 전에 Number로 맞춘다.
 */
interface WeatherRes {
  observedAt: string;
  temperature: number | string;
  rainfall1h: number | string;
}

export interface Weather {
  /** 관측 시각 (ISO 8601) */
  observedAt: string;
  /** 기온 ℃ */
  temperature: number;
  /** 최근 1시간 강수량 mm */
  rainfall1h: number;
}

/**
 * 07 지도 현재 날씨 — 백엔드 `GET /map/weather`.
 * Redis에 최신 관측이 없으면 백엔드가 data를 null로 준다(에러가 아니다) — 그때는 버튼을 숨긴다.
 */
export async function getWeather(): Promise<Weather | null> {
  const res = await apiGet<WeatherRes | null>('/map/weather');
  if (res === null) return null;
  return {
    observedAt: res.observedAt,
    temperature: Number(res.temperature),
    rainfall1h: Number(res.rainfall1h),
  };
}
