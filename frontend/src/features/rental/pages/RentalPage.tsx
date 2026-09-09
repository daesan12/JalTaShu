/** [PLACEHOLDER] 17 QR 스캔 · 18 자전거 상태 — rental 담당이 교체할 것 */
export function RentalPage() {
  return (
    <div className="p-4">
      <h1 className="text-lg font-bold text-gray-900">17·18 자전거 확인 (placeholder)</h1>
      <p className="mt-2 text-sm text-gray-500">
        QR 스캔(getUserMedia + BarcodeDetector)과 자전거 상태 화면이 들어올 자리입니다. QR 코드
        추출은 <code>shared/lib/qr.ts</code>의 <code>extractTashuCode</code>를 사용하세요.
      </p>
    </div>
  );
}
