import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { extractTashuCode } from '@/shared/lib/qr';
import { Button } from '@/shared/ui/Button';
import { InputField } from '@/shared/ui/InputField';
import { TopHeader } from '@/shared/ui/TopHeader';
import { useQrScanner } from '@/features/rental/hooks/useQrScanner';

/** 수동 입력 코드 형식 (QR 코드 인쇄본 기준, 예: 22B01262) */
const MANUAL_CODE_PATTERN = /^[A-Za-z0-9]{6,12}$/;

/**
 * QR 스캔 화면 — 17-0(상태 확인)·17-1·17-2(신고) 여러 곳에서 진입.
 * `?next=/report/broken`처럼 next 쿼리가 있으면 스캔한 코드를 그 경로에 `?code=`로 넘기고,
 * 없으면 18 자전거 상태로 이동한다.
 */
export function QrScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const goWithCode = (rawCode: string) => {
    const code = rawCode.toUpperCase();
    const next = searchParams.get('next');
    // replace: 뒤로가기 시 카메라 화면 대신 이전 화면(민원·상태확인)으로
    if (next?.startsWith('/')) {
      // next에 이미 쿼리(?type=...)가 있어도 안전하게 code를 덧붙인다
      const url = new URL(next, window.location.origin);
      url.searchParams.set('code', code);
      navigate(url.pathname + url.search, { replace: true });
    } else {
      navigate(`/report/bikes/${code}`, { replace: true });
    }
  };

  const { videoRef, status, start, stop } = useQrScanner((raw) => {
    // QR 원문에서 타슈 코드만 추출 — 타슈 QR이 아니면 계속 스캔
    const code = extractTashuCode(raw);
    if (!code) return false;
    goWithCode(code);
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
      <TopHeader title="QR 스캔" />
      <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-5">
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
              <Button full className="mt-4" disabled={!manualValid} onClick={() => goWithCode(manualCode)}>확인</Button>
            </section>
            <Button full variant="text" className="mt-3" onClick={() => setManualMode(false)}>카메라로 스캔하기</Button>
          </div>
        ) : (
          <>
            <div className="pt-2 pb-4">
              <p className="text-xs font-semibold tracking-[0.12em] text-primary">BIKE CHECK</p>
              <h1 className="mt-1 text-[23px] font-extrabold text-ink">자전거 QR을 비춰주세요</h1>
              <p className="mt-1.5 text-sm text-muted">상태와 최근 이용자 제보를 바로 확인할 수 있어요.</p>
            </div>
            {/* 카메라 프리뷰 */}
            <div className="relative min-h-[390px] flex-1 overflow-hidden rounded-[28px] bg-[#172015] shadow-[0_18px_36px_rgba(24,33,21,0.18)]">
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
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light text-sm font-bold text-primary">?</span>
              <p className="min-w-0 flex-1 text-sm leading-snug text-muted">인식되지 않으면 QR 아래 코드를 직접 입력할 수 있어요.</p>
            </div>
            <Button full variant="line" className="mt-3" onClick={() => setManualMode(true)}>코드 직접 입력</Button>
          </>
        )}
      </div>
    </div>
  );
}
