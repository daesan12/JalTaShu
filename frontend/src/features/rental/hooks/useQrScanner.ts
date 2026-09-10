import { useCallback, useEffect, useRef, useState } from 'react';
import type jsQRType from 'jsqr';

/** 기획 확정: 150ms 간격 스캔, 성공 시 진동 + 카메라 정지, 이탈 시 track stop */
const SCAN_INTERVAL_MS = 150;

export type ScannerStatus =
  | 'idle' // 시작 전
  | 'starting' // 카메라 켜는 중 (권한 프롬프트 포함)
  | 'scanning' // 스캔 중
  | 'denied' // 권한 거부됨
  | 'unavailable'; // 카메라 없음·미지원

/** Shape Detection API — TS 기본 타입에 없어 최소만 선언 */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

/**
 * QR 스캐너 훅 — BarcodeDetector 우선, 미지원 브라우저(Windows 데스크톱 등)는 jsQR 폴백.
 * @param onCode QR 원문을 받아 처리하고, 스캔을 멈출지(true) 계속할지(false) 반환
 */
export function useQrScanner(onCode: (raw: string) => boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  });

  const [status, setStatus] = useState<ScannerStatus>('idle');

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }, // 후면 카메라 우선
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play();

      const detector = window.BarcodeDetector
        ? new window.BarcodeDetector({ formats: ['qr_code'] })
        : null;
      // 폴백 라이브러리는 필요한 브라우저에서만 로드 (메인 번들 미포함)
      const jsQR = detector ? null : (await import('jsqr')).default;

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        const raw = detector
          ? await detectWithBarcodeDetector(detector, videoRef.current)
          : jsQR
            ? detectWithJsQr(jsQR, videoRef.current, canvasRef)
            : null;
        if (raw && onCodeRef.current(raw)) {
          navigator.vibrate?.(200); // 성공 진동 (미지원 브라우저는 무시)
          stop();
        }
      };
      timerRef.current = window.setInterval(() => void tick(), SCAN_INTERVAL_MS);
      setStatus('scanning');
    } catch (err) {
      stop();
      setStatus(err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
  }, [stop]);

  // 화면 이탈 시 반드시 카메라 반납
  useEffect(() => stop, [stop]);

  return { videoRef, status, start, stop };
}

async function detectWithBarcodeDetector(
  detector: BarcodeDetectorLike,
  video: HTMLVideoElement,
): Promise<string | null> {
  try {
    const codes = await detector.detect(video);
    return codes[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

function detectWithJsQr(
  jsQR: typeof jsQRType,
  video: HTMLVideoElement,
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
): string | null {
  canvasRef.current ??= document.createElement('canvas');
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || video.videoWidth === 0) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(imageData.data, imageData.width, imageData.height)?.data ?? null;
}
