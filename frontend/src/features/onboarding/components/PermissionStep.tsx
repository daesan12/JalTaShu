import type { ReactNode } from 'react';

const s = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;
const cls = 'h-7 w-7';

/**
 * 앱 접근 권한 목록 (타슈 앱 권한 동의 구성 참고, 전화는 미수집 원칙이라 제외).
 * 실제 팝업 요청은 웹에서 가능한 위치·카메라·알림만 수행 — lib/permissions.ts 참고.
 * 파일·근처 기기는 Capacitor 전환 시 네이티브 권한 요청으로 연결.
 */
const PERMISSIONS: { name: string; required: boolean; description: string; icon: ReactNode }[] = [
  {
    name: '카메라',
    required: true,
    description: 'QR코드 스캔 및 신고 사진 촬영',
    icon: (
      <svg viewBox="0 0 28 28" className={cls}>
        <path d="M4 9h4l2-3h8l2 3h4v13H4V9Z" {...s} />
        <circle cx="14" cy="15" r="4" {...s} />
      </svg>
    ),
  },
  {
    name: '위치',
    required: true,
    description: '내 주변 대여소와 도보 경로 계산',
    icon: (
      <svg viewBox="0 0 28 28" className={cls}>
        <path d="M14 25s-8-6.2-8-13a8 8 0 0 1 16 0c0 6.8-8 13-8 13Z" {...s} />
        <circle cx="14" cy="12" r="3" {...s} />
      </svg>
    ),
  },
  {
    name: '파일 및 미디어',
    required: true,
    description: '신고 사진 첨부 및 저장',
    icon: (
      <svg viewBox="0 0 28 28" className={cls}>
        <path d="M9 3h8l5 5v17H6V6a3 3 0 0 1 3-3Z" {...s} />
        <path d="M10 9h3M10 14h8M10 19h8" {...s} />
      </svg>
    ),
  },
  {
    name: '근처 기기',
    required: true,
    description: '자전거 잠금장치 통신',
    icon: (
      <svg viewBox="0 0 28 28" className={cls}>
        <path d="M14 3v22l6-5.5L8 9M14 3l6 5.5L8 19" {...s} />
      </svg>
    ),
  },
  {
    name: '알림',
    required: false,
    description: '공지 및 대여소 고갈 위험 알림',
    icon: (
      <svg viewBox="0 0 28 28" className={cls}>
        <path d="M14 4a7 7 0 0 1 7 7v5l2 4H5l2-4v-5a7 7 0 0 1 7-7Z" {...s} />
        <path d="M11.5 23a2.5 2.5 0 0 0 5 0" {...s} />
      </svg>
    ),
  },
];

/** 03 온보딩 2of3 · 권한 안내 */
export function PermissionStep() {
  return (
    <div className="flex flex-1 flex-col justify-center px-6">
      <h2 className="text-xl font-bold text-gray-900">
        원활한 이용을 위해
        <br />
        권한을 허용해 주세요
      </h2>
      <ul className="mt-7 space-y-5">
        {PERMISSIONS.map((p) => (
          <li key={p.name} className="flex items-center gap-4">
            <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-background text-primary">
              {p.icon}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">
                {p.name}{' '}
                <span className={`text-sm font-medium ${p.required ? 'text-primary' : 'text-gray-400'}`}>
                  ({p.required ? '필수' : '선택'})
                </span>
              </p>
              <p className="mt-0.5 text-sm text-gray-500">{p.description}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs leading-relaxed text-gray-400">
        ※ 선택 접근권한에 동의하지 않아도, 해당 권한을 제외한 서비스 이용이 가능합니다.
      </p>
    </div>
  );
}
