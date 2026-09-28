import { useEffect, useState } from 'react';
import { extractTashuCode } from '@/shared/lib/qr';
import { Button } from '@/shared/ui/Button';
import { InputField } from '@/shared/ui/InputField';
import { TopHeader } from '@/shared/ui/TopHeader';
import { useQrScanner } from '@/features/rental/hooks/useQrScanner';

/** 수동 입력 코드 형식 (QR 코드 인쇄본 기준, 예: 22B01262) */
const MANUAL_CODE_PATTERN = /^[A-Za-z0-9]{6,12}$/;

interface QrScanViewProps {
  /** 인식했거나 직접 입력한 자전거 코드(대문자) */
  onCode: (code: string) => void;
  /** 헤더 ← 버튼. 없으면 히스토리 뒤로가기 */
  onBack?: () => void;
  headerTitle?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
}

/**
 * QR 스캔 화면 본체 — 카메라 프리뷰와 코드 직접 입력.
 * 라우트 페이지(`QrScanPage`)와 지도 위 오버레이(대여·반납, 경로 안내 중에도 지도 상태를
 * 잃지 않아야 한다)가 같이 쓴다. 코드를 받은 뒤 어디로 갈지는 쓰는 쪽이 정한다.
 */
export function QrScanView({
  onCode,
  onBack,
  headerTitle = 'QR 스캔',
  eyebrow = 'BIKE CHECK',
  title = '자전거 QR을 비춰주세요',
  description = '상태와 최근 이용자 제보를 바로 확인할 수 있어요.',
}: QrScanViewProps) {
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const { videoRef, status, start, stop } = useQrScanner((raw) => {
    // QR 원문에서 타슈 코드만 추출 — 타슈 QR이 아니면 계속 스캔
    const code = extractTashuCode(raw);
    if (!code) return false;
    onCode(code.toUpperCase());
    return true;
  });

  // 진입 시 스캔 시작 (수동 입력 모드에선 카메라 끔)
  useEffect(() => {
    if (!manualMode) void start();
    else stop();
  }, [manualMode, start, stop]);

  const manualValid = MANUAL_CODE_PATTERN.test(manualCode);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <TopHeader title={headerTitle} onBack={onBack} />
      {/*
        pb-safe: 앱은 시스템 바 뒤까지 그리므로, 이게 없으면 맨 아래 버튼이 안드로이드 내비게이션 바(48px)에
        가려 누르기 어렵다(실기기 확인). 내용 쪽 여백은 각 분기의 마지막 요소가 mb로 준다.
      */}
      <div className="pb-safe flex flex-1 flex-col overflow-y-auto px-5">
        {manualMode ? (
          <div className="flex flex-1 flex-col justify-center py-6">
            <section className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_12px_30px_rgba(42,60,34,0.07)]">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
                  <path d="M5 7.5h14M5 12h14M5 16.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <h1 className="mt-4 text-[22px] font-extrabold text-ink">코드로 자전거 찾기</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">QR 아래에 적힌 영문·숫자 코드를 입력해 주세요.</p>
              <InputField
                className="mt-6"
                label="자전거 코드"
                placeholder="예: 22B01262"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.trim().toUpperCase())}
                autoCapitalize="characters"
                error={manualCode.length > 0 && !manualValid ? '영문·숫자 6~12자로 입력해 주세요.' : undefined}
              />
              <Button full className="mt-4" disabled={!manualValid} onClick={() => onCode(manualCode.toUpperCase())}>확인</Button>
            </section>
            <Button full variant="text" className="mt-3" onClick={() => setManualMode(false)}>카메라로 스캔하기</Button>
          </div>
        ) : (
          <>
            <div className="pt-2 pb-4">
              <p className="text-xs font-semibold tracking-[0.12em] text-primary">{eyebrow}</p>
              <h1 className="mt-1 text-[23px] font-extrabold text-ink">{title}</h1>
              <p className="mt-1.5 text-sm text-muted">{description}</p>
            </div>
            {/* 카메라 프리뷰 — 남는 높이를 전부 쓴다. 최소 높이는 가이드 프레임(224px)이 들어갈 만큼만 */}
            <div className="relative min-h-[280px] flex-1 overflow-hidden rounded-[28px] bg-[#172015] shadow-[0_18px_36px_rgba(24,33,21,0.18)]">
              <video
                ref={videoRef}
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,transparent_31%,rgba(8,15,6,0.16)_55%,rgba(8,15,6,0.52)_100%)]" />
              {/* 스캔 가이드 프레임 */}
              {status === 'scanning' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="relative h-56 w-56">
                    <span className="absolute top-0 left-0 h-12 w-12 rounded-tl-2xl border-t-[3px] border-l-[3px] border-white" />
                    <span className="absolute top-0 right-0 h-12 w-12 rounded-tr-2xl border-t-[3px] border-r-[3px] border-white" />
                    <span className="absolute bottom-0 left-0 h-12 w-12 rounded-bl-2xl border-b-[3px] border-l-[3px] border-white" />
                    <span className="absolute right-0 bottom-0 h-12 w-12 rounded-br-2xl border-r-[3px] border-b-[3px] border-white" />
                    <span className="absolute top-1/2 right-4 left-4 h-px bg-primary-light shadow-[0_0_12px_rgba(238,246,228,0.9)]" />
                  </div>
                  <span className="mt-6 rounded-full bg-black/45 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur-sm">프레임 안에 QR을 맞춰주세요</span>
                </div>
              )}
              {/* 상태 안내 */}
              {status !== 'scanning' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
                  {status === 'starting' && (
                    <p className="text-sm text-white/80">카메라 켜는 중…</p>
                  )}
                  {status === 'denied' && (
                    <>
                      <p className="text-sm font-semibold text-white">카메라 권한이 꺼져 있어요</p>
                      <p className="text-xs text-white/70">
                        브라우저 설정에서 카메라를 허용하거나, 아래에서 코드를 직접 입력해 주세요.
                      </p>
                    </>
                  )}
                  {status === 'unavailable' && (
                    <>
                      <p className="text-sm font-semibold text-white">카메라를 사용할 수 없어요</p>
                      <p className="text-xs text-white/70">코드를 직접 입력해 주세요.</p>
                    </>
                  )}
                </div>
              )}
            </div>
            <Button full variant="line" className="mt-4 mb-5" onClick={() => setManualMode(true)}>코드 직접 입력</Button>
          </>
        )}
      </div>
    </div>
  );
}
