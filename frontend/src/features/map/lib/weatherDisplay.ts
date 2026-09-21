/**
 * 날씨 값 → 화면 표시로 바꾸는 순수 함수들.
 * 버튼·카드가 같은 기준을 써야 아이콘과 문구가 어긋나지 않는다.
 */

export type RainLevel = 'none' | 'light' | 'moderate' | 'heavy';

/**
 * 1시간 강수량(mm) → 비 세기.
 * 1mm를 경계로 두는 이유: 이 프로젝트의 수요 분석에서 "1mm 이상이면 대여 수요가 뚜렷이 꺾인다"가
 * 확인된 기준선이라, 자전거를 탈지 말지 가르는 지점도 같은 값으로 맞춘다.
 */
export function toRainLevel(rainfall1h: number): RainLevel {
  if (!(rainfall1h > 0)) return 'none'; // NaN·음수 같은 이상값도 '비 없음'으로 떨어뜨린다
  if (rainfall1h < 1) return 'light';
  if (rainfall1h < 5) return 'moderate';
  return 'heavy';
}

export const RAIN_LABEL: Record<RainLevel, string> = {
  none: '비 없음',
  light: '약한 비',
  moderate: '비',
  heavy: '강한 비',
};

/** 자전거를 타려는 사람에게 필요한 한 줄. 비가 안 오면 굳이 말하지 않는다 */
export function toRidingHint(level: RainLevel): string | null {
  switch (level) {
    case 'none':
      return null;
    case 'light':
      return '빗길이라 브레이크가 늦게 들어요.';
    case 'moderate':
      return '비가 와요. 우비와 미끄럼에 주의하세요.';
    case 'heavy':
      return '비가 많이 와요. 자전거 이용을 권하지 않아요.';
  }
}

/** 버튼에 들어갈 짧은 기온 — 소수점은 버리고 정수로 */
export function formatTemperature(temperature: number): string {
  return `${Math.round(temperature)}°`;
}

/** 카드에 들어갈 강수량 — 0.5mm처럼 소수 한 자리까지 */
export function formatRainfall(rainfall1h: number): string {
  const safe = Number.isFinite(rainfall1h) && rainfall1h > 0 ? rainfall1h : 0;
  return `${safe.toFixed(1)}mm`;
}

/**
 * 관측이 너무 오래된 값인지 — 수집기가 멈추면 어제 날씨를 오늘처럼 보여주게 된다.
 * 기상 관측은 매시간 갱신되므로 2시간을 넘으면 "오래된 값"으로 본다.
 */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export function isStale(observedAt: string, now: number = Date.now()): boolean {
  const observed = new Date(observedAt).getTime();
  if (Number.isNaN(observed)) return true; // 시각을 못 읽으면 신뢰하지 않는다
  return now - observed > STALE_AFTER_MS;
}
