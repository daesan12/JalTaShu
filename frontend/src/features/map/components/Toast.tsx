interface ToastProps {
  message: string;
}

/**
 * 화면 아래쪽에 잠시 떴다 사라지는 안내 문구.
 * z-60은 도착 요약 같은 전체 화면 오버레이(z-50)보다 위에 두기 위한 것 — 저장 실패처럼
 * 오버레이가 떠 있는 동안 알려야 하는 문구가 있어서 토스트가 항상 맨 위여야 한다.
 */
export function Toast({ message }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-36 z-[60] flex justify-center px-4"
    >
      <p className="rounded-full bg-gray-900/85 px-4 py-2 text-sm font-medium text-white shadow-lg">
        {message}
      </p>
    </div>
  );
}
