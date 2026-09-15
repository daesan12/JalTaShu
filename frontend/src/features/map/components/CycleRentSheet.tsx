import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/client';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { InputField } from '@/shared/ui/InputField';
import { rentCycle } from '@/features/map/api/cycle';

/** QR 인쇄본 형식과 같다(`features/rental/pages/QrScanPage.tsx`의 수동 입력 패턴과 통일) */
const CODE_PATTERN = /^[A-Za-z0-9]{6,12}$/;

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

interface CycleRentSheetProps {
  open: boolean;
  onClose: () => void;
  /** 대여 성공 — 부모가 토스트 등으로 안내한다 */
  onRented: () => void;
}

/**
 * 07 "대여하기" — 자전거 번호를 입력해 대여를 요청한다.
 * 실제 타슈는 "대여하기 → QR 스캔" 순서지만, 카메라 화면은 경호님 `features/rental`이 이미 갖고
 * 있어(`useQrScanner`) 중복을 피해 번호 직접 입력으로 간다. QR과 합치는 건 후속 이슈.
 */
export function CycleRentSheet({ open, onClose, onRented }: CycleRentSheetProps) {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // autoFocus는 마운트 시점(시트가 닫혀 있어도 DOM에 존재)에 발동해 지도 진입만으로
  // 키보드가 올라오므로, 시트가 "열릴 때" 포커스를 준다
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const rent = useMutation({
    mutationFn: rentCycle,
    onSuccess: () => {
      onRented();
      close();
    },
  });

  // 닫을 때는 입력값과 실패 상태를 같이 비운다 — 다음에 열었을 때 이전 시도가 남아 있지 않게
  function close() {
    setCode('');
    rent.reset();
    onClose();
  }

  const trimmed = code.trim().toUpperCase();
  const formatValid = CODE_PATTERN.test(trimmed);

  function submit() {
    if (!formatValid) return;
    rent.mutate({ cycleId: trimmed });
  }

  return (
    <BottomSheet open={open} snapPoint="mini" onClose={close} backdrop>
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900">자전거 번호 입력</p>
            <p className="mt-0.5 text-sm text-gray-500">
              자전거에 적힌 QR 아래 번호를 입력해 주세요.
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
          disabled={rent.isPending}
          error={
            code.length > 0 && !formatValid
              ? '영문·숫자 6~12자로 입력해 주세요.'
              : rent.isError
                ? rent.error instanceof ApiError
                  ? rent.error.message
                  : '대여에 실패했습니다. 다시 시도해 주세요.'
                : undefined
          }
        />

        <div className="mt-auto pb-3">
          <Button full onClick={submit} disabled={!formatValid || rent.isPending}>
            {rent.isPending ? '대여하는 중…' : '대여하기'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
