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
    <div className="flex h-full flex-col">
      <TopHeader title="QR 스캔" />
      <div className="flex flex-1 flex-col px-5">
        {manualMode ? (
          <div className="flex flex-1 flex-col justify-center">
            <InputField
              label="자전거 코드"
              placeholder="QR 아래 인쇄된 코드 입력 (예: 22B01262)"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.trim().toUpperCase())}
              autoCapitalize="characters"
              error={
                manualCode.length > 0 && !manualValid
                  ? '영문·숫자 6~12자로 입력해 주세요.'
                  : undefined
              }
            />
            <Button
              full
              className="mt-4"
              disabled={!manualValid}
              onClick={() => goWithCode(manualCode)}
            >
              확인
            </Button>
            <Button full variant="text" className="mt-2" onClick={() => setManualMode(false)}>
              QR 스캔으로 돌아가기
            </Button>
          </div>
        ) : (
          <>
            {/* 카메라 프리뷰 */}
            <div className="relative mt-2 flex-1 overflow-hidden rounded-2xl bg-gray-900">
              <video
                ref={videoRef}
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
              {/* 스캔 가이드 프레임 */}
              {status === 'scanning' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-56 w-56 rounded-2xl border-2 border-white/80" />
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
            <p className="mt-3 text-center text-sm text-gray-500">
              자전거의 QR코드를 프레임 안에 비춰주세요
            </p>
            <Button full variant="line" className="mt-3 mb-4" onClick={() => setManualMode(true)}>
              코드 직접 입력
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
