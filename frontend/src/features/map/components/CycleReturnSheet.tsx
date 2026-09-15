import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { InputField } from '@/shared/ui/InputField';
import { returnCycle } from '@/features/map/api/cycle';

/** 대여(`CycleRentSheet`)와 같은 형식 — QR 인쇄본, `QrScanPage`의 수동 입력 패턴과 통일 */
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
  /** 반납할 대여소 — 대여소 시트에서 열었으므로 항상 정해져 있다. null이면 열리지 않는다 */
  stationId: string | null;
  onClose: () => void;
  /** 반납 성공 — 부모가 토스트 등으로 안내한다 */
  onReturned: () => void;
}

/**
 * 07 대여소 시트의 "반납하기" — 자전거 번호를 입력해 반납을 요청한다.
 * 대여(#41)와 같은 방식이지만, 대여소는 검색하지 않는다 — 지금 열려 있는 대여소 시트의
 * 대여소가 곧 반납 대여소다(실제로 그 자리에서 반납하는 상황을 그대로 반영).
 */
export function CycleReturnSheet({ open, stationId, onClose, onReturned }: CycleReturnSheetProps) {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // autoFocus는 마운트 시점(시트가 닫혀 있어도 DOM에 존재)에 발동해 지도 진입만으로
  // 키보드가 올라오므로, 시트가 "열릴 때" 포커스를 준다
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const returnMutation = useMutation({
    mutationFn: returnCycle,
    onSuccess: () => {
      onReturned();
      close();
    },
  });

  // 닫을 때는 입력값과 실패 상태를 같이 비운다 — 다음에 열었을 때 이전 시도가 남아 있지 않게
  function close() {
    setCode('');
    returnMutation.reset();
    onClose();
  }

  const trimmed = code.trim().toUpperCase();
  const formatValid = CODE_PATTERN.test(trimmed);

  function submit() {
    if (!formatValid || stationId === null) return;
    returnMutation.mutate({ cycleId: trimmed, stationId });
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
          disabled={returnMutation.isPending}
          error={
            code.length > 0 && !formatValid
              ? '영문·숫자 6~12자로 입력해 주세요.'
              : returnMutation.isError
                ? returnMutation.error instanceof ApiError
                  ? returnMutation.error.message
                  : '반납에 실패했습니다. 다시 시도해 주세요.'
                : undefined
          }
        />

        <div className="mt-auto pb-3">
          <Button full onClick={submit} disabled={!formatValid || returnMutation.isPending}>
            {returnMutation.isPending ? '반납하는 중…' : '반납하기'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
