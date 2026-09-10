import { createBrowserRouter } from 'react-router';
import { RequireAuth } from '@/app/guards/RequireAuth';
import { BareLayout } from '@/app/layouts/BareLayout';
import { MobileLayout } from '@/app/layouts/MobileLayout';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { MapHomePage } from '@/features/map/pages/MapHomePage';
import { HistoryPage } from '@/features/history/pages/HistoryPage';
import { MyPage } from '@/features/mypage/pages/MyPage';
import { OnboardingPage } from '@/features/onboarding/pages/OnboardingPage';
import { RentalPage } from '@/features/rental/pages/RentalPage';

export const router = createBrowserRouter([
  {
    // 메인 4탭 — 온보딩·로그인·가입을 통과해야 진입 (RequireAuth)
    element: <RequireAuth />,
    children: [
      {
        element: <MobileLayout />,
        children: [
          { path: '/', element: <MapHomePage /> }, // 07~16 지도·경로 (만두)
          { path: '/rental', element: <RentalPage /> }, // 17~18 QR·자전거 확인 (경호)
          { path: '/history', element: <HistoryPage /> }, // 22~23 기록 (경호)
          { path: '/mypage', element: <MyPage /> }, // 24~34 프로필·이용안내 (경호)
        ],
      },
    ],
  },
  {
    // 진입 플로우 — 탭바 없는 레이아웃
    element: <BareLayout />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> }, // 02~04
      { path: '/login', element: <LoginPage /> }, // 05
      { path: '/signup', element: <SignupPage /> }, // 06
    ],
  },
  {
    // 관리자 화면은 라우터 내장 lazy로 지연 로딩 — 모바일 사용자는 이 청크를 내려받지 않음
    path: '/admin',
    lazy: async () => {
      const { AdminLayout } = await import('@/features/admin/AdminLayout');
      return { Component: AdminLayout };
    },
    children: [
      {
        index: true,
        lazy: async () => {
          const { AdminHomePage } = await import('@/features/admin/pages/AdminHomePage');
          return { Component: AdminHomePage };
        },
      },
    ],
  },
]);
