/** 이용안내 전용 라인 아이콘 (타슈 일러스트 대체) — stroke는 currentColor */
const s = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

const cls = 'h-16 w-16';

export const QrScanIcon = (
  <svg viewBox="0 0 48 48" className={cls}>
    <rect x="12" y="6" width="24" height="36" rx="4" {...s} />
    <rect x="18" y="14" width="5" height="5" {...s} />
    <rect x="25" y="14" width="5" height="5" {...s} />
    <rect x="18" y="21" width="5" height="5" {...s} />
    <path d="M25 26h5M20 34h8" {...s} />
  </svg>
);

export const UnlockIcon = (
  <svg viewBox="0 0 48 48" className={cls}>
    <rect x="12" y="22" width="24" height="18" rx="4" {...s} />
    <path d="M17 22v-5a7 7 0 0 1 13-3.5" {...s} />
    <path d="M24 29v4" {...s} />
  </svg>
);

export const LockIcon = (
  <svg viewBox="0 0 48 48" className={cls}>
    <rect x="12" y="22" width="24" height="18" rx="4" {...s} />
    <path d="M16 22v-4a8 8 0 0 1 16 0v4" {...s} />
    <path d="M24 29v4" {...s} />
  </svg>
);

export const BikeCheckIcon = (
  <svg viewBox="0 0 48 48" className={cls}>
    <circle cx="13" cy="32" r="7" {...s} />
    <circle cx="37" cy="32" r="7" {...s} />
    <path d="M13 32 20 18h8l7 14M20 18l6 14" {...s} />
    <path d="M28 8l4 4 7-7" {...s} />
  </svg>
);

export const StationIcon = (
  <svg viewBox="0 0 48 48" className={cls}>
    <rect x="14" y="8" width="20" height="16" rx="3" {...s} />
    <path d="M24 24v16M18 40h12" {...s} />
    <circle cx="20" cy="17" r="2.5" {...s} />
    <circle cx="28" cy="17" r="2.5" {...s} />
    <path d="M20 17h8l2-4" {...s} />
  </svg>
);

export const MessageIcon = (
  <svg viewBox="0 0 48 48" className={cls}>
    <path d="M8 12h32v20H22l-8 7v-7H8V12Z" {...s} />
    <path d="M15 20l6 5 12-9" {...s} />
  </svg>
);
