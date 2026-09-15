import { createBrowserRouter } from 'react-router';
import { AndroidBackBridge } from '@/app/AndroidBackBridge';
import { RequireAuth } from '@/app/guards/RequireAuth';
import { BareLayout } from '@/app/layouts/BareLayout';
import { MobileLayout } from '@/app/layouts/MobileLayout';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { MapHomePage } from '@/features/map/pages/MapHomePage';
import { HistoryPage } from '@/features/history/pages/HistoryPage';
import { RideDetailPage } from '@/features/history/pages/RideDetailPage';
import { BikeInfoPage } from '@/features/mypage/pages/BikeInfoPage';
import { BikeInsurancePage } from '@/features/mypage/pages/BikeInsurancePage';
import { OpenApiPage } from '@/features/mypage/pages/OpenApiPage';
import { FaqPage } from '@/features/mypage/pages/FaqPage';
import { GuidePage } from '@/features/mypage/pages/GuidePage';
import { NoticesPage } from '@/features/mypage/pages/NoticesPage';
import { SettingsPage } from '@/features/mypage/pages/SettingsPage';
import { SupportPage } from '@/features/mypage/pages/SupportPage';
import { WithdrawPage } from '@/features/mypage/pages/WithdrawPage';
import { MyPage } from '@/features/mypage/pages/MyPage';
import { PaymentMethodsPage } from '@/features/mypage/pages/PaymentMethodsPage';
import { RecommendedCoursesPage } from '@/features/mypage/pages/RecommendedCoursesPage';
import { OnboardingPage } from '@/features/onboarding/pages/OnboardingPage';
import { BikeReportsPage } from '@/features/rental/pages/BikeReportsPage';
import { BikeStatusPage } from '@/features/rental/pages/BikeStatusPage';
import { QrScanPage } from '@/features/rental/pages/QrScanPage';
import { MyReportsPage } from '@/features/report/pages/MyReportsPage';
import { ReportPage } from '@/features/report/pages/ReportPage';

/** 배포 경로(예: /staging/)에서도 라우팅이 동작하도록 Vite base를 basename으로 사용 */
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

export const router = createBrowserRouter(
  [
    {
      // 안드로이드 뒤로가기 처리 — 전 화면 공통이라 최상위에 건다 (웹에서는 no-op)
      element: <AndroidBackBridge />,
      children: [
        {
          // 메인 4탭 — 온보딩·로그인·가입을 통과해야 진입 (RequireAuth)
          element: <RequireAuth />,
          children: [
            {
              element: <MobileLayout />,
              children: [
                { path: '/', element: <MapHomePage /> }, // 07~16 지도·경로 (만두)
                { path: '/report', element: <ReportPage /> }, // 17-0~17-3 자전거·민원 (?type= 전환)
                { path: '/report/scan', element: <QrScanPage /> }, // QR 스캔 (상태확인·신고 공용)
                { path: '/report/bikes/:code', element: <BikeStatusPage /> }, // 18 자전거 상태
                { path: '/report/bikes/:code/reports', element: <BikeReportsPage /> }, // 20 제보 리스트
                { path: '/report/my', element: <MyReportsPage /> }, // 17-4 내 민원 내역
                { path: '/history', element: <HistoryPage /> }, // 22 이동 기록 (경호)
                { path: '/history/:rideId', element: <RideDetailPage /> }, // 23 기록 상세
                { path: '/mypage', element: <MyPage /> }, // 24 프로필 (경호)
                { path: '/mypage/guide', element: <GuidePage /> }, // 34 이용안내
                { path: '/mypage/payments', element: <PaymentMethodsPage /> }, // 결제수단
                { path: '/mypage/bike-info', element: <BikeInfoPage /> }, // 자전거 정보
                { path: '/mypage/bike-info/courses', element: <RecommendedCoursesPage /> }, // 추천 코스
                { path: '/mypage/bike-info/insurance', element: <BikeInsurancePage /> }, // 자전거 보험
                { path: '/mypage/bike-info/open-api', element: <OpenApiPage /> }, // Open API
                { path: '/mypage/support', element: <SupportPage /> }, // 고객센터
                { path: '/mypage/support/notices', element: <NoticesPage /> }, // 공지사항
                { path: '/mypage/support/faq', element: <FaqPage /> }, // 자주 묻는 질문
                { path: '/mypage/settings', element: <SettingsPage /> }, // 설정
                { path: '/mypage/withdraw', element: <WithdrawPage /> }, // 회원 탈퇴
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
      ],
    },
  ],
  { basename },
);
