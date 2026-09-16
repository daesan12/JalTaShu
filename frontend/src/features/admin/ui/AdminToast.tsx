/**
 * 03-b "제보 상태가 변경되었습니다" 같은 짧은 완료 안내.
 * 띄우고 지우는 타이밍은 shared/lib/useToast가 맡는다.
 */
export function AdminToast({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-6 bottom-6 z-50"
    >
      <p className="rounded-md bg-admin-primary px-4 py-3.5 text-sm font-medium text-white shadow-lg">
        {message}
      </p>
    </div>
  );
}
