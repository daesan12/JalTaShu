import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Capacitor } from '@capacitor/core';
import { runBackHandler } from '@/shared/lib/backHandlers';

/** 이 시간 안에 뒤로가기를 한 번 더 누르면 앱 종료 */
const EXIT_WINDOW_MS = 2000;

/** 뒤로가기 시 지도로 보내는 탭 홈 화면들 (하위 화면은 일반 뒤로가기) */
const TAB_ROOTS = ['/report', '/history', '/mypage'];

/**
 * 안드로이드 하드웨어(제스처) 뒤로가기 처리 — 앱(Capacitor)에서만 동작, 웹은 no-op.
 * - state로만 연 시트(대여소·반납 입력·대여소 확인·정지 안내)가 있으면 그것부터 닫는다(`backHandlers`)
 * - 지도 홈(`/`, 시트 안 열림): 두 번 눌러 종료 (첫 번째는 안내 토스트)
 * - 지도에서 시트·검색이 열려 있으면(쿼리 존재): 일반 뒤로가기 = 시트 닫기 (URL 파라미터 설계)
 * - 민원·나의 경로·마이 탭 홈: 지도로 이동
 * - 그 외: 히스토리 뒤로가기, 더 갈 곳이 없으면 두 번 눌러 종료
 *
 * ⚠ backButton 리스너를 등록하는 순간 Capacitor 기본 뒤로가기가 꺼지므로
 *   여기서 모든 경우를 처리해야 한다.
 */
export function AndroidBackBridge() {
  const navigate = useNavigate();
  const location = useLocation();

  // 리스너는 한 번만 등록하고, 콜백에서는 ref로 최신 위치를 읽는다
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removed = false;
    let remove: (() => void) | undefined;
    let lastBackPress = 0;

    void (async () => {
      const [{ App }, { Toast }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/toast'),
      ]);

      const confirmExit = () => {
        const now = Date.now();
        if (now - lastBackPress < EXIT_WINDOW_MS) {
          void App.exitApp();
          return;
        }
        lastBackPress = now;
        void Toast.show({
          text: "'뒤로' 버튼을 한 번 더 누르시면 앱이 종료됩니다.",
          duration: 'short',
        });
      };

      const handle = await App.addListener('backButton', ({ canGoBack }) => {
        // 화면 위에 state로 뜬 시트가 있으면 그걸 닫는 게 뒤로가기다 — 종료로 가면 안 된다
        if (runBackHandler()) return;

        const { pathname, search } = locationRef.current;

        // 지도 홈 — 쿼리가 있으면 시트·검색이 열린 상태라 일반 뒤로가기(= 한 단계 닫기)
        if (pathname === '/' && !search) {
          confirmExit();
          return;
        }
        if (TAB_ROOTS.includes(pathname)) {
          navigate('/');
          return;
        }
        if (canGoBack) {
          window.history.back();
          return;
        }
        confirmExit(); // 딥링크 진입 등 히스토리가 없는 경우
      });

      remove = () => void handle.remove();
      if (removed) remove(); // 등록 완료 전에 언마운트된 경우
    })();

    return () => {
      removed = true;
      remove?.();
    };
  }, [navigate]);

  // 라우터 최상위(pathless route)에 걸리는 래퍼라 자식 라우트를 그대로 렌더한다
  return <Outlet />;
}
