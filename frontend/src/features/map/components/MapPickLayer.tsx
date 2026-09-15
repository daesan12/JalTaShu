import { Button } from '@/shared/ui/Button';

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

const PIN_WIDTH = 32;
const PIN_HEIGHT = 40;

interface MapPickLayerProps {
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 08 "지도에서 선택" — 지도를 움직여 목적지를 고르는 모드.
 *
 * 핀은 지도에 찍지 않고 **화면 중앙에 고정**한다. 사용자가 지도를 움직이면 핀 아래 좌표가 바뀌는
 * 방식이라, 손가락으로 정확히 찍는 것보다 쉽고 핀이 손에 가려지지도 않는다.
 * 확정할 때 지도 중심 좌표를 읽어 목적지로 넘긴다.
 *
 * 역지오코딩은 하지 않으므로(기존 결정) 주소는 보여주지 않는다.
 */
export function MapPickLayer({ onCancel, onConfirm }: MapPickLayerProps) {
  return (
    <>
      {/* 상단 — 취소(뒤로) + 안내 문구 */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-2 p-4">
        <button
          type="button"
          aria-label="지도에서 선택 취소"
          onClick={onCancel}
          className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-gray-700 shadow-md transition-[scale,background-color] duration-75 active:scale-95 active:bg-gray-100"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
            <path d="M19 12H5m6-6-6 6 6 6" {...stroke} />
          </svg>
        </button>
        <p className="pointer-events-auto flex min-h-11 flex-1 items-center justify-center rounded-full bg-surface px-4 text-sm font-medium text-gray-700 shadow-md">
          지도를 움직여 목적지를 맞춰 주세요
        </p>
      </div>

      {/*
        중앙 고정 핀 — 핀 끝이 지도 중심에 오도록 위로 올린다.
        지도 조작을 막지 않도록 클릭을 받지 않는다.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-full"
      >
        <svg
          viewBox="0 0 32 40"
          width={PIN_WIDTH}
          height={PIN_HEIGHT}
          className="text-primary drop-shadow-md"
        >
          <path
            d="M16 39s-13-12.4-13-23A13 13 0 1 1 29 16c0 10.6-13 23-13 23Z"
            fill="currentColor"
            stroke="#fff"
            strokeWidth="2"
          />
          <circle cx="16" cy="16" r="5" fill="#fff" />
        </svg>
      </div>

      {/* 하단 — 확정 */}
      <div className="pb-safe absolute inset-x-0 bottom-0 z-10 p-4">
        <Button full onClick={onConfirm}>
          이 위치로 설정
        </Button>
      </div>
    </>
  );
}
