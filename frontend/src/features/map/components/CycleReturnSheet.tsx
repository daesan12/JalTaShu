import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { InputField } from '@/shared/ui/InputField';
import { returnCycle } from '@/features/map/api/cycle';
import type { CycleReturnResult } from '@/features/map/api/cycle';
import { nearestStation } from '@/features/map/lib/nearestStation';
import type { LocationResult } from '@/features/map/hooks/useCurrentLocation';
import type { BikeStation } from '@/shared/api/types';

/** QR 인쇄본 형식 — `QrScanPage`의 수동 입력 패턴과 통일 */
const CODE_PATTERN = /^[A-Za-z0-9]{6,12}$/;

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

interface CycleReturnSheetProps {
  open: boolean;
  /** 반납 대여소를 고르기 위한 후보 — 지도가 이미 들고 있는 목록을 그대로 쓴다 */
  stations: BikeStation[] | undefined;
  /** 현재 위치 확보 (`useCurrentLocation().ensure`) — 실패해도 throw하지 않는다 */
  ensureLocation: () => Promise<LocationResult>;
  onClose: () => void;
  /** 반납 성공 — 부모가 토스트 등으로 안내한다 */
  onReturned: (result: CycleReturnResult, cycleId: string, stationId: string) => void;
}

/**
 * 07 대여소 시트의 "반납하기" — 자전거 번호를 입력해 반납을 요청한다.
 * 반납 대여소는 대여와 같은 방식으로 **현재 위치에서 가장 가까운 대여소**로 정한다 — 시트를
 * 연 대여소와 실제로 서 있는 대여소가 다를 수 있고, 기록에 남아야 하는 건 실제 자리다.
 * 위치를 확인할 수 없거나 대여소 정보가 없으면 반납 요청을 보내지 않는다.
 */
export function CycleReturnSheet({
  open,
  stations,
  ensureLocation,
  onClose,
  onReturned,
}: CycleReturnSheetProps) {
  const [code, setCode] = useState('');
  // 위치를 기다리는 동안에도 버튼이 살아 있으면 같은 반납이 두 번 나간다
  const [locating, setLocating] = useState(false);
  // 반납은 대여와 달리 대여소가 필수라, 못 정했으면 그 사실을 알려야 한다
  const [stationError, setStationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // autoFocus는 마운트 시점(시트가 닫혀 있어도 DOM에 존재)에 발동해 지도 진입만으로
  // 키보드가 올라오므로, 시트가 "열릴 때" 포커스를 준다
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const returnMutation = useMutation({
    mutationFn: returnCycle,
    onSuccess: (result, variables) => {
      onReturned(result, variables.cycleId, variables.stationId);
      close();
    },
  });

  // 닫을 때는 입력값과 실패 상태를 같이 비운다 — 다음에 열었을 때 이전 시도가 남아 있지 않게
  function close() {
    setCode('');
    setLocating(false);
    setStationError(null);
    returnMutation.reset();
    onClose();
  }

  const trimmed = code.trim().toUpperCase();
  const formatValid = CODE_PATTERN.test(trimmed);

  async function submit() {
    if (!formatValid || locating || returnMutation.isPending) return;
    setLocating(true);
    let location: LocationResult | null = null;
    try {
      location = await ensureLocation();
    } finally {
      setLocating(false);
    }

    const nearest = location !== null && location.ok
      ? nearestStation(stations, location.position)
      : null;
    if (nearest === null || location === null || !location.ok) {
      setStationError(
        '현재 위치와 대여소 정보를 확인하고 위치 권한을 켠 뒤 다시 시도해 주세요.',
      );
      return;
    }
    setStationError(null);
    returnMutation.mutate({
      cycleId: trimmed,
      stationId: nearest.stationId,
      latitude: location.position.yPos,
      longitude: location.position.xPos,
    });
  }

  return (
    <BottomSheet open={open} snapPoint="mini" onClose={close} backdrop>
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900">자전거 번호 입력</p>
            <p className="mt-0.5 text-sm text-gray-500">
              반납할 자전거에 적힌 QR 아래 번호를 입력해 주세요.
            </p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={close}
            className="-mt-1.5 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 transition-[background-color] duration-75 active:bg-gray-100"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5">
              <path d="m7 7 10 10M17 7 7 17" {...stroke} />
            </svg>
          </button>
        </div>

        <InputField
          className="mt-3"
          placeholder="예: 22B01262"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
          ref={inputRef}
          disabled={locating || returnMutation.isPending}
          error={
            code.length > 0 && !formatValid
              ? '영문·숫자 6~12자로 입력해 주세요.'
              : stationError !== null
                ? stationError
                : returnMutation.isError
                  ? returnMutation.error instanceof ApiError
                    ? returnMutation.error.message
                    : '반납에 실패했습니다. 다시 시도해 주세요.'
                  : undefined
          }
        />

        <div className="mt-auto pb-3">
          <Button
            full
            onClick={submit}
            disabled={!formatValid || locating || returnMutation.isPending}
          >
            {locating ? '위치 확인 중…' : returnMutation.isPending ? '반납하는 중…' : '반납하기'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
