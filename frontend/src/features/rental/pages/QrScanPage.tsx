import { useNavigate, useSearchParams } from 'react-router';
import { QrScanView } from '@/features/rental/components/QrScanView';

/**
 * QR 스캔 화면 — 17-0(상태 확인)·17-1·17-2(신고) 여러 곳에서 진입.
 * `?next=/report/broken`처럼 next 쿼리가 있으면 스캔한 코드를 그 경로에 `?code=`로 넘기고,
 * 없으면 18 자전거 상태로 이동한다.
 * 지도의 대여·반납은 이 페이지를 쓰지 않고 지도 위 오버레이로 같은 화면을 띄운다(`QrScanView`).
 */
export function QrScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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

  return <QrScanView onCode={goWithCode} />;
}
