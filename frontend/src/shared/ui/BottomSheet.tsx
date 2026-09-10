import { useRef, type ReactNode } from 'react';
import {
  clampDragDelta,
  resolveSnapAfterDrag,
  type SnapPoint,
} from '@/shared/ui/bottomSheetSnap';

export type { SnapPoint };

/**
 * Figma "Bottom Sheet Shell" 컴포넌트(Height=Peek/Mini/Half/Tall)와 1:1.
 * - 라우트 이동 없이 현재 화면 위에 얹는 오버레이 (지도 언마운트 방지)
 * - 핸들을 잡고 드래그하면 시트가 손가락을 따라오고, 놓으면 가장 가까운 스냅으로 이동
 *   (여러 단계 건너뛰기 가능, peek 아래로 충분히 내리면 onClose)
 * - Android 뒤로가기 → 시트만 닫기 처리는 Capacitor 래핑 시 이 컴포넌트 한 곳에만 추가하면 됨
 *
 * ⚠ 높이 클래스는 bottomSheetSnap.ts의 getSnapHeights와 일치해야 한다.
 */
const SNAP_HEIGHT_CLASS: Record<SnapPoint, string> = {
  peek: 'h-[110px]',
  mini: 'h-[200px]',
  half: 'h-[59dvh] max-h-[480px]',
  tall: 'h-[77dvh] max-h-[624px]',
};

interface BottomSheetProps {
  open: boolean;
  snapPoint?: SnapPoint;
  /** 드래그로 snap이 바뀔 때 호출 (미지정 시 드래그로는 안 바뀜) */
  onSnapChange?: (snap: SnapPoint) => void;
  /** 배경 탭 또는 peek 아래로 드래그 시 호출 */
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
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const showBackdrop = backdrop ?? (snapPoint === 'half' || snapPoint === 'tall');
  // snap 변경 콜백이 없는 시트(고정 높이)는 위로 드래그를 잠근다
  const canExpand = Boolean(onSnapChange);

  /** 드래그 종료·취소 시 인라인 스타일을 걷어내고 스냅 클래스로 복귀 */
  const endDrag = () => {
    dragStartY.current = null;
    const sheet = sheetRef.current;
    if (sheet) {
      sheet.style.transition = '';
      sheet.style.translate = '';
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    // 손가락을 따라오는 동안에는 전환 애니메이션 끔
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const delta = clampDragDelta(
      snapPoint,
      e.clientY - dragStartY.current,
      window.innerHeight,
      canExpand,
    );
    // Tailwind v4의 -translate-x-1/2(가로 중앙)를 유지하면서 세로만 이동
    sheetRef.current.style.translate = `-50% ${delta}px`;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const deltaY = e.clientY - dragStartY.current;
    endDrag();

    const result = resolveSnapAfterDrag(snapPoint, deltaY, window.innerHeight);
    if (result === 'close') onClose();
    else if (result !== snapPoint) onSnapChange?.(result);
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
        ref={sheetRef}
        role="dialog"
        aria-modal={showBackdrop}
        className={`pb-safe fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 rounded-t-2xl bg-surface shadow-[0_-4px_20px_rgb(0_0_0/0.12)] transition-[height,translate] duration-300 ease-out ${
          SNAP_HEIGHT_CLASS[snapPoint]
        } ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* 드래그 핸들 */}
        <div
          className="flex cursor-grab touch-none justify-center py-2.5 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={endDrag}
        >
          <div className="h-1 w-12 rounded-full bg-gray-300" />
        </div>
        <div className="h-[calc(100%-21px)] overflow-y-auto overscroll-contain px-4">
          {children}
        </div>
        {/* 위로 드래그할 때 시트 아래가 끊겨 보이지 않게 하는 꼬리 배경 */}
        <div aria-hidden className="absolute inset-x-0 top-full h-48 bg-surface" />
      </div>
    </>
  );
}
