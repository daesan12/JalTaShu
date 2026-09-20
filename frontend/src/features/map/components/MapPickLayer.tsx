import { Button } from '@/shared/ui/Button';
import type { MapPickAddress } from '@/features/map/hooks/useMapPick';

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
  /** 출발지를 고르는 중(`field=start`)이면 true — 안내 문구가 달라진다 */
  isStart: boolean;
  /** 지금 핀이 놓인 지점의 건물명·주소 */
  address: MapPickAddress;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 08 "지도에서 선택" — 지도를 눌러 출발지·목적지를 고르는 모드.
 *
 * 핀은 지도에 찍지 않고 **화면 중앙에 고정**한다. 지도를 누르면 그 지점으로 지도가 옮겨져
 * 핀이 그 자리에 놓이는 방식이라, 좌표의 출처가 계속 "지도 중심" 하나로 유지된다.
 * (손가락으로 정확히 찍는 것보다 쉽고 핀이 손에 가려지지도 않는다)
 *
 * 핀 아래 지점의 주소는 역지오코딩으로 읽어 상단에 보여준다. 읽지 못해도 선택 자체는 된다.
 */
export function MapPickLayer({ isStart, address, onCancel, onConfirm }: MapPickLayerProps) {
  const target = isStart ? '출발지' : '목적지';
  const place = address.place;

  return (
    <>
      {/* 상단 — 취소(뒤로) + 안내 문구 + 지금 지점의 주소 */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-4">
        <div className="flex items-start gap-2">
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
            지도를 눌러 {target}를 맞춰 주세요
          </p>
        </div>

        {/*
          주소 카드 — 읽는 중이거나 읽어 낸 값이 있을 때만 자리를 차지한다.
          역지오코딩이 안 되는 환경(키·상품 미설정, 주소 없는 지점)에서 빈 카드가 남지 않게 한다.
          aria-live: 지도를 옮길 때마다 바뀌는 값이라 화면 낭독기에도 알린다.
        */}
        {address.loading || place !== null ? (
          <div
            aria-live="polite"
            className="pointer-events-auto mx-auto w-full rounded-2xl bg-surface px-4 py-2.5 text-center shadow-md"
          >
            {place === null ? (
              <p className="truncate text-sm text-gray-400">주소를 확인하는 중…</p>
            ) : (
              <>
                <p className="truncate text-sm font-semibold text-gray-900">{place.title}</p>
                {place.roadAddress || place.address ? (
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {place.roadAddress || place.address}
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : null}
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
