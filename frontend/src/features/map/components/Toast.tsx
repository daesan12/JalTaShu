interface ToastProps {
  message: string;
}

/** 화면 아래쪽에 잠시 떴다 사라지는 안내 문구 */
export function Toast({ message }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-36 z-50 flex justify-center px-4"
    >
      <p className="rounded-full bg-gray-900/85 px-4 py-2 text-sm font-medium text-white shadow-lg">
        {message}
      </p>
    </div>
  );
}
