import { createBrowserRouter } from 'react-router';
import { AndroidBackBridge } from '@/app/AndroidBackBridge';
import { NotFoundPage, RouteErrorPage } from '@/app/RouteErrorPage';
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
      // 렌더 예외·lazy 청크 로드 실패(배포 직후 구 해시)가 기본 스택 트레이스 화면으로
      // 노출되지 않게 전역에서 받아낸다
      errorElement: <RouteErrorPage />,
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
          children: [
            {
              // 10 로그인 — 사이드바 없는 전체 화면이라 AdminLayout 바깥에 둔다
              path: 'login',
              lazy: async () => {
                const { AdminLoginPage } = await import('@/features/admin/pages/AdminLoginPage');
                return { Component: AdminLoginPage };
              },
            },
            {
              // 아래는 전부 로그인 필요
              lazy: async () => {
                const { RequireAdminAuth } =
                  await import('@/features/admin/guards/RequireAdminAuth');
                return { Component: RequireAdminAuth };
              },
              children: [
                {
                  lazy: async () => {
                    const { AdminLayout } = await import('@/features/admin/AdminLayout');
                    return { Component: AdminLayout };
                  },
                  children: [
                    {
                      index: true, // 01 히트맵
                      lazy: async () => {
                        const { AdminHeatmapPage } =
                          await import('@/features/admin/pages/AdminHeatmapPage');
                        return { Component: AdminHeatmapPage };
                      },
                    },
                    {
                      path: 'stations/:stationId', // 02 대여소 상세 (히트맵에서 진입)
                      lazy: async () => {
                        const { AdminStationPage } =
                          await import('@/features/admin/pages/AdminStationPage');
                        return { Component: AdminStationPage };
                      },
                    },
                    {
                      path: 'users', // 04·09 사용자 관리
                      lazy: async () => {
                        const { AdminUsersPage } =
                          await import('@/features/admin/pages/AdminUsersPage');
                        return { Component: AdminUsersPage };
                      },
                    },
                    {
                      path: 'bikes', // 05·07 자전거 관리
                      lazy: async () => {
                        const { AdminBikesPage } =
                          await import('@/features/admin/pages/AdminBikesPage');
                        return { Component: AdminBikesPage };
                      },
                    },
                    {
                      path: 'users/:userId', // 09 사용자 상세 (목록에서 진입)
                      lazy: async () => {
                        const { AdminUserPage } =
                          await import('@/features/admin/pages/AdminUserPage');
                        return { Component: AdminUserPage };
                      },
                    },
                    {
                      path: 'bikes/:cycleId', // 07 자전거 상세 (목록에서 진입)
                      lazy: async () => {
                        const { AdminBikePage } =
                          await import('@/features/admin/pages/AdminBikePage');
                        return { Component: AdminBikePage };
                      },
                    },
                    {
                      path: 'claims', // 03 제보 관리 (API 용어가 claim이라 경로도 claims)
                      lazy: async () => {
                        const { AdminClaimsPage } =
                          await import('@/features/admin/pages/AdminClaimsPage');
                        return { Component: AdminClaimsPage };
                      },
                    },
                    {
                      path: 'notices', // 06·08 공지사항
                      lazy: async () => {
                        const { AdminNoticesPage } =
                          await import('@/features/admin/pages/AdminNoticesPage');
                        return { Component: AdminNoticesPage };
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        // 등록되지 않은 경로 — 이게 없으면 오타 주소에서 빈 화면만 나온다
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename },
);
