import { useRef, type ReactNode } from 'react';
import {
  clampDragDelta,
  getSnapHeights,
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
  /**
   * false면 아래로 끌어도 peek에서 멈추고 onClose가 불리지 않는다(닫기는 버튼·뒤로가기로만).
   * Figma 10-1 "Peek 이하 dismiss 불가". 기본 true
   */
  dismissible?: boolean;
  /**
   * 드래그를 시작·종료할 때 알린다.
   * 스냅 단계에 따라 내용이 달라지는 시트가, **끌어올리는 동안에도 펼친 모습**을 미리 그리는 데 쓴다
   * (스냅은 손을 뗀 뒤에야 바뀌므로 이 신호가 없으면 드래그 내내 빈 공간만 올라온다).
   */
  onDraggingChange?: (dragging: boolean) => void;
  children: ReactNode;
}

export function BottomSheet({
  open,
  snapPoint = 'half',
  onSnapChange,
  onClose,
  backdrop,
  dismissible = true,
  onDraggingChange,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  /**
   * 드래그 중에는 시트를 **가장 큰 높이로 키워 두고** 그만큼 아래로 밀어 둔다.
   * 그래야 손가락을 따라 올라오는 자리에 실제 내용이 들어 있다 — 높이를 그대로 두고 위치만 옮기면
   * 시트 아래로 빈 배경만 끌려 올라온다. 이 값은 그 "밀어 둔 양"이다.
   */
  const dragBaseOffset = useRef(0);
  const showBackdrop = backdrop ?? (snapPoint === 'half' || snapPoint === 'tall');
  // snap 변경 콜백이 없는 시트(고정 높이)는 위로 드래그를 잠근다
  const canExpand = Boolean(onSnapChange);

  /** 드래그 종료·취소 시 인라인 스타일을 걷어내고 스냅 클래스로 복귀 */
  const endDrag = () => {
    dragStartY.current = null;
    dragBaseOffset.current = 0;
    const sheet = sheetRef.current;
    if (sheet) {
      sheet.style.transition = '';
      sheet.style.translate = '';
      sheet.style.height = '';
      sheet.style.maxHeight = '';
    }
    onDraggingChange?.(false);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    const sheet = sheetRef.current;
    // 손가락을 따라오는 동안에는 전환 애니메이션 끔
    if (sheet) sheet.style.transition = 'none';
    // 늘어날 수 있는 시트만 미리 키운다 — 고정 높이 시트는 내려서 닫기만 하므로 그대로 둔다
    if (sheet && canExpand) {
      /*
       * 보정값은 **실제로 재서** 구한다. 스냅 클래스에 max-height가 걸려 있어(half은 480px)
       * 계산한 높이를 그대로 믿으면 잘린 만큼 시트가 툭 내려앉는다 — 손잡이를 누르기만 해도
       * 화면이 흔들렸다. max-height를 풀고 키운 뒤, 실제로 늘어난 만큼만 아래로 민다.
       */
      const before = sheet.getBoundingClientRect().height;
      sheet.style.maxHeight = 'none';
      sheet.style.height = `${Math.max(getSnapHeights(window.innerHeight).tall, before)}px`;
      dragBaseOffset.current = sheet.getBoundingClientRect().height - before;
      // 키운 만큼 아래로 밀어 화면에 보이는 높이는 지금 스냅 그대로 유지
      sheet.style.translate = `-50% ${dragBaseOffset.current}px`;
    }
    onDraggingChange?.(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null || !sheetRef.current) return;
    const delta = clampDragDelta(
      snapPoint,
      e.clientY - dragStartY.current,
      window.innerHeight,
      canExpand,
      dismissible,
    );
    // Tailwind v4의 -translate-x-1/2(가로 중앙)를 유지하면서 세로만 이동.
    // 미리 키워 둔 만큼(dragBaseOffset)을 더해야 손가락 위치와 시트 윗면이 일치한다
    sheetRef.current.style.translate = `-50% ${dragBaseOffset.current + delta}px`;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const deltaY = e.clientY - dragStartY.current;
    endDrag();

    const result = resolveSnapAfterDrag(snapPoint, deltaY, window.innerHeight, dismissible);
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
      {/*
        Sheet — 데스크톱에서도 430px 레이아웃 중앙에 맞춤.
        바닥을 안드로이드 내비게이션 바 위로 띄운다(`bottom`) — 안쪽 패딩으로 밀면
        스냅 높이가 고정값(110·200…)이라 내용이 그만큼 눌린다. 바 자리는 아래 꼬리 배경이 덮어
        시트가 화면 끝까지 이어져 보인다. 값은 Capacitor가 심어 주는 변수(웹·iOS에서는 0).
      */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal={showBackdrop}
        // 닫힌 시트는 DOM에 남아 있으므로(닫힘 애니메이션) 포커스·autoFocus가 새지 않게 차단
        inert={!open}
        className={`fixed bottom-[var(--safe-area-inset-bottom,0px)] left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 rounded-t-2xl bg-surface shadow-[0_-4px_20px_rgb(0_0_0/0.12)] transition-[height,translate] duration-300 ease-out ${
          SNAP_HEIGHT_CLASS[snapPoint]
        } ${
          // 닫을 때는 시트 높이 + 띄워 둔 만큼 내려야 화면 밖으로 완전히 나간다
          open ? 'translate-y-0' : 'translate-y-[calc(100%+var(--safe-area-inset-bottom,0px))]'
        }`}
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
