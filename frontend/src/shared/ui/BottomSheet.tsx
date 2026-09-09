import { useRef, type ReactNode } from 'react';

/**
 * Figma "Bottom Sheet Shell" 컴포넌트(Height=Peek/Mini/Half/Tall)와 1:1.
 * - 라우트 이동 없이 현재 화면 위에 얹는 오버레이 (지도 언마운트 방지)
 * - 핸들을 위/아래로 스와이프하면 한 단계씩 snap 이동, 최하단(peek)에서 아래로 내리면 onClose
 * - Android 뒤로가기 → 시트만 닫기 처리는 Capacitor 래핑 시 이 컴포넌트 한 곳에만 추가하면 됨
 */
export type SnapPoint = 'peek' | 'mini' | 'half' | 'tall';

/** Figma 812px 기준 높이: peek 110 / mini 200 / half 480 / tall 624 */
const SNAP_HEIGHT: Record<SnapPoint, string> = {
  peek: 'h-[110px]',
  mini: 'h-[200px]',
  half: 'h-[59dvh] max-h-[480px]',
  tall: 'h-[77dvh] max-h-[624px]',
};

const SNAP_ORDER: SnapPoint[] = ['peek', 'mini', 'half', 'tall'];
const SWIPE_THRESHOLD_PX = 50;

interface BottomSheetProps {
  open: boolean;
  snapPoint?: SnapPoint;
  /** 스와이프로 snap이 바뀔 때 호출 (미지정 시 스와이프로는 안 바뀜) */
  onSnapChange?: (snap: SnapPoint) => void;
  /** 배경 탭 또는 peek에서 아래로 스와이프 시 호출 */
  onClose: () => void;
  /** 배경 어둡게 (기본: half·tall에서만) */
  backdrop?: boolean;
  children: ReactNode;
}

export function BottomSheet({
  open,
  snapPoint = 'half',
  onSnapChange,
  onClose,
  backdrop,
  children,
}: BottomSheetProps) {
  const dragStartY = useRef<number | null>(null);
  const showBackdrop = backdrop ?? (snapPoint === 'half' || snapPoint === 'tall');

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const deltaY = e.clientY - dragStartY.current;
    dragStartY.current = null;

    const index = SNAP_ORDER.indexOf(snapPoint);
    if (deltaY > SWIPE_THRESHOLD_PX) {
      // 아래로 스와이프: 한 단계 내리고, 이미 peek이면 닫기
      if (index === 0) onClose();
      else onSnapChange?.(SNAP_ORDER[index - 1]);
    } else if (deltaY < -SWIPE_THRESHOLD_PX && index < SNAP_ORDER.length - 1) {
      // 위로 스와이프: 한 단계 올리기
      onSnapChange?.(SNAP_ORDER[index + 1]);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/40 transition-[opacity] duration-300 ${
          open && showBackdrop ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      {/* Sheet — 데스크톱에서도 430px 레이아웃 중앙에 맞춤 */}
      <div
        role="dialog"
        aria-modal={showBackdrop}
        className={`pb-safe fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 rounded-t-2xl bg-surface shadow-[0_-4px_20px_rgb(0_0_0/0.12)] transition-[height,translate] duration-300 ease-out ${
          SNAP_HEIGHT[snapPoint]
        } ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* 드래그 핸들 */}
        <div
          className="flex cursor-grab touch-none justify-center py-2.5 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <div className="h-1 w-12 rounded-full bg-gray-300" />
        </div>
        <div className="h-[calc(100%-21px)] overflow-y-auto overscroll-contain px-4">
          {children}
        </div>
      </div>
    </>
  );
}
