import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@/app/index.css';
import { Providers } from '@/app/providers';
import { router } from '@/app/router';
import { ENV } from '@/shared/config/env';

async function enableMocking() {
  if (!ENV.ENABLE_MSW) return;
  try {
    const { worker } = await import('@/mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      // 배포 경로(base)가 '/'가 아니어도 서비스 워커를 올바른 위치에서 찾도록
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    });
  } catch (err) {
    // 서비스 워커가 차단된 환경에서도 앱 자체는 뜨도록 한다 (API 호출만 실패)
    console.warn('[msw] 목업 활성화 실패 — 실제 네트워크로 동작합니다.', err);
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  );
});
